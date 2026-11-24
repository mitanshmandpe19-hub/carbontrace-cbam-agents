from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import LedgerRecord, User
from app.routers.serializers import serialize_ledger_record
from app.schemas import LedgerRecordSchema

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("", response_model=list[LedgerRecordSchema])
def list_ledger(
    runId: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(LedgerRecord).where(LedgerRecord.company_id == current_user.company_id)
    if runId:
        stmt = stmt.where(LedgerRecord.run_id == runId)
    rows = list(db.scalars(stmt.order_by(LedgerRecord.id)))
    return [serialize_ledger_record(r) for r in rows]


@router.get("/{record_id}", response_model=LedgerRecordSchema)
def get_ledger_record(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = db.scalar(
        select(LedgerRecord).where(
            LedgerRecord.company_id == current_user.company_id,
            LedgerRecord.id == record_id,
        )
    )
    if rec is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ledger record not found.",
        )
    return serialize_ledger_record(rec)

