from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import CalculationLineModel, EmissionFactor, User
from app.routers.serializers import serialize_calculation, serialize_factor
from app.schemas import CalculationLineSchema, EmissionFactorSchema
from app.services.calculator import recompute_run_calculations

calculations_router = APIRouter(prefix="/api/calculations", tags=["calculations"])
factors_router = APIRouter(prefix="/api/factors", tags=["factors"])


@calculations_router.get("", response_model=list[CalculationLineSchema])
def list_calculations(
    runId: str = Query(default="RUN-2026-Q3"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recompute_run_calculations(db, current_user.company_id, runId)
    db.commit()
    rows = list(
        db.scalars(
            select(CalculationLineModel)
            .where(
                CalculationLineModel.company_id == current_user.company_id,
                CalculationLineModel.run_id == runId,
            )
            .order_by(CalculationLineModel.sort_order, CalculationLineModel.id)
        )
    )
    return [serialize_calculation(c) for c in rows]


@factors_router.get("", response_model=list[EmissionFactorSchema])
def list_factors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = list(
        db.scalars(
            select(EmissionFactor)
            .where(EmissionFactor.company_id == current_user.company_id)
            .order_by(EmissionFactor.id)
        )
    )
    return [serialize_factor(f) for f in rows]

