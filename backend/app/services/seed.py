"""Seed initial fictional Demo Fasteners Pvt Ltd data when DB is empty."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import settings
from app.models import (
    CalculationLineModel,
    Company,
    Document,
    EmissionFactor,
    GapItemModel,
    LedgerRecord,
    OutreachMessageModel,
    OutreachRequest,
    PipelineRun,
    ReportSnapshot,
    Supplier,
    User,
    VerificationFlag,
)
from app.services.calculator import recompute_run_calculations
from app.services.orchestrator import sync_run_steps
from app.services.verifier import verify_run
from scripts.generate_sample_data import generate_all

SEED_FIXTURES_DIRS = [
    Path(__file__).resolve().parent.parent.parent / "seed_fixtures",
    Path(__file__).resolve().parent.parent / "seed_fixtures",
    Path(__file__).resolve().parent.parent.parent.parent / "src" / "mock",
]


def _load_frontend_mock(name: str) -> list[dict]:
    for directory in SEED_FIXTURES_DIRS:
        path = directory / f"{name}.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    return []


def _extract_invoice_number(doc_dict: dict) -> str | None:
    summary = str(doc_dict.get("summary", ""))
    for token in ("#FO-2026-884", "#DL-2026-412", "#SWC-9012", "#AT-319"):
        if token in summary:
            return token
    return None


def seed_database_if_empty(db: Session, *, force_reset_demo: bool = False) -> bool:
    """Seed Demo Fasteners Pvt Ltd, sample documents, Q1/Q2/Q3 snapshots, factors, and users if empty."""
    # Always ensure sample binary files exist on disk (important for ephemeral hosting like Render/Railway)
    sample_files_meta = generate_all(settings.resolved_sample_data_dir)

    existing_companies = db.scalar(select(func.count(Company.id))) or 0
    if existing_companies > 0 and not force_reset_demo:
        return False

    if force_reset_demo:
        # Reset tenant rows for Demo Fasteners Pvt Ltd cleanly while preserving users
        for model in (
            OutreachMessageModel,
            OutreachRequest,
            GapItemModel,
            VerificationFlag,
            CalculationLineModel,
            LedgerRecord,
            ReportSnapshot,
            PipelineRun,
            EmissionFactor,
            Supplier,
            Document,
        ):
            db.query(model).filter(model.company_id == "COMP-DEMO-01").delete(synchronize_session=False)
        db.flush()

    company = db.scalar(select(Company).where(Company.id == "COMP-DEMO-01"))
    if company is None:
        company = Company(
            id="COMP-DEMO-01",
            name="Demo Fasteners Pvt Ltd",
            is_sample=True,
            product_name="Steel Fasteners (CN 7318 15)",
            cn_code="7318 15",
            buyer_name="EuroBolt GmbH (Hamburg, Germany)",
            default_carbon_price_eur=85.0,
            eu_default_per_tonne=3.45,
            created_at="2026-10-01T08:00:00Z",
        )
        db.add(company)

    if not force_reset_demo:
        demo_pw_hash = hash_password(settings.demo_user_password)
        demo_user = User(
            id="USR-DEMO-01",
            company_id=company.id,
            email="demo@demofasteners.in",
            name="Demo Fasteners User",
            hashed_password=demo_pw_hash,
            role="exporter",
            is_demo=True,
            created_at="2026-10-01T08:05:00Z",
        )
        manager_user = User(
            id="USR-DEMO-02",
            company_id=company.id,
            email="owner@demofasteners.in",
            name="Plant Owner (Demo)",
            hashed_password=demo_pw_hash,
            role="exporter",
            is_demo=False,
            created_at="2026-10-01T08:06:00Z",
        )
        db.add_all([demo_user, manager_user])

    # Seed sample documents
    for d in _load_frontend_mock("documents"):
        doc_id = d["id"]
        file_meta = sample_files_meta.get(doc_id, {})
        stored_name = file_meta.get("stored_filename")
        stored_path = settings.resolved_sample_data_dir / stored_name if stored_name else None
        file_size = stored_path.stat().st_size if stored_path and stored_path.exists() else 0

        db.add(
            Document(
                id=doc_id,
                company_id=company.id,
                file_name=d["fileName"],
                stored_filename=stored_name,
                mime_type=(
                    "application/pdf"
                    if d["formatLabel"] == "PDF"
                    else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    if d["formatLabel"] == "Excel"
                    else "text/plain"
                ),
                file_hash=file_meta.get("file_hash"),
                invoice_number=_extract_invoice_number(d),
                file_size_bytes=file_size,
                doc_type=d["docType"],
                format_label=d["formatLabel"],
                period=d["period"],
                summary=d["summary"],
                uploaded_at=d["uploadedAt"],
                is_sample=True,
                selected_for_run=d.get("selectedForRun", True),
                duplicate_of_id=d.get("duplicateOfId"),
                preview_pages_json=d.get("previewPages", []),
            )
        )

    # Seed illustrative emission factors
    for f in _load_frontend_mock("factors"):
        db.add(
            EmissionFactor(
                id=f["id"],
                company_id=company.id,
                name=f["name"],
                value=float(f["value"]),
                unit=f["unit"],
                year=int(f["year"]),
                source=f["source"],
                source_url=f.get("sourceUrl"),
                is_illustrative=True,
            )
        )

    # Seed ledger records
    for r in _load_frontend_mock("ledger"):
        db.add(
            LedgerRecord(
                id=r["id"],
                company_id=company.id,
                run_id="RUN-2026-Q3",
                document_id=r["documentId"],
                document_name=r["documentName"],
                page=int(r["page"]),
                quote=r["quote"],
                field=r["field"],
                value=float(r["value"]),
                unit=r["unit"],
                period=r["period"],
                extracted_by=r["extractedBy"],
                confidence=float(r["confidence"]),
                status=r["status"],
                created_at=r.get("createdAt", "2026-10-02T09:26:00Z"),
            )
        )

    # Seed suppliers
    for s in _load_frontend_mock("suppliers"):
        db.add(
            Supplier(
                id=s["id"],
                company_id=company.id,
                name=s["name"],
                contact=s["contact"],
                language=s["language"],
                products_json=s["products"],
                volume_by_period_json=s["volumeByPeriod"],
                emissions_per_tonne=float(s["emissionsPerTonne"]),
                avg_reply_hours=float(s["avgReplyHours"]),
                data_quality_score=int(s["dataQualityScore"]),
                last_verified_at=s["lastVerifiedAt"],
            )
        )

    # Seed outreach requests & messages
    outreach_rows = _load_frontend_mock("outreach")
    demo_future_iso = (
        (datetime.now(timezone.utc) + timedelta(seconds=settings.followup_interval_seconds * 4))
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )
    for o in outreach_rows:
        db.add(
            OutreachRequest(
                id=o["id"],
                company_id=company.id,
                run_id="RUN-2026-Q3",
                supplier_id=o["supplierId"],
                supplier=o["supplier"],
                channel=o["channel"],
                language=o["language"],
                gap=o["gap"],
                draft=o["draft"],
                status=o["status"],
                tries=int(o["tries"]),
                max_tries=int(o["maxTries"]),
                next_followup_at=demo_future_iso if o["status"] == "sent" else o.get("nextFollowupAt"),
            )
        )
        for msg in o.get("thread", []):
            db.add(
                OutreachMessageModel(
                    company_id=company.id,
                    outreach_request_id=o["id"],
                    direction=msg["direction"],
                    text=msg["text"],
                    at=msg["at"],
                    language=msg.get("language"),
                )
            )

    # Seed initial gaps
    db.add_all(
        [
            GapItemModel(
                id="G-1",
                company_id=company.id,
                run_id="RUN-2026-Q3",
                field="precursor_wire_rod_factor",
                description="Embedded emissions per tonne missing for 45 t wire rod from Sample Steel Wire Co.",
                supplier_id="SUP-01",
                supplier_name="Sample Steel Wire Co.",
                status="open",
                outreach_request_id="O-1",
            ),
            GapItemModel(
                id="G-2",
                company_id=company.id,
                run_id="RUN-2026-Q3",
                field="aux_coating_factor",
                description="Optional passivation batch confirmation from Sahyadri Fastener Coatings.",
                supplier_id="SUP-03",
                supplier_name="Sahyadri Fastener Coatings",
                status="open",
                outreach_request_id="O-3",
            ),
        ]
    )

    # Seed Q1 & Q2 approved snapshots + Q3 draft snapshot
    for rep in _load_frontend_mock("reports"):
        db.add(
            ReportSnapshot(
                id=rep["id"],
                company_id=company.id,
                run_id="RUN-2026-Q3" if rep["period"] == "2026-Q3" else None,
                period=rep["period"],
                product=rep["product"],
                emissions_per_tonne=float(rep["emissionsPerTonne"]),
                unit=rep["unit"],
                breakdown_json=rep["breakdown"],
                basis_summary_json=rep["basisSummary"],
                total_production_tonnes=float(rep["totalProductionTonnes"]),
                exported_tonnes=float(rep["exportedTonnes"]),
                eu_default_per_tonne=float(rep["euDefaultPerTonne"]),
                status=rep["status"],
                approved_at=rep.get("approvedAt"),
            )
        )

    # Seed Q3 pipeline run
    for run in _load_frontend_mock("runs"):
        db.add(
            PipelineRun(
                id=run["id"],
                company_id=company.id,
                company_name=run["companyName"],
                period=run["period"],
                product=run["product"],
                cn_code=run["cnCode"],
                state=run["state"],
                active_agent=run.get("activeAgent"),
                started_at=run["startedAt"],
                updated_at=run["updatedAt"],
                logs_json=run.get("logs", []),
                steps_json=sync_run_steps([], run["state"], run["updatedAt"]),
            )
        )

    db.flush()

    # Run deterministic calculator & verifier immediately so seeded state is 100% consistent
    recompute_run_calculations(db, company.id, "RUN-2026-Q3")
    verify_run(db, company.id, "RUN-2026-Q3")
    db.commit()
    return True

