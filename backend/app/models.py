from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    product_name: Mapped[str] = mapped_column(String(200), default="Steel Fasteners (CN 7318 15)")
    cn_code: Mapped[str] = mapped_column(String(32), default="7318 15")
    buyer_name: Mapped[str] = mapped_column(String(200), default="EuroBolt GmbH (Hamburg, Germany)")
    default_carbon_price_eur: Mapped[float] = mapped_column(Float, default=85.0)
    eu_default_per_tonne: Mapped[float] = mapped_column(Float, default=3.45)
    created_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="exporter", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    format_label: Mapped[str] = mapped_column(String(32), nullable=False)
    period: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    uploaded_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    selected_for_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    duplicate_of_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preview_pages_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)


class PipelineRun(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    period: Mapped[str] = mapped_column(String(32), nullable=False)
    product: Mapped[str] = mapped_column(String(200), nullable=False)
    cn_code: Mapped[str] = mapped_column(String(32), nullable=False)
    state: Mapped[str] = mapped_column(String(64), nullable=False)
    active_agent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    started_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)
    logs_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    steps_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)


class LedgerRecord(Base):
    __tablename__ = "ledger_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(String(64), default="RUN-2026-Q3", nullable=False, index=True)
    document_id: Mapped[str] = mapped_column(String(64), nullable=False)
    document_name: Mapped[str] = mapped_column(String(255), nullable=False)
    page: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    field: Mapped[str] = mapped_column(String(128), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
    period: Mapped[str] = mapped_column(String(32), nullable=False)
    extracted_by: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.95, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)


class EmissionFactor(Base):
    __tablename__ = "emission_factors"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(64), nullable=False)
    year: Mapped[int] = mapped_column(Integer, default=2026, nullable=False)
    source: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_illustrative: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CalculationLineModel(Base):
    __tablename__ = "calculations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(String(64), default="RUN-2026-Q3", nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    formula_text: Mapped[str] = mapped_column(Text, nullable=False)
    input_record_ids_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    factor_ids_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    result: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    basis: Mapped[str] = mapped_column(String(32), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class VerificationFlag(Base):
    __tablename__ = "verification_flags"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(String(64), default="RUN-2026-Q3", nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    plain_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_fix: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(64), nullable=False)
    products_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    volume_by_period_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    emissions_per_tonne: Mapped[float] = mapped_column(Float, nullable=False)
    avg_reply_hours: Mapped[float] = mapped_column(Float, nullable=False)
    data_quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    last_verified_at: Mapped[str] = mapped_column(String(64), nullable=False)


class OutreachRequest(Base):
    __tablename__ = "outreach_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(String(64), default="RUN-2026-Q3", nullable=False, index=True)
    supplier_id: Mapped[str] = mapped_column(String(64), nullable=False)
    supplier: Mapped[str] = mapped_column(String(200), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    gap: Mapped[str] = mapped_column(Text, nullable=False)
    draft: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    tries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_tries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    next_followup_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    messages: Mapped[list["OutreachMessageModel"]] = relationship(
        "OutreachMessageModel",
        back_populates="outreach_request",
        cascade="all, delete-orphan",
        order_by="OutreachMessageModel.id",
    )


class OutreachMessageModel(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    outreach_request_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("outreach_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    direction: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)
    language: Mapped[str | None] = mapped_column(String(32), nullable=True)

    outreach_request: Mapped["OutreachRequest"] = relationship(
        "OutreachRequest", back_populates="messages"
    )


class GapItemModel(Base):
    __tablename__ = "gaps"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str] = mapped_column(String(64), default="RUN-2026-Q3", nullable=False, index=True)
    field: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    supplier_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    supplier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    outreach_request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ReportSnapshot(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    run_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    period: Mapped[str] = mapped_column(String(32), nullable=False)
    product: Mapped[str] = mapped_column(String(200), nullable=False)
    emissions_per_tonne: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="tCO2e/t", nullable=False)
    breakdown_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    basis_summary_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    total_production_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    exported_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    eu_default_per_tonne: Mapped[float] = mapped_column(Float, default=3.45, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    approved_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), default=utc_now_iso, nullable=False)

