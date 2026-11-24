export type AgentRole = 'collector' | 'outreach' | 'calculator' | 'verifier' | 'exporter';

export type PipelineState =
  | 'created'
  | 'collecting'
  | 'gaps_found'
  | 'awaiting_message_approval'
  | 'waiting_supplier_reply'
  | 'calculating'
  | 'verifying'
  | 'needs_fixes'
  | 'ready_for_approval'
  | 'approved'
  | 'exported';

export type LedgerRecordStatus = 'pending' | 'verified' | 'rejected' | 'superseded';

export interface LedgerRecord {
  id: string;
  documentId: string;
  documentName: string;
  page: number;
  quote: string;
  field: string;
  value: number;
  unit: string;
  period: string;
  extractedBy: string;
  confidence: number;
  status: LedgerRecordStatus;
  createdAt?: string;
}

export type CalculationBasis = 'actual' | 'default';

export type CalculationCategory = 'direct' | 'indirect' | 'precursors' | 'output' | 'intensity';

export interface CalculationLine {
  id: string;
  label: string;
  category: CalculationCategory;
  formulaText: string;
  inputRecordIds: string[];
  factorIds: string[];
  result: number;
  unit: string;
  basis: CalculationBasis;
}

export interface EmissionFactor {
  id: string;
  name: string;
  value: number;
  unit: string;
  year: number;
  source: string;
  sourceUrl?: string;
  isIllustrative: boolean;
}

export type VerificationCode =
  | 'NO_EVIDENCE'
  | 'RECALC_MISMATCH'
  | 'UNIT_MISMATCH'
  | 'DUPLICATE_DOCUMENT'
  | 'OUT_OF_RANGE'
  | 'CROSS_DOC_CONFLICT'
  | 'PERIOD_MISMATCH'
  | 'FACTOR_NO_SOURCE'
  | 'SUPPLIER_CONFLICT';

export type VerificationSeverity = 'block' | 'warn' | 'info';

export type VerificationStatus = 'open' | 'resolved' | 'accepted';

export interface VerificationFlag {
  id: string;
  code: VerificationCode;
  severity: VerificationSeverity;
  targetType: 'ledger_record' | 'document' | 'calculation' | 'emission_factor' | 'outreach';
  targetId: string;
  message: string;
  plainExplanation: string;
  suggestedFix: string;
  status: VerificationStatus;
}

export type OutreachChannel = 'whatsapp' | 'email';

export type OutreachStatus = 'draft' | 'approved' | 'sent' | 'replied' | 'gave_up';

export interface OutreachMessage {
  direction: 'in' | 'out';
  text: string;
  at: string;
  language?: string;
}

export interface OutreachRequest {
  id: string;
  supplierId: string;
  supplier: string;
  channel: OutreachChannel;
  language: 'English' | 'Hindi' | 'Marathi';
  gap: string;
  draft: string;
  status: OutreachStatus;
  tries: number;
  maxTries: number;
  nextFollowupAt: string | null;
  thread: OutreachMessage[];
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  language: string;
  products: string[];
  volumeByPeriod: Record<string, number>;
  emissionsPerTonne: number;
  avgReplyHours: number;
  dataQualityScore: number;
  lastVerifiedAt: string;
}

export interface ReportBreakdown {
  direct: number;
  indirect: number;
  precursors: number;
}

export interface ReportBasisSummary {
  actual: number;
  default: number;
}

export interface ReportSnapshot {
  id: string;
  period: string;
  product: string;
  emissionsPerTonne: number;
  unit: 'tCO2e/t';
  breakdown: ReportBreakdown;
  basisSummary: ReportBasisSummary;
  totalProductionTonnes: number;
  exportedTonnes: number;
  euDefaultPerTonne: number;
  status: 'draft' | 'ready_for_approval' | 'approved' | 'exported';
  approvedAt: string | null;
}

export type DocumentKind =
  | 'electricity_bill'
  | 'fuel_invoice'
  | 'material_invoice'
  | 'production_log'
  | 'shipment_list'
  | 'supplier_reply'
  | 'manual_note';

export interface DocumentPreviewLine {
  lineNumber: number;
  text: string;
  highlightRecordId?: string;
}

export interface DocumentPreviewPage {
  page: number;
  title: string;
  subtitle?: string;
  lines: DocumentPreviewLine[];
}

export interface DocumentFile {
  id: string;
  companyId: string;
  fileName: string;
  docType: DocumentKind;
  formatLabel: 'PDF' | 'Excel' | 'Message' | 'Note';
  period: string;
  summary: string;
  uploadedAt: string;
  isSample: boolean;
  selectedForRun: boolean;
  duplicateOfId?: string;
  previewPages: DocumentPreviewPage[];
}

export interface GapItem {
  id: string;
  runId: string;
  field: string;
  description: string;
  supplierId?: string;
  supplierName?: string;
  status: 'open' | 'resolved_actual' | 'closed_default';
  outreachRequestId?: string;
}

export interface ActivityLogItem {
  id: string;
  at: string;
  actor: AgentRole | 'system';
  message: string;
  detail?: string;
  targetId?: string;
}

export interface PipelineRunStep {
  state: PipelineState;
  label: string;
  actor: string;
  status: 'pending' | 'active' | 'completed';
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface PipelineRun {
  id: string;
  companyId: string;
  companyName: string;
  period: string;
  product: string;
  cnCode: string;
  state: PipelineState;
  activeAgent: AgentRole | null;
  startedAt: string;
  updatedAt: string;
  logs: ActivityLogItem[];
  steps?: PipelineRunStep[];
}

export interface DashboardSummary {
  companyName: string;
  isSample: boolean;
  period: string;
  product: string;
  cnCode: string;
  buyerName: string;
  runId: string;
  runState: PipelineState;
  emissionsPerTonne: number;
  previousEmissionsPerTonne: number;
  euDefaultPerTonne: number;
  totalProductionTonnes: number;
  exportedTonnes: number;
  defaultCarbonPriceEur: number;
  openGapsCount: number;
  openBlockFlagsCount: number;
  openWarnFlagsCount: number;
  actualSharePct: number;
  nextStep: {
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
    accent: AgentRole;
  };
}

export interface PeriodDeltaDriver {
  label: string;
  delta: number;
  reason: string;
}

export interface HistoryResponse {
  product: string;
  snapshots: ReportSnapshot[];
  deltas: {
    fromPeriod: string;
    toPeriod: string;
    totalDelta: number;
    drivers: PeriodDeltaDriver[];
  }[];
}

