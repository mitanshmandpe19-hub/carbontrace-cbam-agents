from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CamelModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- Auth ---

class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)


class MagicLinkRequest(CamelModel):
    email: EmailStr


class MagicLinkResponse(CamelModel):
    message: str


class UserProfileSchema(CamelModel):
    id: str
    email: str
    name: str
    role: str
    companyId: str
    companyName: str
    isDemo: bool


class TokenResponseSchema(CamelModel):
    accessToken: str
    tokenType: Literal["bearer"] = "bearer"
    expiresInSeconds: int
    user: UserProfileSchema


# --- Documents ---

class DocumentPreviewLineSchema(CamelModel):
    lineNumber: int
    text: str
    highlightRecordId: str | None = None


class DocumentPreviewPageSchema(CamelModel):
    page: int
    title: str
    subtitle: str | None = None
    lines: list[DocumentPreviewLineSchema]


class DocumentFileSchema(CamelModel):
    id: str
    companyId: str
    fileName: str
    docType: str
    formatLabel: Literal["PDF", "Excel", "Message", "Note"]
    period: str
    summary: str
    uploadedAt: str
    isSample: bool
    selectedForRun: bool
    duplicateOfId: str | None = None
    previewPages: list[DocumentPreviewPageSchema]


class UploadDocumentJsonPayload(CamelModel):
    fileName: str = Field(min_length=1, max_length=255)
    formatLabel: Literal["PDF", "Excel", "Message", "Note"] = "PDF"
    docType: str = "electricity_bill"
    period: str = "2026-Q3"
    summary: str = "Uploaded document"
    quoteText: str | None = None


# --- Runs ---

class ActivityLogItemSchema(CamelModel):
    id: str
    at: str
    actor: str
    message: str
    detail: str | None = None
    targetId: str | None = None


class RunStepSchema(CamelModel):
    state: str
    label: str
    actor: str
    status: Literal["pending", "active", "completed"]
    startedAt: str | None = None
    completedAt: str | None = None


class PipelineRunSchema(CamelModel):
    id: str
    companyId: str
    companyName: str
    period: str
    product: str
    cnCode: str
    state: str
    activeAgent: str | None = None
    startedAt: str
    updatedAt: str
    logs: list[ActivityLogItemSchema]
    steps: list[RunStepSchema] = Field(default_factory=list)


class CreateRunPayload(CamelModel):
    period: str = "2026-Q3"
    product: str = "Steel Fasteners (Hex Bolts & Nuts)"


# --- Ledger & Factors & Calculations ---

class LedgerRecordSchema(CamelModel):
    id: str
    documentId: str
    documentName: str
    page: int
    quote: str
    field: str
    value: float
    unit: str
    period: str
    extractedBy: str
    confidence: float
    status: Literal["pending", "verified", "rejected", "superseded"]
    createdAt: str | None = None


class EmissionFactorSchema(CamelModel):
    id: str
    name: str
    value: float
    unit: str
    year: int
    source: str
    sourceUrl: str | None = None
    isIllustrative: bool


class CalculationLineSchema(CamelModel):
    id: str
    label: str
    category: Literal["direct", "indirect", "precursors", "output", "intensity"]
    formulaText: str
    inputRecordIds: list[str]
    factorIds: list[str]
    result: float
    unit: str
    basis: Literal["actual", "default"]


# --- Verification ---

class VerificationFlagSchema(CamelModel):
    id: str
    code: str
    severity: Literal["block", "warn", "info"]
    targetType: Literal["ledger_record", "document", "calculation", "emission_factor", "outreach"]
    targetId: str
    message: str
    plainExplanation: str
    suggestedFix: str
    status: Literal["open", "resolved", "accepted"]


class ResolveFlagPayload(CamelModel):
    resolution: Literal["resolve", "accept"] = "resolve"


class ResolveFlagResponseSchema(CamelModel):
    flag: VerificationFlagSchema
    run: PipelineRunSchema


# --- Gaps & Outreach ---

class GapItemSchema(CamelModel):
    id: str
    runId: str
    field: str
    description: str
    supplierId: str | None = None
    supplierName: str | None = None
    status: Literal["open", "resolved_actual", "closed_default"]
    outreachRequestId: str | None = None


class OutreachMessageSchema(CamelModel):
    direction: Literal["in", "out"]
    text: str
    at: str
    language: str | None = None


class OutreachRequestSchema(CamelModel):
    id: str
    supplierId: str
    supplier: str
    channel: Literal["whatsapp", "email"]
    language: str
    gap: str
    draft: str
    status: Literal["draft", "approved", "sent", "replied", "gave_up"]
    tries: int
    maxTries: int
    nextFollowupAt: str | None = None
    thread: list[OutreachMessageSchema]


class ApproveOutreachPayload(CamelModel):
    draft: str | None = None


class SimulateReplyResponseSchema(CamelModel):
    outreach: OutreachRequestSchema
    ledger: list[LedgerRecordSchema]
    run: PipelineRunSchema


# --- Suppliers ---

class SupplierSchema(CamelModel):
    id: str
    name: str
    contact: str
    language: str
    products: list[str]
    volumeByPeriod: dict[str, float]
    emissionsPerTonne: float
    avgReplyHours: float
    dataQualityScore: int
    lastVerifiedAt: str


# --- Reports & Dashboard & History ---

class ReportBreakdownSchema(CamelModel):
    direct: float
    indirect: float
    precursors: float


class ReportBasisSummarySchema(CamelModel):
    actual: float
    default: float


class ReportSnapshotSchema(CamelModel):
    id: str
    period: str
    product: str
    emissionsPerTonne: float
    unit: Literal["tCO2e/t"] = "tCO2e/t"
    breakdown: ReportBreakdownSchema
    basisSummary: ReportBasisSummarySchema
    totalProductionTonnes: float
    exportedTonnes: float
    euDefaultPerTonne: float
    status: Literal["draft", "ready_for_approval", "approved", "exported"]
    approvedAt: str | None = None


class DashboardNextStepSchema(CamelModel):
    title: str
    description: str
    href: str
    ctaLabel: str
    accent: Literal["collector", "outreach", "calculator", "verifier", "exporter"]


class DashboardSummarySchema(CamelModel):
    companyName: str
    isSample: bool
    period: str
    product: str
    cnCode: str
    buyerName: str
    runId: str
    runState: str
    emissionsPerTonne: float
    previousEmissionsPerTonne: float
    euDefaultPerTonne: float
    totalProductionTonnes: float
    exportedTonnes: float
    defaultCarbonPriceEur: float
    openGapsCount: int
    openBlockFlagsCount: int
    openWarnFlagsCount: int
    actualSharePct: int
    nextStep: DashboardNextStepSchema


class PeriodDeltaDriverSchema(CamelModel):
    label: str
    delta: float
    reason: str


class PeriodDeltaGroupSchema(CamelModel):
    fromPeriod: str
    toPeriod: str
    totalDelta: float
    drivers: list[PeriodDeltaDriverSchema]


class HistoryResponseSchema(CamelModel):
    product: str
    snapshots: list[ReportSnapshotSchema]
    deltas: list[PeriodDeltaGroupSchema]

