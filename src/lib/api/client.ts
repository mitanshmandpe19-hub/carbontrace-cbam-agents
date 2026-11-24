import type {
  ActivityLogItem,
  CalculationLine,
  DashboardSummary,
  DocumentFile,
  EmissionFactor,
  GapItem,
  HistoryResponse,
  LedgerRecord,
  OutreachRequest,
  PipelineRun,
  ReportSnapshot,
  Supplier,
  VerificationFlag,
} from '@/types';

export interface UploadDocumentPayload {
  fileName: string;
  formatLabel: DocumentFile['formatLabel'];
  docType: DocumentFile['docType'];
  period: string;
  summary: string;
  quoteText?: string;
  file?: File;
  onProgress?: (percent: number) => void;
}

export interface CarbonTraceApi {
  getDashboard(period?: string): Promise<DashboardSummary>;
  getDocuments(): Promise<DocumentFile[]>;
  toggleSampleDocument(documentId: string, selected: boolean): Promise<DocumentFile[]>;
  selectAllSampleDocuments(): Promise<DocumentFile[]>;
  uploadDocument(payload: UploadDocumentPayload): Promise<DocumentFile>;
  getDocumentPreview(documentId: string, page?: number): Promise<DocumentFile | null>;
  createRun(period: string, product: string): Promise<PipelineRun>;
  getRun(runId?: string): Promise<PipelineRun>;
  runSimulatedPipelineStep(runId: string): Promise<PipelineRun>;
  resetDemoState(): Promise<void>;
  getLedger(runId?: string): Promise<LedgerRecord[]>;
  getLedgerRecord(recordId: string): Promise<LedgerRecord | null>;
  getGaps(runId?: string): Promise<GapItem[]>;
  getOutreach(runId?: string): Promise<OutreachRequest[]>;
  approveOutreach(outreachId: string, editedDraft?: string): Promise<OutreachRequest>;
  simulateSupplierReply(outreachId: string): Promise<{
    outreach: OutreachRequest;
    ledger: LedgerRecord[];
    run: PipelineRun;
  }>;
  simulateNoReplyFallback(outreachId: string): Promise<{
    outreach: OutreachRequest;
    run: PipelineRun;
  }>;
  getCalculations(runId?: string): Promise<CalculationLine[]>;
  getEmissionFactors(): Promise<EmissionFactor[]>;
  getVerificationFlags(runId?: string): Promise<VerificationFlag[]>;
  resolveVerificationFlag(
    flagId: string,
    resolution: 'resolve' | 'accept'
  ): Promise<{
    flag: VerificationFlag;
    run: PipelineRun;
  }>;
  approveReport(runId: string): Promise<ReportSnapshot>;
  getReports(): Promise<ReportSnapshot[]>;
  exportReport(
    reportId: string,
    format: 'pdf' | 'xlsx'
  ): Promise<{
    fileName: string;
    mimeType: string;
    content: string | Uint8Array;
  }>;
  getHistory(product?: string): Promise<HistoryResponse>;
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(supplierId: string): Promise<Supplier | null>;
  appendRunLog(runId: string, item: Omit<ActivityLogItem, 'id' | 'at'>): Promise<PipelineRun>;
  streamRun?: (
    runId: string,
    onUpdate: (run: PipelineRun) => void,
    onFallbackPolling?: () => void
  ) => () => void;
  fetchDocumentRawBlob?: (documentId: string) => Promise<{ blob: Blob; mimeType: string } | null>;
}

