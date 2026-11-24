from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import (
    Company,
    GapItemModel,
    OutreachRequest,
    PipelineRun,
    ReportSnapshot,
    User,
    VerificationFlag,
)
from app.schemas import DashboardNextStepSchema, DashboardSummarySchema
from app.services.calculator import recompute_run_calculations
from app.services.verifier import verify_run

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSummarySchema)
def get_dashboard(
    period: str = Query(default="2026-Q3"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    recompute_run_calculations(db, cid, "RUN-2026-Q3")
    flags = verify_run(db, cid, "RUN-2026-Q3")
    db.commit()

    company = db.scalar(select(Company).where(Company.id == cid))
    run = db.scalar(select(PipelineRun).where(PipelineRun.company_id == cid))
    reports = list(
        db.scalars(
            select(ReportSnapshot)
            .where(ReportSnapshot.company_id == cid)
            .order_by(ReportSnapshot.period)
        )
    )
    q3 = next((r for r in reports if r.period == period), reports[-1])
    q2 = next((r for r in reports if r.period == "2026-Q2"), q3)

    open_gaps = list(
        db.scalars(
            select(GapItemModel).where(
                GapItemModel.company_id == cid,
                GapItemModel.status == "open",
            )
        )
    )
    open_blockers = sum(1 for f in flags if f.severity == "block" and f.status == "open")
    open_warnings = sum(1 for f in flags if f.severity == "warn" and f.status == "open")
    pending_outreach = db.scalar(
        select(OutreachRequest).where(
            OutreachRequest.company_id == cid,
            OutreachRequest.status == "draft",
        )
    )

    if pending_outreach is not None:
        next_step = DashboardNextStepSchema(
            title=f"Approve supplier WhatsApp request ({pending_outreach.supplier})",
            description=(
                "Wire rod emissions are using a high EU default fallback right now. Approve Outreach "
                "draft O-1 and simulate the supplier reply to lower Q3 intensity."
            ),
            href="/app/outreach",
            ctaLabel="Review & approve message",
            accent="outreach",
        )
    elif open_blockers > 0:
        next_step = DashboardNextStepSchema(
            title=f"Resolve {open_blockers} blocking Verifier {'flag' if open_blockers == 1 else 'flags'}",
            description=(
                "The Verifier agent has blocked final CBAM report approval until unit mismatch, "
                "supplier conflict, and unsourced factor flags are resolved."
            ),
            href="/app/verification",
            ctaLabel="Fix blocking issues",
            accent="verifier",
        )
    elif q3.status != "approved" and (run is None or run.state != "exported"):
        next_step = DashboardNextStepSchema(
            title="Approve & export your Q3 2026 CBAM report",
            description=(
                "All blocking checks passed and supplier evidence is verified. Review click-to-source "
                "numbers and approve the Q3 snapshot."
            ),
            href="/app/report",
            ctaLabel="Open Q3 report",
            accent="exporter",
        )
    else:
        next_step = DashboardNextStepSchema(
            title="Q3 2026 report approved — view trend & exports",
            description=(
                "Download audit-ready PDF or Excel reports, or inspect Q1-Q3 intensity reductions across suppliers."
            ),
            href="/app/history",
            ctaLabel="View Q1-Q3 history",
            accent="calculator",
        )

    actual_share = float((q3.basis_summary_json or {}).get("actual", 0.0))

    return DashboardSummarySchema(
        companyName=company.name if company else "Demo Fasteners Pvt Ltd",
        isSample=company.is_sample if company else True,
        period=q3.period,
        product=q3.product,
        cnCode=company.cn_code if company else "7318 15",
        buyerName=company.buyer_name if company else "EuroBolt GmbH (Hamburg, Germany)",
        runId=run.id if run else "RUN-2026-Q3",
        runState=run.state if run else "needs_fixes",
        emissionsPerTonne=q3.emissions_per_tonne,
        previousEmissionsPerTonne=q2.emissions_per_tonne,
        euDefaultPerTonne=q3.eu_default_per_tonne,
        totalProductionTonnes=q3.total_production_tonnes,
        exportedTonnes=q3.exported_tonnes,
        defaultCarbonPriceEur=company.default_carbon_price_eur if company else 85.0,
        openGapsCount=len(open_gaps),
        openBlockFlagsCount=open_blockers,
        openWarnFlagsCount=open_warnings,
        actualSharePct=round(actual_share * 100),
        nextStep=next_step,
    )

