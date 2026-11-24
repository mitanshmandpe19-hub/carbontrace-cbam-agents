"""Gap Finder service: compares active Evidence Ledger against required steel fastener CBAM fields."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import write_audit_log
from app.models import GapItemModel, LedgerRecord, Supplier

REQUIRED_FASTENER_FIELDS: list[tuple[str, str, str | None]] = [
    (
        "electricity_used",
        "Electricity consumption in kWh across the reporting quarter.",
        None,
    ),
    (
        "furnace_oil_used",
        "Fuel quantity burned for direct heat treatment (furnace oil / diesel).",
        None,
    ),
    (
        "precursor_wire_rod_tonnes",
        "Purchased steel wire rod precursor mass in tonnes.",
        "SUP-01",
    ),
    (
        "precursor_wire_rod_factor",
        "Embedded emissions per tonne missing for 45 t wire rod from Sample Steel Wire Co.",
        "SUP-01",
    ),
    (
        "product_tonnes_made",
        "Total finished steel fasteners produced in tonnes.",
        None,
    ),
    (
        "eu_exported_tonnes",
        "EU CBAM exported shipment tonnes for the quarter.",
        None,
    ),
]


def _scoped(run_id: str, base_id: str) -> str:
    return base_id if run_id == "RUN-2026-Q3" else f"{run_id}-{base_id}"


def find_gaps(
    db: Session,
    *,
    company_id: str,
    run_id: str,
    user_id: str | None = None,
) -> list[GapItemModel]:
    """Compare ledger records against required CBAM fields and persist open/resolved gaps."""
    records = list(
        db.scalars(
            select(LedgerRecord).where(
                LedgerRecord.company_id == company_id,
                LedgerRecord.run_id == run_id,
            )
        )
    )
    active_verified_fields = {r.field for r in records if r.status == "verified"}
    suppliers_by_id = {
        s.id: s
        for s in db.scalars(select(Supplier).where(Supplier.company_id == company_id))
    }
    existing_gaps = list(
        db.scalars(
            select(GapItemModel).where(
                GapItemModel.company_id == company_id,
                GapItemModel.run_id == run_id,
            )
        )
    )
    gap_by_field = {g.field: g for g in existing_gaps}
    detected_open: list[str] = []

    for req_field, desc, sup_id in REQUIRED_FASTENER_FIELDS:
        has_field = req_field in active_verified_fields
        if req_field == "furnace_oil_used" and not has_field and "diesel_used" in active_verified_fields:
            has_field = True

        sup = suppliers_by_id.get(sup_id) if sup_id else None
        existing = gap_by_field.get(req_field)

        if has_field:
            if existing and existing.status == "open":
                existing.status = "resolved_actual"
        else:
            detected_open.append(req_field)
            if existing is None:
                base_gid = "G-1" if req_field == "precursor_wire_rod_factor" else f"G-{len(gap_by_field) + 1}"
                gap_id = _scoped(run_id, base_gid)
                new_gap = GapItemModel(
                    id=gap_id,
                    company_id=company_id,
                    run_id=run_id,
                    field=req_field,
                    description=desc,
                    supplier_id=sup.id if sup else None,
                    supplier_name=sup.name if sup else None,
                    status="open",
                    outreach_request_id=_scoped(run_id, "O-1") if req_field == "precursor_wire_rod_factor" else None,
                )
                db.add(new_gap)
                gap_by_field[req_field] = new_gap
            elif existing.status == "resolved_actual":
                existing.status = "open"

    write_audit_log(
        db,
        company_id=company_id,
        user_id=user_id,
        action="gap_finder_check",
        target_type="run",
        target_id=run_id,
        detail=f"Checked required fastener CBAM fields; missing fields: {detected_open or ['none']}.",
    )
    db.flush()
    return list(
        db.scalars(
            select(GapItemModel)
            .where(GapItemModel.company_id == company_id, GapItemModel.run_id == run_id)
            .order_by(GapItemModel.id)
        )
    )
