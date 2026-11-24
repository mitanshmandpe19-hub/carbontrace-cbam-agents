from datetime import datetime, timedelta, timezone
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.auth import get_client_ip, get_current_user, write_audit_log
from app.config import settings
from app.db import get_db
from app.models import (
    GapItemModel,
    LedgerRecord,
    OutreachMessageModel,
    OutreachRequest,
    PipelineRun,
    Supplier,
    User,
    utc_now_iso,
)
from app.routers.serializers import (
    serialize_ledger_record,
    serialize_outreach,
    serialize_run,
)
from app.schemas import (
    ApproveOutreachPayload,
    OutreachRequestSchema,
    SimulateReplyResponseSchema,
)
from app.services.calculator import recompute_run_calculations
from app.services.orchestrator import (
    execute_orchestration_sync,
    notify_run_update,
    sync_run_steps,
)
from app.services.outreach import parse_supplier_reply_with_verification
from app.services.verifier import verify_run

router = APIRouter(prefix="/api/outreach", tags=["outreach"])


@router.get("", response_model=list[OutreachRequestSchema])
def list_outreach(
    runId: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = (
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(OutreachRequest.company_id == current_user.company_id)
    )
    if runId:
        stmt = stmt.where(OutreachRequest.run_id == runId)
    rows = list(db.scalars(stmt.order_by(OutreachRequest.id)))
    return [serialize_outreach(o) for o in rows]


@router.post("/{outreach_id}/approve", response_model=OutreachRequestSchema)
def approve_outreach(
    outreach_id: str,
    payload: ApproveOutreachPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    item = db.scalar(
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(
            OutreachRequest.company_id == cid,
            OutreachRequest.id == outreach_id,
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outreach request not found.")

    now = datetime.now(timezone.utc)
    now_iso = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    final_draft = payload.draft.strip() if payload.draft and payload.draft.strip() else item.draft
    item.draft = final_draft
    item.status = "sent"
    item.tries = max(1, item.tries + 1)
    followup = now + (
        timedelta(seconds=settings.followup_interval_seconds)
        if settings.demo_mode
        else timedelta(hours=48)
    )
    item.next_followup_at = followup.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    db.add(
        OutreachMessageModel(
            company_id=cid,
            outreach_request_id=item.id,
            direction="out",
            text=final_draft,
            at=now_iso,
            language=item.language,
        )
    )

    run = db.scalar(select(PipelineRun).where(PipelineRun.company_id == cid, PipelineRun.id == item.run_id))
    if run:
        run.state = "waiting_supplier_reply"
        run.active_agent = "outreach"
        run.updated_at = now_iso
        run.steps_json = sync_run_steps(run.steps_json, "waiting_supplier_reply", now_iso)
        logs = list(run.logs_json or [])
        logs.insert(
            0,
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "exporter",
                "message": f"Approved & sent {item.channel.upper()} request to {item.supplier}.",
                "detail": "Outreach agent awaiting reply (simulated send logged).",
                "targetId": item.id,
            },
        )
        run.logs_json = logs

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="approve_outreach",
        target_type="outreach_request",
        target_id=item.id,
        detail=f"Approved outgoing {item.channel} message to {item.supplier}.",
        ip_address=get_client_ip(request),
    )

    db.commit()
    if run:
        notify_run_update(run.id)

    refetched = db.scalar(
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(OutreachRequest.id == item.id)
    )
    return serialize_outreach(refetched or item)


@router.post("/{outreach_id}/simulate-reply", response_model=SimulateReplyResponseSchema)
def simulate_supplier_reply(
    outreach_id: str,
    request: Request,
    body: dict | None = Body(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    item = db.scalar(
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(
            OutreachRequest.company_id == cid,
            OutreachRequest.id == outreach_id,
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outreach request not found.")

    now_iso = utc_now_iso()
    custom_text = (body or {}).get("text") if isinstance(body, dict) else None
    is_primary_wire = item.supplier_id == "SUP-01" or item.id.endswith("O-1")
    reply_text = (
        str(custom_text).strip()
        if custom_text and str(custom_text).strip()
        else (
            "Namaste ji! Verified Q3 EAF steel wire rod intensity is 0.90 tCO2e/t (batch noted 40 tonnes supplied in Q3). Mill sheet attached."
            if is_primary_wire
            else "Confirmed Q3 process emissions certificate: 1.48 tCO2e/t (Sample illustrative reply)."
        )
    )

    item.status = "replied"
    item.next_followup_at = None
    db.add(
        OutreachMessageModel(
            company_id=cid,
            outreach_request_id=item.id,
            direction="in",
            text=reply_text,
            at=now_iso,
            language=item.language,
        )
    )

    # Parse reply using Gemini (or fallback) + anti-hallucination quote verification
    parsed_facts, extracted_by = parse_supplier_reply_with_verification(reply_text)

    for idx, f in enumerate(parsed_facts):
        if f["field"] == "precursor_wire_rod_factor":
            base_id = "R-14"
            rec_id = base_id if item.run_id == "RUN-2026-Q3" else f"{item.run_id}-{base_id}"
            existing = db.scalar(
                select(LedgerRecord).where(
                    LedgerRecord.company_id == cid,
                    LedgerRecord.id == rec_id,
                )
            )
            if existing is None:
                db.add(
                    LedgerRecord(
                        id=rec_id,
                        company_id=cid,
                        run_id=item.run_id,
                        document_id="D-12",
                        document_name="Sample Steel Wire Co - WhatsApp Reply.txt",
                        page=1,
                        quote=f["quote"],
                        field="precursor_wire_rod_factor",
                        value=float(f["value"]),
                        unit=f["unit"],
                        period="2026-Q3",
                        extracted_by=extracted_by,
                        confidence=float(f["confidence"]),
                        status=str(f["status"]),
                        created_at=now_iso,
                    )
                )
            else:
                existing.value = float(f["value"])
                existing.quote = f["quote"]
                existing.confidence = float(f["confidence"])
                existing.status = str(f["status"])

            sup = db.scalar(select(Supplier).where(Supplier.company_id == cid, Supplier.id == item.supplier_id))
            if sup:
                sup.emissions_per_tonne = float(f["value"])
                sup.data_quality_score = max(sup.data_quality_score, 88)
                sup.last_verified_at = now_iso

    gaps = list(
        db.scalars(
            select(GapItemModel).where(
                GapItemModel.company_id == cid,
                GapItemModel.outreach_request_id == item.id,
            )
        )
    )
    for g in gaps:
        g.status = "resolved_actual"

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="outreach_reply_received",
        target_type="outreach_request",
        target_id=item.id,
        detail=f"Parsed supplier reply for {item.supplier}; added verified fact(s) and re-entered gap check.",
        ip_address=get_client_ip(request),
    )
    db.commit()

    # Return run to the gap check -> calculating -> verifying -> needs_fixes / ready_for_approval
    execute_orchestration_sync(
        company_id=cid,
        run_id=item.run_id,
        user_id=current_user.id,
        phase="post_reply",
        step_delay_seconds=0.05,
    )

    refetched_item = db.scalar(
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(OutreachRequest.id == item.id)
    )
    run = db.scalar(select(PipelineRun).where(PipelineRun.company_id == cid, PipelineRun.id == item.run_id))
    ledger_rows = list(
        db.scalars(
            select(LedgerRecord)
            .where(LedgerRecord.company_id == cid, LedgerRecord.run_id == item.run_id)
            .order_by(LedgerRecord.id)
        )
    )

    return SimulateReplyResponseSchema(
        outreach=serialize_outreach(refetched_item or item),
        ledger=[serialize_ledger_record(r) for r in ledger_rows],
        run=serialize_run(run),  # type: ignore[arg-type]
    )


@router.post("/{outreach_id}/fallback")
def fallback_to_default(
    outreach_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    item = db.scalar(
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(OutreachRequest.company_id == cid, OutreachRequest.id == outreach_id)
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outreach request not found.")

    now_iso = utc_now_iso()
    item.tries = item.max_tries
    item.status = "gave_up"
    item.next_followup_at = None
    db.add(
        OutreachMessageModel(
            company_id=cid,
            outreach_request_id=item.id,
            direction="out",
            text=f"Final follow-up (try {item.max_tries}/{item.max_tries}) unanswered. Gap closed using EU default value.",
            at=now_iso,
            language="English",
        )
    )

    gaps = list(
        db.scalars(
            select(GapItemModel).where(
                GapItemModel.company_id == cid,
                GapItemModel.outreach_request_id == item.id,
            )
        )
    )
    for g in gaps:
        g.status = "closed_default"

    db.flush()
    recompute_run_calculations(db, cid, item.run_id)
    verify_run(db, cid, item.run_id)

    run = db.scalar(select(PipelineRun).where(PipelineRun.company_id == cid, PipelineRun.id == item.run_id))
    if run:
        run.updated_at = now_iso
        logs = list(run.logs_json or [])
        logs.insert(
            0,
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "outreach",
                "message": f"No reply from {item.supplier} after {item.max_tries} tries — gap closed with EU default label.",
                "targetId": item.id,
            },
        )
        run.logs_json = logs

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="outreach_fallback_default",
        target_type="outreach_request",
        target_id=item.id,
        detail=f"Closed gap for {item.supplier} with EU default value.",
        ip_address=get_client_ip(request),
    )
    db.commit()
    if run:
        notify_run_update(run.id)

    refetched = db.scalar(
        select(OutreachRequest)
        .options(selectinload(OutreachRequest.messages))
        .where(OutreachRequest.id == item.id)
    )
    return {
        "outreach": serialize_outreach(refetched or item),
        "run": serialize_run(run),  # type: ignore[arg-type]
    }
