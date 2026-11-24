from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Supplier, User
from app.routers.serializers import serialize_supplier
from app.schemas import SupplierSchema

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


@router.get("", response_model=list[SupplierSchema])
def list_suppliers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = list(
        db.scalars(
            select(Supplier)
            .where(Supplier.company_id == current_user.company_id)
            .order_by(Supplier.data_quality_score.desc(), Supplier.id)
        )
    )
    return [serialize_supplier(s) for s in rows]


@router.get("/{supplier_id}", response_model=SupplierSchema)
def get_supplier(
    supplier_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sup = db.scalar(
        select(Supplier).where(
            Supplier.company_id == current_user.company_id,
            Supplier.id == supplier_id,
        )
    )
    if sup is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found.",
        )
    return serialize_supplier(sup)

