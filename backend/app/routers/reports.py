from typing import Literal
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_client_ip, get_current_user, write_audit_log
from app.db import get_db
from app.models import (
    CalculationLineModel,
    Company,
    EmissionFactor,
    LedgerRecord,
    PipelineRun,
    ReportSnapshot,
    User,
    VerificationFlag,
    utc_now_iso,
)
from app.routers.serializers import serialize_report
from app.schemas import ReportSnapshotSchema
from app.services.calculator import recompute_run_calculations
from app.services.orchestrator import notify_run_update, sync_run_steps
from app.services.reports import build_report_pdf_bytes, build_report_xlsx_bytes
from app.services.verifier import verify_run

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("", response_model=list[ReportSnapshotSchema])
def list_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    recompute_run_calculations(db, cid, "RUN-2026-Q3")
    verify_run(db, cid, "RUN-2026-Q3")
    db.commit()

    reports = list(
        db.scalars(
            select(ReportSnapshot)
            .where(ReportSnapshot.company_id == cid)
            .order_by(ReportSnapshot.period)
        )
    )
    return [serialize_report(r) for r in reports]


@router.post("/{run_or_report_id}/approve", response_model=ReportSnapshotSchema)
def approve_report(
    run_or_report_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    report = db.scalar(
        select(ReportSnapshot).where(
            ReportSnapshot.company_id == cid,
            (ReportSnapshot.run_id == run_or_report_id) | (ReportSnapshot.id == run_or_report_id),
        )
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    run_id = report.run_id or "RUN-2026-Q3"
    recompute_run_calculations(db, cid, run_id)
    flags = verify_run(db, cid, run_id)

    open_blockers = [f for f in flags if f.severity == "block" and f.status == "open"]
    if open_blockers:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Report approval blocked by Verifier: {len(open_blockers)} open blocking flag(s) remain.",
        )

    now_iso = utc_now_iso()
    report.status = "approved"
    report.approved_at = now_iso

    run = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == cid,
            PipelineRun.id == run_id,
        )
    )
    if run:
        run.state = "approved"
        run.active_agent = "exporter"
        run.updated_at = now_iso
        run.steps_json = sync_run_steps(run.steps_json, "approved", now_iso)
        logs = list(run.logs_json or [])
        logs.insert(
            0,
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "exporter",
                "message": f"Exporter approved {report.period} CBAM report snapshot. Exports unlocked.",
                "targetId": report.id,
            },
        )
        run.logs_json = logs

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="approve_report",
        target_type="report",
        target_id=report.id,
        detail=f"Approved CBAM report snapshot {report.id} ({report.period}).",
        ip_address=get_client_ip(request),
    )

    db.commit()
    if run:
        notify_run_update(run.id)
    db.refresh(report)
    return serialize_report(report)


@router.get("/{report_id}/export")
def export_report(
    report_id: str,
    request: Request,
    format: Literal["pdf", "xlsx"] = Query(default="pdf"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    report = db.scalar(
        select(ReportSnapshot).where(
            ReportSnapshot.company_id == cid,
            (ReportSnapshot.id == report_id) | (ReportSnapshot.run_id == report_id),
        )
    )
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    run_id = report.run_id or "RUN-2026-Q3"
    recompute_run_calculations(db, cid, run_id)

    company = db.scalar(select(Company).where(Company.id == cid))
    company_name = company.name if company else "Demo Fasteners Pvt Ltd"
    carbon_price = company.default_carbon_price_eur if company else 85.0

    calcs = list(
        db.scalars(
            select(CalculationLineModel)
            .where(CalculationLineModel.company_id == cid, CalculationLineModel.run_id == run_id)
            .order_by(CalculationLineModel.sort_order, CalculationLineModel.id)
        )
    )
    ledger = list(
        db.scalars(
            select(LedgerRecord)
            .where(LedgerRecord.company_id == cid, LedgerRecord.run_id == run_id)
            .order_by(LedgerRecord.id)
        )
    )
    factors = list(
        db.scalars(
            select(EmissionFactor)
            .where(EmissionFactor.company_id == cid)
            .order_by(EmissionFactor.id)
        )
    )

    now_iso = utc_now_iso()
    if report.status == "approved":
        report.status = "exported"
    run = db.scalar(select(PipelineRun).where(PipelineRun.company_id == cid, PipelineRun.id == run_id))
    if run and run.state == "approved":
        run.state = "exported"
        run.updated_at = now_iso
        run.steps_json = sync_run_steps(run.steps_json, "exported", now_iso)
        logs = list(run.logs_json or [])
        logs.insert(
            0,
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "exporter",
                "message": f"Exported {report.period} CBAM snapshot as {format.upper()}.",
                "targetId": report.id,
            },
        )
        run.logs_json = logs

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="export_report",
        target_type="report",
        target_id=report.id,
        detail=f"Exported {report.id} ({report.period}) as {format.upper()}.",
        ip_address=get_client_ip(request),
    )
    db.commit()
    if run:
        notify_run_update(run.id)

    if format == "pdf":
        content = build_report_pdf_bytes(
            company_name=company_name,
            report=report,
            calculations=calcs,
            ledger=ledger,
            carbon_price_eur=carbon_price,
        )
        filename = f"CarbonTrace_{report.period}_CBAM_Sample.pdf"
        media_type = "application/pdf"
    else:
        content = build_report_xlsx_bytes(
            company_name=company_name,
            report=report,
            calculations=calcs,
            ledger=ledger,
            factors=factors,
            carbon_price_eur=carbon_price,
        )
        filename = f"CarbonTrace_{report.period}_CBAM_Sample.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

