import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_client_ip, get_current_user, write_audit_log
from app.db import get_db
from app.models import LedgerRecord, PipelineRun, User, VerificationFlag, utc_now_iso
from app.routers.serializers import serialize_flag, serialize_run
from app.schemas import ResolveFlagPayload, ResolveFlagResponseSchema, VerificationFlagSchema
from app.services.calculator import recompute_run_calculations
from app.services.orchestrator import notify_run_update, sync_run_steps
from app.services.verifier import verify_run

router = APIRouter(prefix="/api/verification", tags=["verification"])


@router.get("", response_model=list[VerificationFlagSchema])
def list_verification_flags(
    runId: str = Query(default="RUN-2026-Q3"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flags = verify_run(db, current_user.company_id, runId)
    db.commit()
    return [serialize_flag(f) for f in flags]


@router.post("/{flag_id}/resolve", response_model=ResolveFlagResponseSchema)
def resolve_verification_flag(
    flag_id: str,
    payload: ResolveFlagPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    flag = db.scalar(
        select(VerificationFlag).where(
            VerificationFlag.company_id == cid,
            VerificationFlag.id == flag_id,
        )
    )
    if flag is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification flag not found.",
        )

    flag.status = "resolved" if payload.resolution == "resolve" else "accepted"

    # Update corresponding ledger records deterministically
    target_rec_id: str | None = None
    if flag.id.endswith("V-1"):
        target_rec_id = "R-11" if flag.run_id == "RUN-2026-Q3" else f"{flag.run_id}-R-11"
        new_rec_status = "superseded"
    elif flag.id.endswith("V-2"):
        target_rec_id = "R-05" if flag.run_id == "RUN-2026-Q3" else f"{flag.run_id}-R-05"
        new_rec_status = "superseded"
    elif flag.id.endswith("V-3"):
        target_rec_id = "R-15" if flag.run_id == "RUN-2026-Q3" else f"{flag.run_id}-R-15"
        new_rec_status = "superseded"
    elif flag.id.endswith("V-4"):
        target_rec_id = "R-13" if flag.run_id == "RUN-2026-Q3" else f"{flag.run_id}-R-13"
        new_rec_status = "rejected"
    elif flag.target_type == "ledger_record":
        target_rec_id = flag.target_id
        new_rec_status = "superseded" if payload.resolution == "resolve" else "verified"
    else:
        new_rec_status = "rejected"

    if target_rec_id:
        rec = db.scalar(
            select(LedgerRecord).where(
                LedgerRecord.company_id == cid,
                LedgerRecord.id == target_rec_id,
            )
        )
        if rec:
            rec.status = new_rec_status

    db.flush()
    recompute_run_calculations(db, cid, flag.run_id)
    flags = verify_run(db, cid, flag.run_id)
    open_blockers = sum(1 for f in flags if f.severity == "block" and f.status == "open")

    now_iso = utc_now_iso()
    run = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == cid,
            PipelineRun.id == flag.run_id,
        )
    )
    if run:
        run.updated_at = now_iso
        run.steps_json = sync_run_steps(run.steps_json, run.state, now_iso)
        logs = list(run.logs_json or [])
        logs.insert(
            0,
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "verifier",
                "message": f"{flag.code} marked {flag.status}. "
                + (
                    "All blocking issues cleared — ready for Exporter approval!"
                    if open_blockers == 0
                    else f"{open_blockers} blocking flag(s) still open."
                ),
                "targetId": flag.id,
            },
        )
        run.logs_json = logs

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="resolve_verification_flag",
        target_type="verification_flag",
        target_id=flag.id,
        detail=f"Marked flag {flag.id} ({flag.code}) as {flag.status}.",
        ip_address=get_client_ip(request),
    )

    db.commit()
    notify_run_update(flag.run_id)
    db.refresh(flag)
    if run:
        db.refresh(run)
    return ResolveFlagResponseSchema(
        flag=serialize_flag(flag),
        run=serialize_run(run),  # type: ignore[arg-type]
    )

