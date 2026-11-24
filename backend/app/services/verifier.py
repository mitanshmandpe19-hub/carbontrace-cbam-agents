"""Deterministic Verifier agent checking all 9 CBAM data integrity rules."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    CalculationLineModel,
    Document,
    EmissionFactor,
    LedgerRecord,
    PipelineRun,
    ReportSnapshot,
    VerificationFlag,
)

ALLOWED_Q3_PERIODS = {"2026-Q3", "2026-07", "2026-08", "2026-09"}


def _scoped_flag_id(run_id: str, base_id: str) -> str:
    return base_id if run_id == "RUN-2026-Q3" else f"{run_id}-{base_id}"


def _upsert_flag(
    existing_by_id: dict[str, VerificationFlag],
    db: Session,
    *,
    flag_id: str,
    company_id: str,
    run_id: str,
    code: str,
    severity: str,
    target_type: str,
    target_id: str,
    message: str,
    plain_explanation: str,
    suggested_fix: str,
) -> None:
    if flag_id in existing_by_id:
        flag = existing_by_id[flag_id]
        flag.code = code
        flag.severity = severity
        flag.target_type = target_type
        flag.target_id = target_id
        flag.message = message
        flag.plain_explanation = plain_explanation
        flag.suggested_fix = suggested_fix
        return

    new_flag = VerificationFlag(
        id=flag_id,
        company_id=company_id,
        run_id=run_id,
        code=code,
        severity=severity,
        target_type=target_type,
        target_id=target_id,
        message=message,
        plain_explanation=plain_explanation,
        suggested_fix=suggested_fix,
        status="open",
    )
    db.add(new_flag)
    existing_by_id[flag_id] = new_flag


def verify_run(db: Session, company_id: str, run_id: str = "RUN-2026-Q3") -> list[VerificationFlag]:
    """Run all 9 deterministic Verifier checks on the current company tenant's records."""
    docs = list(db.scalars(select(Document).where(Document.company_id == company_id)))
    records = list(
        db.scalars(
            select(LedgerRecord).where(
                LedgerRecord.company_id == company_id,
                LedgerRecord.run_id == run_id,
            )
        )
    )
    factors = list(
        db.scalars(select(EmissionFactor).where(EmissionFactor.company_id == company_id))
    )
    calcs = list(
        db.scalars(
            select(CalculationLineModel).where(
                CalculationLineModel.company_id == company_id,
                CalculationLineModel.run_id == run_id,
            )
        )
    )
    existing_flags = list(
        db.scalars(
            select(VerificationFlag).where(
                VerificationFlag.company_id == company_id,
                VerificationFlag.run_id == run_id,
            )
        )
    )

    flag_map: dict[str, VerificationFlag] = {f.id: f for f in existing_flags}
    rec_by_id = {r.id: r for r in records}
    active_records = [r for r in records if r.status not in ("rejected", "superseded")]

    # 1. NO_EVIDENCE
    for calc in calcs:
        for rec_id in calc.input_record_ids_json:
            rec = rec_by_id.get(rec_id)
            if rec is None or not rec.document_id or rec.page < 1 or not rec.quote.strip():
                _upsert_flag(
                    flag_map,
                    db,
                    flag_id=_scoped_flag_id(run_id, f"V-NOEV-{calc.id}-{rec_id}"),
                    company_id=company_id,
                    run_id=run_id,
                    code="NO_EVIDENCE",
                    severity="block",
                    target_type="calculation",
                    target_id=calc.id,
                    message=f"Calculation {calc.id} references missing evidence {rec_id}.",
                    plain_explanation="Every report number must trace back to an uploaded bill page and exact quote.",
                    suggested_fix="Upload the supporting source document and re-run extraction.",
                )

    # 2. RECALC_MISMATCH
    c_by_suffix = {c.id.split("-")[-1] if c.id.startswith("RUN-") else c.id: c for c in calcs}
    prod_rec = next((r for r in active_records if r.field == "product_tonnes_made"), None)
    if {"C-1", "C-2", "C-3", "C-4", "C-5", "C-6"}.issubset(c_by_suffix.keys()) and prod_rec and prod_rec.value > 0:
        independent = round(
            (
                c_by_suffix["C-1"].result
                + c_by_suffix["C-2"].result
                + c_by_suffix["C-3"].result
                + c_by_suffix["C-4"].result
                + c_by_suffix["C-5"].result
            )
            / prod_rec.value,
            2,
        )
        c6 = c_by_suffix["C-6"]
        if abs(independent - c6.result) > 0.02:
            _upsert_flag(
                flag_map,
                db,
                flag_id=_scoped_flag_id(run_id, "V-RECALC-C6"),
                company_id=company_id,
                run_id=run_id,
                code="RECALC_MISMATCH",
                severity="block",
                target_type="calculation",
                target_id=c6.id,
                message=f"Independent check got {independent} tCO2e/t vs stored {c6.result}.",
                plain_explanation="Verifier independently recalculated the total and found a discrepancy.",
                suggested_fix="Re-run the Python Calculator service.",
            )

    # 3. UNIT_MISMATCH (MWh vs kWh across electricity records)
    elec_active = [r for r in active_records if r.field in ("electricity_used", "electricity_log_check")]
    elec_units = {r.unit.strip().lower() for r in elec_active}
    if "kwh" in elec_units and "mwh" in elec_units:
        mwh_rec = next(r for r in elec_active if r.unit.strip().lower() == "mwh")
        _upsert_flag(
            flag_map,
            db,
            flag_id=_scoped_flag_id(run_id, "V-1"),
            company_id=company_id,
            run_id=run_id,
            code="UNIT_MISMATCH",
            severity="block",
            target_type="ledger_record",
            target_id=mwh_rec.id,
            message="Production log lists 45 MWh while electricity bills total 45,000 kWh.",
            plain_explanation=(
                "In Production Log Q3 2026.xlsx (row 14), electricity was typed as 45 MWh, while your three "
                "utility bills record consumption in kWh (14,000 + 16,000 + 15,000 = 45,000 kWh). Mixing MWh "
                "and kWh causes a 1,000x calculation error if left uncorrected."
            ),
            suggested_fix=(
                "Confirm kWh as the standard unit and supersede log row R-11 with verified utility bill totals (45,000 kWh)."
            ),
        )

    # 4. DUPLICATE_DOCUMENT (same file SHA-256 hash or invoice number across selected docs)
    seen_hashes: dict[str, Document] = {}
    seen_invoices: dict[str, Document] = {}
    for doc in sorted(docs, key=lambda d: d.id):
        if not doc.selected_for_run:
            continue
        dup_of: Document | None = None
        if doc.file_hash:
            if doc.file_hash in seen_hashes:
                dup_of = seen_hashes[doc.file_hash]
            else:
                seen_hashes[doc.file_hash] = doc
        if dup_of is None and doc.invoice_number:
            inv_norm = doc.invoice_number.strip().upper()
            if inv_norm in seen_invoices:
                dup_of = seen_invoices[inv_norm]
            else:
                seen_invoices[inv_norm] = doc
        if dup_of is not None:
            doc_records = [r for r in active_records if r.document_id == doc.id]
            target_rec = doc_records[0] if doc_records else None
            if doc.id == "D-05" or (target_rec and target_rec.id.endswith("R-05")):
                _upsert_flag(
                    flag_map,
                    db,
                    flag_id=_scoped_flag_id(run_id, "V-2"),
                    company_id=company_id,
                    run_id=run_id,
                    code="DUPLICATE_DOCUMENT",
                    severity="warn",
                    target_type="ledger_record",
                    target_id=target_rec.id if target_rec else "R-05",
                    message="Furnace oil invoice #FO-2026-884 was uploaded twice (D-04 and D-05).",
                    plain_explanation=(
                        "Furnace Oil Invoice Jul-Aug 2026 (copy).pdf has the exact same invoice number "
                        "(#FO-2026-884) and 10,000 L delivery as D-04. Counting both would double your direct furnace fuel emissions."
                    ),
                    suggested_fix="Mark duplicate record R-05 as superseded and keep only original invoice D-04.",
                )
            else:
                _upsert_flag(
                    flag_map,
                    db,
                    flag_id=_scoped_flag_id(run_id, f"V-DUP-{doc.id}"),
                    company_id=company_id,
                    run_id=run_id,
                    code="DUPLICATE_DOCUMENT",
                    severity="warn",
                    target_type="ledger_record" if target_rec else "document",
                    target_id=target_rec.id if target_rec else doc.id,
                    message=f"{doc.file_name} matches {dup_of.file_name} (same file hash or invoice).",
                    plain_explanation="Duplicate uploads risk double-counting energy or precursor volumes in CBAM math.",
                    suggested_fix="Review and confirm whether the second upload should be excluded.",
                )

    # 5. OUT_OF_RANGE
    for rec in active_records:
        if rec.value < 0 or (rec.field == "product_tonnes_made" and rec.value <= 0):
            _upsert_flag(
                flag_map,
                db,
                flag_id=_scoped_flag_id(run_id, f"V-RANGE-{rec.id}"),
                company_id=company_id,
                run_id=run_id,
                code="OUT_OF_RANGE",
                severity="block",
                target_type="ledger_record",
                target_id=rec.id,
                message=f"Value {rec.value} {rec.unit} on {rec.document_name} is out of valid range.",
                plain_explanation="Production mass must be positive and activity quantities cannot be negative.",
                suggested_fix="Correct the source record or replace with a valid bill.",
            )

    # 6. CROSS_DOC_CONFLICT
    exp_rec = next((r for r in active_records if r.field == "eu_exported_tonnes"), None)
    if prod_rec and exp_rec and exp_rec.value > prod_rec.value * 1.05:
        _upsert_flag(
            flag_map,
            db,
            flag_id=_scoped_flag_id(run_id, f"V-CROSS-{exp_rec.id}"),
            company_id=company_id,
            run_id=run_id,
            code="CROSS_DOC_CONFLICT",
            severity="block",
            target_type="ledger_record",
            target_id=exp_rec.id,
            message=f"EU shipment weight ({exp_rec.value} t) exceeds plant output ({prod_rec.value} t).",
            plain_explanation="Exported CBAM tonnage in the packing list cannot exceed manufactured production in the same log.",
            suggested_fix="Cross-check opening inventory or fix shipment log weight.",
        )

    # 7. PERIOD_MISMATCH
    for rec in active_records:
        if rec.period not in ALLOWED_Q3_PERIODS:
            _upsert_flag(
                flag_map,
                db,
                flag_id=_scoped_flag_id(run_id, f"V-PER-{rec.id}"),
                company_id=company_id,
                run_id=run_id,
                code="PERIOD_MISMATCH",
                severity="warn",
                target_type="ledger_record",
                target_id=rec.id,
                message=f"Record {rec.id} is dated {rec.period}, outside target period {ALLOWED_Q3_PERIODS}.",
                plain_explanation="Invoices dated outside Q3 2026 should be filed under their respective reporting quarter.",
                suggested_fix="Exclude out-of-period record from this Q3 run.",
            )

    # 8. FACTOR_NO_SOURCE
    for factor in factors:
        src_lower = factor.source.lower()
        is_missing_src = (
            not factor.source.strip()
            or "missing" in src_lower
            or "without evidence" in src_lower
            or "no source" in src_lower
        )
        if is_missing_src:
            flag_id = _scoped_flag_id(run_id, "V-4" if factor.id == "F-6" else f"V-FNS-{factor.id}")
            _upsert_flag(
                flag_map,
                db,
                flag_id=flag_id,
                company_id=company_id,
                run_id=run_id,
                code="FACTOR_NO_SOURCE",
                severity="block",
                target_type="emission_factor",
                target_id=factor.id,
                message=f"Hand-typed annealing gas factor ({factor.value} {factor.unit}) has no official or supplier source.",
                plain_explanation=(
                    "Floor Supervisor Note proposes a manual emission factor of 0.0021 tCO2e/kg with no laboratory "
                    "sheet, utility certificate, or factor table citation. CarbonTrace never allows unsourced numbers "
                    "into an EU CBAM report."
                ),
                suggested_fix="Reject unsourced factor R-13 / F-6 so only documented, sourced factors enter the calculation.",
            )

    # 9. SUPPLIER_CONFLICT
    inv_wire = next((r for r in active_records if r.field == "precursor_wire_rod_tonnes"), None)
    reply_wire = next((r for r in active_records if r.field == "precursor_wire_rod_tonnes_reply"), None)
    if inv_wire and reply_wire and abs(inv_wire.value - reply_wire.value) > 0.01:
        _upsert_flag(
            flag_map,
            db,
            flag_id=_scoped_flag_id(run_id, "V-3"),
            company_id=company_id,
            run_id=run_id,
            code="SUPPLIER_CONFLICT",
            severity="block",
            target_type="ledger_record",
            target_id=reply_wire.id,
            message=f"Sample Steel Wire Co. message states {reply_wire.value:g} tonnes supplied, but invoice #SWC-9012 bills {inv_wire.value:g} tonnes.",
            plain_explanation=(
                "Your purchase invoice D-07 from Sample Steel Wire Co. is billed for 45.0 tonnes of wire rod, "
                "whereas the supplier's WhatsApp note mentions 40 tonnes. CBAM requires precursor mass to match "
                "the invoiced delivery weight."
            ),
            suggested_fix="Verify weighbridge receipt and resolve in favour of signed tax invoice R-07 (45.0 tonnes).",
        )

    db.flush()

    all_flags = list(
        db.scalars(
            select(VerificationFlag)
            .where(
                VerificationFlag.company_id == company_id,
                VerificationFlag.run_id == run_id,
            )
            .order_by(VerificationFlag.id)
        )
    )
    open_blockers = sum(1 for f in all_flags if f.severity == "block" and f.status == "open")

    run = db.scalar(
        select(PipelineRun).where(
            PipelineRun.company_id == company_id,
            PipelineRun.id == run_id,
        )
    )
    target_report = db.scalar(
        select(ReportSnapshot).where(
            ReportSnapshot.company_id == company_id,
            ReportSnapshot.run_id == run_id,
        )
    ) or db.scalar(
        select(ReportSnapshot).where(
            ReportSnapshot.company_id == company_id,
            ReportSnapshot.period == "2026-Q3",
        )
    )
    if run and target_report:
        if target_report.status == "approved":
            run.state = "exported" if run.state == "exported" else "approved"
            run.active_agent = "exporter"
        elif target_report.status == "exported":
            run.state = "exported"
            run.active_agent = "exporter"
        elif open_blockers == 0:
            if run.state in ("needs_fixes", "verifying"):
                run.state = "ready_for_approval"
                run.active_agent = "exporter"
                target_report.status = "ready_for_approval"
        else:
            if run.state == "ready_for_approval":
                run.state = "needs_fixes"
                run.active_agent = "verifier"
                target_report.status = "draft"

    db.flush()
    return all_flags
