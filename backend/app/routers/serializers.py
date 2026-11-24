"""Shared ORM-to-Pydantic camelCase serialization helpers."""

from __future__ import annotations

from app.models import (
    CalculationLineModel,
    Document,
    EmissionFactor,
    GapItemModel,
    LedgerRecord,
    OutreachRequest,
    PipelineRun,
    ReportSnapshot,
    Supplier,
    VerificationFlag,
)
from app.schemas import (
    CalculationLineSchema,
    DocumentFileSchema,
    EmissionFactorSchema,
    GapItemSchema,
    LedgerRecordSchema,
    OutreachMessageSchema,
    OutreachRequestSchema,
    PipelineRunSchema,
    ReportBasisSummarySchema,
    ReportBreakdownSchema,
    ReportSnapshotSchema,
    SupplierSchema,
    VerificationFlagSchema,
)


def serialize_document(doc: Document, page: int | None = None) -> DocumentFileSchema:
    pages = doc.preview_pages_json or []
    if page is not None and pages:
        matching = [p for p in pages if p.get("page") == page]
        if matching:
            pages = matching
    return DocumentFileSchema(
        id=doc.id,
        companyId=doc.company_id,
        fileName=doc.file_name,
        docType=doc.doc_type,
        formatLabel=doc.format_label,  # type: ignore[arg-type]
        period=doc.period,
        summary=doc.summary,
        uploadedAt=doc.uploaded_at,
        isSample=doc.is_sample,
        selectedForRun=doc.selected_for_run,
        duplicateOfId=doc.duplicate_of_id,
        previewPages=pages,
    )


def serialize_run(run: PipelineRun) -> PipelineRunSchema:
    return PipelineRunSchema(
        id=run.id,
        companyId=run.company_id,
        companyName=run.company_name,
        period=run.period,
        product=run.product,
        cnCode=run.cn_code,
        state=run.state,
        activeAgent=run.active_agent,
        startedAt=run.started_at,
        updatedAt=run.updated_at,
        logs=run.logs_json or [],
        steps=run.steps_json or [],
    )


def serialize_ledger_record(rec: LedgerRecord) -> LedgerRecordSchema:
    return LedgerRecordSchema(
        id=rec.id,
        documentId=rec.document_id,
        documentName=rec.document_name,
        page=rec.page,
        quote=rec.quote,
        field=rec.field,
        value=rec.value,
        unit=rec.unit,
        period=rec.period,
        extractedBy=rec.extracted_by,
        confidence=rec.confidence,
        status=rec.status,  # type: ignore[arg-type]
        createdAt=rec.created_at,
    )


def serialize_factor(factor: EmissionFactor) -> EmissionFactorSchema:
    return EmissionFactorSchema(
        id=factor.id,
        name=factor.name,
        value=factor.value,
        unit=factor.unit,
        year=factor.year,
        source=factor.source,
        sourceUrl=factor.source_url,
        isIllustrative=factor.is_illustrative,
    )


def serialize_calculation(calc: CalculationLineModel) -> CalculationLineSchema:
    return CalculationLineSchema(
        id=calc.id,
        label=calc.label,
        category=calc.category,  # type: ignore[arg-type]
        formulaText=calc.formula_text,
        inputRecordIds=calc.input_record_ids_json or [],
        factorIds=calc.factor_ids_json or [],
        result=calc.result,
        unit=calc.unit,
        basis=calc.basis,  # type: ignore[arg-type]
    )


def serialize_flag(flag: VerificationFlag) -> VerificationFlagSchema:
    return VerificationFlagSchema(
        id=flag.id,
        code=flag.code,
        severity=flag.severity,  # type: ignore[arg-type]
        targetType=flag.target_type,  # type: ignore[arg-type]
        targetId=flag.target_id,
        message=flag.message,
        plainExplanation=flag.plain_explanation,
        suggestedFix=flag.suggested_fix,
        status=flag.status,  # type: ignore[arg-type]
    )


def serialize_gap(gap: GapItemModel) -> GapItemSchema:
    return GapItemSchema(
        id=gap.id,
        runId=gap.run_id,
        field=gap.field,
        description=gap.description,
        supplierId=gap.supplier_id,
        supplierName=gap.supplier_name,
        status=gap.status,  # type: ignore[arg-type]
        outreachRequestId=gap.outreach_request_id,
    )


def serialize_outreach(req: OutreachRequest) -> OutreachRequestSchema:
    thread = [
        OutreachMessageSchema(
            direction=m.direction,  # type: ignore[arg-type]
            text=m.text,
            at=m.at,
            language=m.language,
        )
        for m in req.messages
    ]
    return OutreachRequestSchema(
        id=req.id,
        supplierId=req.supplier_id,
        supplier=req.supplier,
        channel=req.channel,  # type: ignore[arg-type]
        language=req.language,
        gap=req.gap,
        draft=req.draft,
        status=req.status,  # type: ignore[arg-type]
        tries=req.tries,
        maxTries=req.max_tries,
        nextFollowupAt=req.next_followup_at,
        thread=thread,
    )


def serialize_supplier(sup: Supplier) -> SupplierSchema:
    return SupplierSchema(
        id=sup.id,
        name=sup.name,
        contact=sup.contact,
        language=sup.language,
        products=sup.products_json or [],
        volumeByPeriod=sup.volume_by_period_json or {},
        emissionsPerTonne=sup.emissions_per_tonne,
        avgReplyHours=sup.avg_reply_hours,
        dataQualityScore=sup.data_quality_score,
        lastVerifiedAt=sup.last_verified_at,
    )


def serialize_report(rep: ReportSnapshot) -> ReportSnapshotSchema:
    bd = rep.breakdown_json or {}
    bs = rep.basis_summary_json or {}
    return ReportSnapshotSchema(
        id=rep.id,
        period=rep.period,
        product=rep.product,
        emissionsPerTonne=rep.emissions_per_tonne,
        unit="tCO2e/t",
        breakdown=ReportBreakdownSchema(
            direct=float(bd.get("direct", 0.0)),
            indirect=float(bd.get("indirect", 0.0)),
            precursors=float(bd.get("precursors", 0.0)),
        ),
        basisSummary=ReportBasisSummarySchema(
            actual=float(bs.get("actual", 0.0)),
            default=float(bs.get("default", 0.0)),
        ),
        totalProductionTonnes=rep.total_production_tonnes,
        exportedTonnes=rep.exported_tonnes,
        euDefaultPerTonne=rep.eu_default_per_tonne,
        status=rep.status,  # type: ignore[arg-type]
        approvedAt=rep.approved_at,
    )

