import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_client_ip, get_current_user, write_audit_log
from app.config import settings
from app.db import SessionLocal, get_db
from app.models import Company, OutreachRequest, PipelineRun, User, utc_now_iso
from app.routers.serializers import serialize_run
from app.schemas import CreateRunPayload, PipelineRunSchema
from app.services.orchestrator import (
    execute_orchestration_sync,
    get_run_version,
    notify_run_update,
    sync_run_steps,
    trigger_orchestration_background,
    wait_for_run_update,
)

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _authenticate_sse_request(request: Request, token: str | None, db: Session) -> User:
    raw_token = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        raw_token = auth_header[7:].strip()
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication token.")
    try:
        payload = jwt.decode(
            raw_token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.") from exc

    user_id = payload.get("sub")
    company_id = payload.get("company_id")
    user = db.scalar(select(User).where(User.id == user_id, User.company_id == company_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


@router.get("", response_model=list[PipelineRunSchema])
def list_runs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    runs = list(
        db.scalars(
            select(PipelineRun)
            .where(PipelineRun.company_id == current_user.company_id)
            .order_by(PipelineRun.started_at.desc())
        )
    )
    return [serialize_run(r) for r in runs]


@router.post("", response_model=PipelineRunSchema, status_code=status.HTTP_201_CREATED)
def create_run(
    payload: CreateRunPayload,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    company = db.scalar(select(Company).where(Company.id == cid))
    now_iso = utc_now_iso()
    run_id = f"RUN-{payload.period}-{uuid.uuid4().hex[:4].upper()}"
    initial_steps = sync_run_steps([], "created", now_iso)
    new_run = PipelineRun(
        id=run_id,
        company_id=cid,
        company_name=company.name if company else "Demo Fasteners Pvt Ltd",
        period=payload.period,
        product=payload.product,
        cn_code=company.cn_code if company else "7318 15",
        state="created",
        active_agent="collector",
        started_at=now_iso,
        updated_at=now_iso,
        steps_json=initial_steps,
        logs_json=[
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "system",
                "message": f"Created CBAM run {run_id} for {payload.period} ({payload.product}).",
            }
        ],
    )
    db.add(new_run)
    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="run_created",
        target_type="run",
        target_id=run_id,
        detail=f"Started orchestrated CBAM run {run_id} for {payload.period}.",
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(new_run)
    notify_run_update(run_id)

    # Start background AI + deterministic orchestration loop
    trigger_orchestration_background(
        company_id=cid,
        run_id=run_id,
        user_id=current_user.id,
        phase="initial",
        step_delay_seconds=0.15,
    )
    return serialize_run(new_run)


@router.get("/{run_id}", response_model=PipelineRunSchema)
def get_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    run = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == current_user.company_id,
            PipelineRun.id == run_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    return serialize_run(run)


@router.get("/{run_id}/stream")
async def stream_run(
    run_id: str,
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    user = _authenticate_sse_request(request, token, db)
    cid = user.company_id
    run = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == cid,
            PipelineRun.id == run_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    async def event_generator():
        last_version = -1
        for _ in range(36):  # stream up to ~3 minutes cleanly per connection
            if await request.is_disconnected():
                break

            session = SessionLocal()
            try:
                current_run = session.scalar(
                    select(PipelineRun).where(
                        PipelineRun.company_id == cid,
                        PipelineRun.id == run_id,
                    )
                )
                if current_run is None:
                    break
                payload_json = serialize_run(current_run).model_dump_json()
            finally:
                session.close()

            current_version = get_run_version(run_id)
            if current_version != last_version:
                last_version = current_version
                yield f"event: run_update\ndata: {payload_json}\n\n"
            else:
                yield f"event: ping\ndata: {json.dumps({'runId': run_id})}\n\n"

            next_version = await asyncio.to_thread(wait_for_run_update, run_id, last_version, 5.0)
            if next_version == last_version:
                # Re-yield only on updates or periodic heartbeat
                continue

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{run_id}/step", response_model=PipelineRunSchema)
def step_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    run = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == cid,
            PipelineRun.id == run_id,
        )
    )
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")

    if run.state in ("created", "collecting", "gaps_found"):
        execute_orchestration_sync(
            company_id=cid,
            run_id=run_id,
            user_id=current_user.id,
            phase="initial",
            step_delay_seconds=0.0,
        )
    elif run.state in ("awaiting_message_approval", "waiting_supplier_reply"):
        pending_outreach = db.scalar(
            select(OutreachRequest).where(
                OutreachRequest.company_id == cid,
                OutreachRequest.run_id == run_id,
                OutreachRequest.status.in_(["draft", "approved", "sent"]),
            )
        )
        if pending_outreach is None:
            execute_orchestration_sync(
                company_id=cid,
                run_id=run_id,
                user_id=current_user.id,
                phase="post_fix",
                step_delay_seconds=0.0,
            )
    elif run.state in ("calculating", "verifying", "needs_fixes"):
        execute_orchestration_sync(
            company_id=cid,
            run_id=run_id,
            user_id=current_user.id,
            phase="post_fix",
            step_delay_seconds=0.0,
        )

    db.expire_all()
    refreshed = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == cid,
            PipelineRun.id == run_id,
        )
    )
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found.")
    notify_run_update(run_id)
    return serialize_run(refreshed)
