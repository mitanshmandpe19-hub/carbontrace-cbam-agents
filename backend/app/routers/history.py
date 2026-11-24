from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import ReportSnapshot, User
from app.routers.serializers import serialize_report
from app.schemas import HistoryResponseSchema, PeriodDeltaDriverSchema, PeriodDeltaGroupSchema
from app.services.calculator import recompute_run_calculations

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("", response_model=HistoryResponseSchema)
def get_history(
    product: str = Query(default="Steel Fasteners (CN 7318 15)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    recompute_run_calculations(db, cid, "RUN-2026-Q3")
    db.commit()

    snapshots = list(
        db.scalars(
            select(ReportSnapshot)
            .where(ReportSnapshot.company_id == cid)
            .order_by(ReportSnapshot.period)
        )
    )

    deltas: list[PeriodDeltaGroupSchema] = []
    if len(snapshots) >= 2:
        q1, q2 = snapshots[0], snapshots[1]
        deltas.append(
            PeriodDeltaGroupSchema(
                fromPeriod=q1.period,
                toPeriod=q2.period,
                totalDelta=round(q2.emissions_per_tonne - q1.emissions_per_tonne, 2),
                drivers=[
                    PeriodDeltaDriverSchema(
                        label="More verified supplier data (+16% actual)",
                        delta=-0.08,
                        reason="Sample Alloy Traders provided mill emission sheet, replacing EU default.",
                    ),
                    PeriodDeltaDriverSchema(
                        label="Lower furnace oil & grid usage",
                        delta=-0.09,
                        reason="Furnace scheduling cut fuel and kWh consumption per tonne.",
                    ),
                ],
            )
        )
    if len(snapshots) >= 3:
        q2, q3 = snapshots[1], snapshots[2]
        q3_diff = round(q3.emissions_per_tonne - q2.emissions_per_tonne, 2)
        wire_is_actual = float((q3.basis_summary_json or {}).get("default", 0.0)) == 0.0
        drivers = (
            [
                PeriodDeltaDriverSchema(
                    label="EAF wire rod reply replaced EU default",
                    delta=-0.08,
                    reason="Sample Steel Wire Co. WhatsApp reply (0.90 tCO2e/t) replaced 1.60 tCO2e/t fallback.",
                ),
                PeriodDeltaDriverSchema(
                    label="Furnace & grid efficiency gain",
                    delta=-0.10,
                    reason="Direct & indirect intensity improved from 1.57 to 1.47 tCO2e/t.",
                ),
            ]
            if wire_is_actual
            else [
                PeriodDeltaDriverSchema(
                    label="Wire rod temporarily on EU default",
                    delta=0.55,
                    reason="Waiting on Sample Steel Wire Co. reply; EU fallback 1.60 tCO2e/t pushes precursors up.",
                ),
                PeriodDeltaDriverSchema(
                    label="Direct & electricity efficiency gain",
                    delta=-0.10,
                    reason="Plant direct + electricity intensity improved from 1.57 to 1.47 tCO2e/t.",
                ),
            ]
        )
        deltas.append(
            PeriodDeltaGroupSchema(
                fromPeriod=q2.period,
                toPeriod=q3.period,
                totalDelta=q3_diff,
                drivers=drivers,
            )
        )

    display_product = (
        "Steel Fasteners (CN 7318 15)"
        if product.lower() in ("steel-fasteners", "steel fasteners")
        else product
    )
    return HistoryResponseSchema(
        product=display_product,
        snapshots=[serialize_report(s) for s in snapshots],
        deltas=deltas,
    )

