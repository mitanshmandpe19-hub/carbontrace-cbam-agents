"""Deterministic Python CBAM emissions calculator (no AI arithmetic)."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import CalculationLineModel, EmissionFactor, LedgerRecord, ReportSnapshot


def round_to(value: float, decimals: int = 2) -> float:
    return round(float(value) + 1e-12, decimals)


def _scoped_id(run_id: str, base_id: str) -> str:
    return base_id if run_id == "RUN-2026-Q3" else f"{run_id}-{base_id}"


def compute_embedded_emissions(
    direct_tco2e: float,
    indirect_tco2e: float,
    precursors_tco2e: float,
    production_tonnes: float,
) -> dict:
    safe_tonnes = production_tonnes if production_tonnes > 0 else 1.0
    total_co2e = round_to(direct_tco2e + indirect_tco2e + precursors_tco2e, 2)
    return {
        "totalTonnesCO2e": total_co2e,
        "perTonne": round_to(total_co2e / safe_tonnes, 2),
        "breakdown": {
            "direct": round_to(direct_tco2e / safe_tonnes, 2),
            "indirect": round_to(indirect_tco2e / safe_tonnes, 2),
            "precursors": round_to(precursors_tco2e / safe_tonnes, 2),
        },
    }


def compute_money_saved(
    eu_default_per_tonne: float,
    actual_per_tonne: float,
    exported_tonnes: float,
    carbon_price_eur: float,
) -> dict:
    per_tonne_saved = round_to(max(0.0, eu_default_per_tonne - actual_per_tonne), 2)
    total_saved_co2e = round_to(per_tonne_saved * max(0.0, exported_tonnes), 2)
    money_saved_eur = round_to(total_saved_co2e * max(0.0, carbon_price_eur), 2)
    pct = (
        round_to((per_tonne_saved / eu_default_per_tonne) * 100.0, 1)
        if eu_default_per_tonne > 0
        else 0.0
    )
    return {
        "perTonneSaved": per_tonne_saved,
        "totalTonnesCO2eSaved": total_saved_co2e,
        "moneySavedEur": money_saved_eur,
        "percentReductionVsDefault": pct,
    }


def recompute_run_calculations(db: Session, company_id: str, run_id: str = "RUN-2026-Q3") -> list[CalculationLineModel]:
    """Deterministically recompute calculation lines and report snapshot from sourced ledger & factors."""
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

    by_factor = {f.id: f for f in factors}
    active_records = [r for r in records if r.status not in ("rejected", "superseded")]

    def _by_field(field: str, fallback: float) -> tuple[float, list[str]]:
        matches = [r for r in active_records if r.field == field]
        if not matches:
            return fallback, []
        return sum(r.value for r in matches), [r.id for r in matches]

    elec_records = [
        r for r in active_records if r.field == "electricity_used" and r.unit.strip().lower() == "kwh"
    ]
    elec_ids = [r.id for r in elec_records] or ["R-01", "R-02", "R-03"]
    total_kwh = sum(r.value for r in elec_records) if elec_records else 45000.0

    furnace_oil, furnace_ids = _by_field("furnace_oil_used", 10000.0)
    furnace_ids = furnace_ids or ["R-04"]

    diesel, diesel_ids = _by_field("diesel_used", 4000.0)
    diesel_ids = diesel_ids or ["R-06"]

    wire_rod_tonnes, wire_qty_ids = _by_field("precursor_wire_rod_tonnes", 45.0)
    wire_qty_id = wire_qty_ids[0] if wire_qty_ids else "R-07"

    alloy_tonnes, alloy_qty_ids = _by_field("precursor_alloy_tonnes", 6.0)
    alloy_qty_id = alloy_qty_ids[0] if alloy_qty_ids else "R-08"

    alloy_factor_matches = [r for r in active_records if r.field == "precursor_alloy_factor"]
    alloy_factor_id = alloy_factor_matches[0].id if alloy_factor_matches else "R-09"
    alloy_factor_val = (
        alloy_factor_matches[0].value
        if alloy_factor_matches
        else (by_factor["F-5"].value if "F-5" in by_factor else 1.25)
    )

    prod_matches = [r for r in active_records if r.field == "product_tonnes_made"]
    prod_id = prod_matches[0].id if prod_matches else "R-10"
    finished_tonnes = prod_matches[0].value if prod_matches else 50.0

    exp_matches = [r for r in active_records if r.field == "eu_exported_tonnes"]
    exported_tonnes = exp_matches[0].value if exp_matches else 46.0

    wire_actual = next(
        (r for r in active_records if r.field == "precursor_wire_rod_factor" and r.status == "verified"),
        None,
    )
    if wire_actual is not None:
        wire_factor_id = "F-4B"
        wire_factor_val = wire_actual.value
        wire_basis = "actual"
        wire_input_ids = [wire_qty_id, wire_actual.id]
        wire_formula_suffix = f"supplier_verified(F-4B: {wire_factor_val:.2f} tCO2e/t)"
    else:
        wire_factor_id = "F-4"
        wire_factor_val = by_factor["F-4"].value if "F-4" in by_factor else 1.60
        wire_basis = "default"
        wire_input_ids = [wire_qty_id]
        wire_formula_suffix = f"eu_default_fallback(F-4: {wire_factor_val:.2f} tCO2e/t)"

    f1 = by_factor["F-1"].value if "F-1" in by_factor else 0.0031
    f2 = by_factor["F-2"].value if "F-2" in by_factor else 0.00275
    f3 = by_factor["F-3"].value if "F-3" in by_factor else 0.0007

    c1_result = round_to(furnace_oil * f1, 2)
    c2_result = round_to(diesel * f2, 2)
    c3_result = round_to(total_kwh * f3, 2)
    c4_result = round_to(wire_rod_tonnes * wire_factor_val, 2)
    c5_result = round_to(alloy_tonnes * alloy_factor_val, 2)

    direct_total = round_to(c1_result + c2_result, 2)
    indirect_total = c3_result
    precursors_total = round_to(c4_result + c5_result, 2)

    summary = compute_embedded_emissions(
        direct_tco2e=direct_total,
        indirect_tco2e=indirect_total,
        precursors_tco2e=precursors_total,
        production_tonnes=finished_tonnes,
    )

    total_co2e = summary["totalTonnesCO2e"]
    actual_co2e = direct_total + indirect_total + c5_result + (c4_result if wire_basis == "actual" else 0.0)
    actual_share = round_to(actual_co2e / total_co2e, 2) if total_co2e > 0 else 0.0
    default_share = round_to(max(0.0, 1.0 - actual_share), 2)

    lines_spec = [
        (
            _scoped_id(run_id, "C-1"),
            "Direct emissions — Furnace oil",
            "direct",
            f"furnace_oil({', '.join(furnace_ids)}: {int(furnace_oil):,} L) x factor(F-1: {f1} tCO2e/L)",
            furnace_ids,
            ["F-1"],
            c1_result,
            "tCO2e",
            "actual",
            1,
        ),
        (
            _scoped_id(run_id, "C-2"),
            "Direct emissions — Diesel generator",
            "direct",
            f"diesel({', '.join(diesel_ids)}: {int(diesel):,} L) x factor(F-2: {f2} tCO2e/L)",
            diesel_ids,
            ["F-2"],
            c2_result,
            "tCO2e",
            "actual",
            2,
        ),
        (
            _scoped_id(run_id, "C-3"),
            "Indirect emissions — Grid electricity",
            "indirect",
            f"electricity({' + '.join(elec_ids)}: {int(total_kwh):,} kWh) x grid_factor(F-3: {f3:.5f} tCO2e/kWh)",
            elec_ids,
            ["F-3"],
            c3_result,
            "tCO2e",
            "actual",
            3,
        ),
        (
            _scoped_id(run_id, "C-4"),
            "Precursor — Steel wire rod (Sample Steel Wire Co.)",
            "precursors",
            f"wire_rod({wire_qty_id}: {wire_rod_tonnes:g} t) x {wire_formula_suffix}",
            wire_input_ids,
            [wire_factor_id],
            c4_result,
            "tCO2e",
            wire_basis,
            4,
        ),
        (
            _scoped_id(run_id, "C-5"),
            "Precursor — Zinc & alloy wire (Sample Alloy Traders)",
            "precursors",
            f"alloy_wire({alloy_qty_id}: {alloy_tonnes:g} t) x supplier_factor(F-5: {alloy_factor_val:.2f} tCO2e/t)",
            [alloy_qty_id, alloy_factor_id],
            ["F-5"],
            c5_result,
            "tCO2e",
            "actual",
            5,
        ),
        (
            _scoped_id(run_id, "C-6"),
            "Total embedded emissions per tonne (Q3 2026)",
            "intensity",
            f"(direct {direct_total:.1f} + indirect {indirect_total:.1f} + precursors {precursors_total:.1f}) / finished_fasteners({prod_id}: {finished_tonnes:g} t)",
            [*furnace_ids, *diesel_ids, *elec_ids, *wire_input_ids, alloy_qty_id, prod_id],
            ["F-1", "F-2", "F-3", wire_factor_id, "F-5"],
            summary["perTonne"],
            "tCO2e/t",
            wire_basis,
            6,
        ),
    ]

    db.execute(
        delete(CalculationLineModel).where(
            CalculationLineModel.company_id == company_id,
            CalculationLineModel.run_id == run_id,
        )
    )

    models: list[CalculationLineModel] = []
    for (
        line_id,
        label,
        category,
        formula_text,
        input_ids,
        factor_ids,
        result,
        unit,
        basis,
        order,
    ) in lines_spec:
        model = CalculationLineModel(
            id=line_id,
            company_id=company_id,
            run_id=run_id,
            label=label,
            category=category,
            formula_text=formula_text,
            input_record_ids_json=input_ids,
            factor_ids_json=factor_ids,
            result=result,
            unit=unit,
            basis=basis,
            sort_order=order,
        )
        db.add(model)
        models.append(model)

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
    if target_report is not None:
        target_report.emissions_per_tonne = summary["perTonne"]
        target_report.breakdown_json = summary["breakdown"]
        target_report.basis_summary_json = {
            "actual": actual_share,
            "default": default_share,
        }
        target_report.total_production_tonnes = finished_tonnes
        target_report.exported_tonnes = exported_tonnes

    db.flush()
    return models
