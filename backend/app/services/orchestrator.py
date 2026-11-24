"""Background Pipeline Orchestrator: coordinates Collector -> Gap Finder -> Outreach -> Calculator -> Verifier + SSE stream."""

from __future__ import annotations

from collections import defaultdict
import logging
from threading import Condition, Lock, Thread
import time
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import write_audit_log
from app.db import SessionLocal
from app.models import GapItemModel, OutreachRequest, PipelineRun, VerificationFlag, utc_now_iso
from app.services.calculator import recompute_run_calculations
from app.services.collector import collect_company_documents
from app.services.gap_finder import find_gaps
from app.services.outreach import draft_outreach_for_open_gaps
from app.services.verifier import verify_run

logger = logging.getLogger("carbontrace.orchestrator")

PIPELINE_STATES: list[tuple[str, str, str]] = [
    ("created", "Created", "system"),
    ("collecting", "Collecting", "collector"),
    ("gaps_found", "Gaps found", "outreach"),
    ("awaiting_message_approval", "Approve message", "exporter"),
    ("waiting_supplier_reply", "Supplier reply", "outreach"),
    ("calculating", "Calculating", "calculator"),
    ("verifying", "Verifying", "verifier"),
    ("needs_fixes", "Needs fixes", "verifier"),
    ("ready_for_approval", "Ready", "exporter"),
    ("approved", "Approved", "exporter"),
    ("exported", "Exported", "exporter"),
]

STATE_INDEX = {state: idx for idx, (state, _, _) in enumerate(PIPELINE_STATES)}

# In-memory condition variables so SSE subscribers receive instant updates per runId
_SSE_LOCK = Lock()
_RUN_CONDITIONS: dict[str, Condition] = defaultdict(Condition)
_RUN_VERSIONS: dict[str, int] = defaultdict(int)


def notify_run_update(run_id: str) -> None:
    with _SSE_LOCK:
        cond = _RUN_CONDITIONS[run_id]
        _RUN_VERSIONS[run_id] += 1
        with cond:
            cond.notify_all()


def wait_for_run_update(run_id: str, last_version: int, timeout: float = 5.0) -> int:
    with _SSE_LOCK:
        cond = _RUN_CONDITIONS[run_id]
        current = _RUN_VERSIONS[run_id]
    if current != last_version:
        return current
    with cond:
        cond.wait(timeout=timeout)
    with _SSE_LOCK:
        return _RUN_VERSIONS[run_id]


def get_run_version(run_id: str) -> int:
    with _SSE_LOCK:
        return _RUN_VERSIONS[run_id]


def sync_run_steps(existing_steps: list[dict] | None, target_state: str, now_iso: str) -> list[dict]:
    """Maintain step-by-step timestamps across the 11 pipeline states."""
    prior_map = {s["state"]: s for s in (existing_steps or []) if isinstance(s, dict) and "state" in s}
    target_idx = STATE_INDEX.get(target_state, 0)
    next_steps: list[dict] = []

    for idx, (state, label, actor) in enumerate(PIPELINE_STATES):
        prev = prior_map.get(state, {})
        started = prev.get("startedAt")
        completed = prev.get("completedAt")

        if idx < target_idx:
            status = "completed"
            started = started or now_iso
            completed = completed or now_iso
        elif idx == target_idx:
            status = "active"
            started = started or now_iso
            completed = None
        else:
            status = "pending"
            started = None
            completed = None

        next_steps.append(
            {
                "state": state,
                "label": label,
                "actor": actor,
                "status": status,
                "startedAt": started,
                "completedAt": completed,
            }
        )
    return next_steps


def _advance_state(
    db: Session,
    *,
    run: PipelineRun,
    new_state: str,
    actor: str,
    message: str,
    detail: str | None = None,
    target_id: str | None = None,
    audit_action: str | None = None,
    user_id: str | None = None,
) -> None:
    now_iso = utc_now_iso()
    run.state = new_state
    run.active_agent = None if actor == "system" else actor
    run.updated_at = now_iso
    run.steps_json = sync_run_steps(run.steps_json, new_state, now_iso)

    logs = list(run.logs_json or [])
    logs.insert(
        0,
        {
            "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
            "at": now_iso,
            "actor": actor,
            "message": message,
            "detail": detail,
            "targetId": target_id,
        },
    )
    run.logs_json = logs

    write_audit_log(
        db,
        company_id=run.company_id,
        user_id=user_id,
        action=audit_action or f"orchestrator_{new_state}",
        target_type="run",
        target_id=run.id,
        detail=message,
    )
    db.commit()
    notify_run_update(run.id)


def execute_orchestration_sync(
    *,
    company_id: str,
    run_id: str,
    user_id: str | None = None,
    phase: str = "initial",
    step_delay_seconds: float = 0.25,
) -> None:
    """
    Execute orchestrated CBAM agent pipeline against DB in a dedicated thread/session.

    phases:
      - 'initial': created -> collecting -> gaps_found -> (awaiting_message_approval OR calculating -> verifying -> final)
      - 'post_reply': returns from reply -> gaps_found -> calculating -> verifying -> needs_fixes / ready_for_approval
      - 'post_fix': recalculates -> verifying -> needs_fixes / ready_for_approval
    """
    db = SessionLocal()
    try:
        run = db.scalar(
            select(PipelineRun).where(
                PipelineRun.company_id == company_id,
                PipelineRun.id == run_id,
            )
        )
        if run is None:
            return

        if phase == "initial":
            # 1. Collecting
            _advance_state(
                db,
                run=run,
                new_state="collecting",
                actor="collector",
                message="Collector started scanning uploaded bills, logs, and invoices.",
                user_id=user_id,
            )
            extracted = collect_company_documents(db, company_id=company_id, run_id=run_id, user_id=user_id)
            db.commit()
            if step_delay_seconds > 0:
                time.sleep(step_delay_seconds)

            # 2. Gap Finder
            _advance_state(
                db,
                run=run,
                new_state="gaps_found",
                actor="outreach",
                message=f"Collector saved {len(extracted)} sourced facts; Gap Finder scanning missing CBAM fields.",
                user_id=user_id,
            )
            find_gaps(db, company_id=company_id, run_id=run_id, user_id=user_id)
            outreach_list = draft_outreach_for_open_gaps(db, company_id=company_id, run_id=run_id, user_id=user_id)
            db.commit()
            if step_delay_seconds > 0:
                time.sleep(step_delay_seconds)

            # Check whether human approval for outgoing supplier message is required before proceeding
            pending_drafts = [o for o in outreach_list if o.status == "draft"]
            if pending_drafts:
                _advance_state(
                    db,
                    run=run,
                    new_state="awaiting_message_approval",
                    actor="exporter",
                    message=f"Paused at human gate: approve outgoing draft {pending_drafts[0].id} to {pending_drafts[0].supplier}.",
                    detail="Human approval required before any supplier message leaves CarbonTrace.",
                    target_id=pending_drafts[0].id,
                    user_id=user_id,
                )
                return

        if phase == "post_reply":
            # Return directly to gap check after reply
            find_gaps(db, company_id=company_id, run_id=run_id, user_id=user_id)
            _advance_state(
                db,
                run=run,
                new_state="gaps_found",
                actor="outreach",
                message="Supplier reply received — re-checking remaining CBAM data gaps.",
                user_id=user_id,
            )
            if step_delay_seconds > 0:
                time.sleep(step_delay_seconds)

        # Calculating (deterministic Python)
        recompute_run_calculations(db, company_id, run_id)
        _advance_state(
            db,
            run=run,
            new_state="calculating",
            actor="calculator",
            message="Calculator ran deterministic Python formula using illustrative sample factors.",
            user_id=user_id,
        )
        if step_delay_seconds > 0:
            time.sleep(step_delay_seconds)

        # Verifying (deterministic 9-rule checks)
        flags = verify_run(db, company_id, run_id)
        open_blockers = [f for f in flags if f.severity == "block" and f.status == "open"]
        open_warns = [f for f in flags if f.severity == "warn" and f.status == "open"]
        _advance_state(
            db,
            run=run,
            new_state="verifying",
            actor="verifier",
            message="Verifier checked units, duplicates, supplier totals, and factor citations.",
            user_id=user_id,
        )
        if step_delay_seconds > 0:
            time.sleep(step_delay_seconds)

        if open_blockers:
            codes_summary = ", ".join(f"{f.id}:{f.code}" for f in open_blockers + open_warns)
            _advance_state(
                db,
                run=run,
                new_state="needs_fixes",
                actor="verifier",
                message=f"Verifier blocked report approval: {len(open_blockers)} blocker(s), {len(open_warns)} warning(s).",
                detail=codes_summary,
                user_id=user_id,
            )
        else:
            _advance_state(
                db,
                run=run,
                new_state="ready_for_approval",
                actor="exporter",
                message="All Verifier checks passed — Q3 CBAM report ready for final Exporter approval.",
                user_id=user_id,
            )
    except Exception as exc:
        logger.exception("Orchestrator pipeline failure on %s: %s", run_id, exc)
        db.rollback()
    finally:
        db.close()


def trigger_orchestration_background(
    *,
    company_id: str,
    run_id: str,
    user_id: str | None = None,
    phase: str = "initial",
    step_delay_seconds: float = 0.2,
) -> Thread:
    thread = Thread(
        target=execute_orchestration_sync,
        kwargs={
            "company_id": company_id,
            "run_id": run_id,
            "user_id": user_id,
            "phase": phase,
            "step_delay_seconds": step_delay_seconds,
        },
        daemon=True,
    )
    thread.start()
    return thread

