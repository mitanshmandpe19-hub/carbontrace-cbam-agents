from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import GapItemModel, User
from app.routers.serializers import serialize_gap
from app.schemas import GapItemSchema

router = APIRouter(prefix="/api/gaps", tags=["gaps"])


@router.get("", response_model=list[GapItemSchema])
def list_gaps(
    runId: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(GapItemModel).where(GapItemModel.company_id == current_user.company_id)
    if runId:
        stmt = stmt.where(GapItemModel.run_id == runId)
    rows = list(db.scalars(stmt.order_by(GapItemModel.id)))
    return [serialize_gap(g) for g in rows]

