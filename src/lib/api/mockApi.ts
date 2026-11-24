import rawCalculations from '@/mock/calculations.json';
import rawDocuments from '@/mock/documents.json';
import rawFactors from '@/mock/factors.json';
import rawLedger from '@/mock/ledger.json';
import rawOutreach from '@/mock/outreach.json';
import rawReports from '@/mock/reports.json';
import rawRuns from '@/mock/runs.json';
import rawSuppliers from '@/mock/suppliers.json';
import rawVerification from '@/mock/verification.json';
import { recomputeQ3Calculations } from '@/lib/calculations';
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
  PipelineState,
  ReportSnapshot,
  Supplier,
  VerificationFlag,
} from '@/types';
import type { CarbonTraceApi, UploadDocumentPayload } from './client';

const STORAGE_KEY = 'carbontrace-demo-state-v1';

interface MockStore {
  documents: DocumentFile[];
  factors: EmissionFactor[];
  ledger: LedgerRecord[];
  calculations: CalculationLine[];
  verification: VerificationFlag[];
  outreach: OutreachRequest[];
  suppliers: Supplier[];
  reports: ReportSnapshot[];
  runs: PipelineRun[];
  gaps: GapItem[];
  simulationCursor: number;
}

function cloneJson<T>(data: unknown): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

function buildInitialGaps(outreach: OutreachRequest[]): GapItem[] {
  const o1 = outreach.find((o) => o.id === 'O-1');
  const o3 = outreach.find((o) => o.id === 'O-3');
  return [
    {
      id: 'G-1',
      runId: 'RUN-2026-Q3',
      field: 'precursor_wire_rod_factor',
      description: 'Embedded emissions per tonne missing for 45 t wire rod from Sample Steel Wire Co.',
      supplierId: 'SUP-01',
      supplierName: 'Sample Steel Wire Co.',
      status: o1?.status === 'replied' ? 'resolved_actual' : 'open',
      outreachRequestId: 'O-1',
    },
    {
      id: 'G-2',
      runId: 'RUN-2026-Q3',
      field: 'aux_coating_factor',
      description: 'Optional passivation batch confirmation from Sahyadri Fastener Coatings.',
      supplierId: 'SUP-03',
      supplierName: 'Sahyadri Fastener Coatings',
      status: o3?.status === 'gave_up' ? 'closed_default' : 'open',
      outreachRequestId: 'O-3',
    },
  ];
}

function createSeedStore(): MockStore {
  const outreach = cloneJson<OutreachRequest[]>(rawOutreach);
  return {
    documents: cloneJson<DocumentFile[]>(rawDocuments),
    factors: cloneJson<EmissionFactor[]>(rawFactors),
    ledger: cloneJson<LedgerRecord[]>(rawLedger),
    calculations: cloneJson<CalculationLine[]>(rawCalculations),
    verification: cloneJson<VerificationFlag[]>(rawVerification),
    outreach,
    suppliers: cloneJson<Supplier[]>(rawSuppliers),
    reports: cloneJson<ReportSnapshot[]>(rawReports),
    runs: cloneJson<PipelineRun[]>(rawRuns),
    gaps: buildInitialGaps(outreach),
    simulationCursor: 0,
  };
}

let memoryStore: MockStore | null = null;

function loadStore(): MockStore {
  if (typeof window === 'undefined') {
    if (!memoryStore) memoryStore = createSeedStore();
    return memoryStore;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MockStore;
      if (parsed && parsed.documents && parsed.ledger && parsed.runs) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read errors in restricted browsing contexts.
  }
  const seeded = createSeedStore();
  saveStore(seeded);
  return seeded;
}

function saveStore(store: MockStore): void {
  memoryStore = store;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore storage quota errors.
    }
  }
}

async function delay(ms = 90): Promise<void> {
  if (typeof process !== 'undefined' && process.env.VITEST) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function recomputeAndSync(store: MockStore): MockStore {
  const q3Idx = store.reports.findIndex((r) => r.period === '2026-Q3');
  if (q3Idx >= 0) {
    const { calculations, snapshot } = recomputeQ3Calculations(
      store.ledger,
      store.factors,
      store.reports[q3Idx]
    );
    store.calculations = calculations;
    store.reports[q3Idx] = snapshot;
  }

  const openBlockers = store.verification.filter(
    (v) => v.severity === 'block' && v.status === 'open'
  ).length;
  const run = store.runs[0];
  if (run && q3Idx >= 0) {
    if (store.reports[q3Idx].status === 'approved') {
      run.state = run.state === 'exported' ? 'exported' : 'approved';
      run.activeAgent = 'exporter';
    } else if (openBlockers === 0) {
      if (run.state === 'needs_fixes' || run.state === 'verifying') {
        run.state = 'ready_for_approval';
        run.activeAgent = 'exporter';
        store.reports[q3Idx].status = 'ready_for_approval';
      }
    } else if (run.state === 'ready_for_approval') {
      run.state = 'needs_fixes';
      run.activeAgent = 'verifier';
      store.reports[q3Idx].status = 'draft';
    }
  }
  return store;
}

function buildSimplePdfBytes(lines: string[]): Uint8Array {
  const escapePdf = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const streamLines = [
    'BT',
    '/F1 14 Tf',
    '48 760 Td',
    `(${escapePdf(lines[0] ?? 'CarbonTrace Sample CBAM Report')}) Tj`,
    '/F1 10 Tf',
    '0 -22 Td',
  ];

  for (const line of lines.slice(1)) {
    streamLines.push(`(${escapePdf(line)}) Tj`);
    streamLines.push('0 -16 Td');
  }
  streamLines.push('ET');
  const contentStream = streamLines.join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function buildSpreadsheetXml(
  report: ReportSnapshot,
  calculations: CalculationLine[],
  ledger: LedgerRecord[]
): string {
  const esc = (v: string | number) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const row = (cells: (string | number)[]) =>
    `<Row>${cells
      .map((c) => {
        const type = typeof c === 'number' ? 'Number' : 'String';
        return `<Cell><Data ss:Type="${type}">${esc(c)}</Data></Cell>`;
      })
      .join('')}</Row>`;

  const calcRows = calculations.map((c) =>
    row([c.id, c.label, c.formulaText, c.result, c.unit, c.basis])
  );
  const ledgerRows = ledger.map((r) =>
    row([r.id, r.documentName, r.page, r.field, r.value, r.unit, r.status, r.quote])
  );

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="CBAM_Summary_Sample">
  <Table>
   ${row(['CarbonTrace EU CBAM Export — SAMPLE DATA ONLY (Demo Fasteners Pvt Ltd)'])}
   ${row(['Period', report.period, 'Product', report.product, 'Status', report.status])}
   ${row(['Embedded Emissions (tCO2e/t)', report.emissionsPerTonne, 'EU Default (Illustrative)', report.euDefaultPerTonne])}
   ${row(['ID', 'Calculation Line', 'Formula', 'Result', 'Unit', 'Basis'])}
   ${calcRows.join('\n   ')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Evidence_Ledger">
  <Table>
   ${row(['Record ID', 'Document', 'Page', 'Field', 'Value', 'Unit', 'Status', 'Exact Quote'])}
   ${ledgerRows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
}

const SIMULATION_STEPS: {
  state: PipelineState;
  actor: ActivityLogItem['actor'];
  message: string;
  detail: string;
}[] = [
  {
    state: 'created',
    actor: 'system',
    message: 'Initialized CBAM run workspace for Q3 2026 (Demo Fasteners Pvt Ltd).',
    detail: '12 sample files queued for evidence extraction.',
  },
  {
    state: 'collecting',
    actor: 'collector',
    message: 'Collector extracted 13 records from PDF bills, fuel invoices & Excel sheets.',
    detail: 'Every record tagged with page number and exact verbatim quote.',
  },
  {
    state: 'gaps_found',
    actor: 'outreach',
    message: 'Detected missing precursor emissions intensity for Sample Steel Wire Co. (45 t wire rod).',
    detail: 'Drafting bilingual Hindi/English WhatsApp request O-1.',
  },
  {
    state: 'awaiting_message_approval',
    actor: 'exporter',
    message: 'Paused at human approval gate for outgoing WhatsApp draft O-1.',
    detail: 'Exporter reviews draft before any message leaves CarbonTrace.',
  },
  {
    state: 'waiting_supplier_reply',
    actor: 'outreach',
    message: 'WhatsApp request sent to Sample Steel Wire Co. Waiting on supplier reply.',
    detail: 'Auto-fallback to EU default after 3 unanswered reminders.',
  },
  {
    state: 'calculating',
    actor: 'calculator',
    message: 'Calculator ran deterministic Python math with illustrative sample factors.',
    detail: 'Direct + Indirect + Precursors divided by 50 t finished fasteners.',
  },
  {
    state: 'verifying',
    actor: 'verifier',
    message: 'Verifier cross-checked units, invoice numbers, supplier mass & factor citations.',
    detail: 'Checking for UNIT_MISMATCH, DUPLICATE_DOCUMENT, SUPPLIER_CONFLICT, FACTOR_NO_SOURCE.',
  },
];

export const mockApi: CarbonTraceApi = {
  async getDashboard(period = '2026-Q3'): Promise<DashboardSummary> {
    await delay(80);
    const store = recomputeAndSync(loadStore());
    const run = store.runs[0];
    const q3 = store.reports.find((r) => r.period === period) ?? store.reports[store.reports.length - 1];
    const q2 = store.reports.find((r) => r.period === '2026-Q2') ?? q3;

    const openGaps = store.gaps.filter((g) => g.status === 'open').length;
    const openBlockers = store.verification.filter(
      (f) => f.severity === 'block' && f.status === 'open'
    ).length;
    const openWarnings = store.verification.filter(
      (f) => f.severity === 'warn' && f.status === 'open'
    ).length;
    const pendingOutreach = store.outreach.find((o) => o.status === 'draft');

    let nextStep: DashboardSummary['nextStep'];
    if (pendingOutreach) {
      nextStep = {
        title: 'Approve supplier WhatsApp request (Sample Steel Wire Co.)',
        description:
          'Wire rod emissions are using a high EU default fallback right now. Approve Outreach draft O-1 and simulate the supplier reply to lower Q3 intensity.',
        href: '/app/outreach',
        ctaLabel: 'Review & approve message',
        accent: 'outreach',
      };
    } else if (openBlockers > 0) {
      nextStep = {
        title: `Resolve ${openBlockers} blocking Verifier ${openBlockers === 1 ? 'flag' : 'flags'}`,
        description:
          'The Verifier agent has blocked final CBAM report approval until unit mismatch, supplier conflict, and unsourced factor flags are resolved.',
        href: '/app/verification',
        ctaLabel: 'Fix blocking issues',
        accent: 'verifier',
      };
    } else if (q3.status !== 'approved' && run.state !== 'exported') {
      nextStep = {
        title: 'Approve & export your Q3 2026 CBAM report',
        description:
          'All blocking checks passed and supplier evidence is verified. Review click-to-source numbers and approve the Q3 snapshot.',
        href: '/app/report',
        ctaLabel: 'Open Q3 report',
        accent: 'exporter',
      };
    } else {
      nextStep = {
        title: 'Q3 2026 report approved — view trend & exports',
        description:
          'Download audit-ready PDF or Excel reports, or inspect Q1–Q3 intensity reductions across suppliers.',
        href: '/app/history',
        ctaLabel: 'View Q1–Q3 history',
        accent: 'calculator',
      };
    }

    return {
      companyName: 'Demo Fasteners Pvt Ltd',
      isSample: true,
      period: q3.period,
      product: q3.product,
      cnCode: '7318 15',
      buyerName: 'EuroBolt GmbH (Hamburg, Germany)',
      runId: run.id,
      runState: run.state,
      emissionsPerTonne: q3.emissionsPerTonne,
      previousEmissionsPerTonne: q2.emissionsPerTonne,
      euDefaultPerTonne: q3.euDefaultPerTonne,
      totalProductionTonnes: q3.totalProductionTonnes,
      exportedTonnes: q3.exportedTonnes,
      defaultCarbonPriceEur: 85,
      openGapsCount: openGaps,
      openBlockFlagsCount: openBlockers,
      openWarnFlagsCount: openWarnings,
      actualSharePct: Math.round(q3.basisSummary.actual * 100),
      nextStep,
    };
  },

  async getDocuments(): Promise<DocumentFile[]> {
    await delay(70);
    return cloneJson(loadStore().documents);
  },

  async toggleSampleDocument(documentId: string, selected: boolean): Promise<DocumentFile[]> {
    await delay(60);
    const store = loadStore();
    store.documents = store.documents.map((doc) =>
      doc.id === documentId ? { ...doc, selectedForRun: selected } : doc
    );
    saveStore(store);
    return cloneJson(store.documents);
  },

  async selectAllSampleDocuments(): Promise<DocumentFile[]> {
    await delay(70);
    const store = loadStore();
    store.documents = store.documents.map((doc) => ({ ...doc, selectedForRun: true }));
    saveStore(store);
    return cloneJson(store.documents);
  },

  async uploadDocument(payload: UploadDocumentPayload): Promise<DocumentFile> {
    payload.onProgress?.(35);
    await delay(120);
    payload.onProgress?.(100);
    const store = loadStore();
    const id = `D-U${store.documents.length + 1}`;
    const recId = `R-U${store.ledger.length + 1}`;
    const quote =
      payload.quoteText?.trim() ||
      `Uploaded file ${payload.fileName} queued for Collector extraction (${payload.period}).`;

    const newDoc: DocumentFile = {
      id,
      companyId: 'COMP-DEMO-01',
      fileName: payload.fileName,
      docType: payload.docType,
      formatLabel: payload.formatLabel,
      period: payload.period,
      summary: payload.summary,
      uploadedAt: new Date().toISOString(),
      isSample: false,
      selectedForRun: true,
      previewPages: [
        {
          page: 1,
          title: `${payload.fileName} (User Upload)`,
          subtitle: `Uploaded in browser session | Period: ${payload.period}`,
          lines: [
            { lineNumber: 1, text: `Document summary: ${payload.summary}` },
            { lineNumber: 2, text: quote, highlightRecordId: recId },
          ],
        },
      ],
    };

    const newRecord: LedgerRecord = {
      id: recId,
      documentId: id,
      documentName: payload.fileName,
      page: 1,
      quote,
      field: 'uploaded_user_evidence',
      value: 1,
      unit: 'doc',
      period: payload.period,
      extractedBy: 'collector',
      confidence: 0.92,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    store.documents.unshift(newDoc);
    store.ledger.unshift(newRecord);
    store.runs[0].logs.unshift({
      id: `LOG-${Date.now()}`,
      at: new Date().toISOString(),
      actor: 'collector',
      message: `Added ${payload.fileName} and staged record ${recId} in Evidence Ledger.`,
    });
    saveStore(store);
    return cloneJson(newDoc);
  },

  async getDocumentPreview(documentId: string): Promise<DocumentFile | null> {
    await delay(50);
    const found = loadStore().documents.find((d) => d.id === documentId);
    return found ? cloneJson(found) : null;
  },

  async createRun(period: string, product: string): Promise<PipelineRun> {
    await delay(100);
    const store = loadStore();
    const run = store.runs[0];
    run.period = period;
    run.product = product;
    run.state = 'created';
    run.activeAgent = null;
    run.updatedAt = new Date().toISOString();
    store.simulationCursor = 0;
    saveStore(store);
    return cloneJson(run);
  },

  async getRun(): Promise<PipelineRun> {
    await delay(60);
    const store = recomputeAndSync(loadStore());
    return cloneJson(store.runs[0]);
  },

  async runSimulatedPipelineStep(): Promise<PipelineRun> {
    await delay(140);
    const store = loadStore();
    const run = store.runs[0];
    const openBlockers = store.verification.filter(
      (v) => v.severity === 'block' && v.status === 'open'
    ).length;

    if (store.simulationCursor < SIMULATION_STEPS.length) {
      const step = SIMULATION_STEPS[store.simulationCursor];
      run.state = step.state;
      run.activeAgent = step.actor === 'system' ? null : step.actor;
      run.updatedAt = new Date().toISOString();
      run.logs.unshift({
        id: `LOG-SIM-${Date.now()}-${store.simulationCursor}`,
        at: run.updatedAt,
        actor: step.actor,
        message: step.message,
        detail: step.detail,
      });
      store.simulationCursor += 1;
    } else {
      const finalState: PipelineState =
        openBlockers > 0 ? 'needs_fixes' : 'ready_for_approval';
      run.state = finalState;
      run.activeAgent = openBlockers > 0 ? 'verifier' : 'exporter';
      run.updatedAt = new Date().toISOString();
      run.logs.unshift({
        id: `LOG-SIM-END-${Date.now()}`,
        at: run.updatedAt,
        actor: openBlockers > 0 ? 'verifier' : 'exporter',
        message:
          openBlockers > 0
            ? `Pipeline paused: ${openBlockers} blocking Verifier flags must be fixed.`
            : 'Pipeline completed cleanly — ready for Exporter approval.',
      });
      store.simulationCursor = 0;
    }

    recomputeAndSync(store);
    saveStore(store);
    return cloneJson(run);
  },

  async resetDemoState(): Promise<void> {
    await delay(60);
    const fresh = createSeedStore();
    saveStore(fresh);
  },

  async getLedger(): Promise<LedgerRecord[]> {
    await delay(70);
    return cloneJson(loadStore().ledger);
  },

  async getLedgerRecord(recordId: string): Promise<LedgerRecord | null> {
    await delay(40);
    const found = loadStore().ledger.find((r) => r.id === recordId);
    return found ? cloneJson(found) : null;
  },

  async getGaps(): Promise<GapItem[]> {
    await delay(60);
    return cloneJson(loadStore().gaps);
  },

  async getOutreach(): Promise<OutreachRequest[]> {
    await delay(70);
    return cloneJson(loadStore().outreach);
  },

  async approveOutreach(outreachId: string, editedDraft?: string): Promise<OutreachRequest> {
    await delay(100);
    const store = loadStore();
    const item = store.outreach.find((o) => o.id === outreachId);
    if (!item) throw new Error(`Outreach request ${outreachId} not found.`);

    const finalText = editedDraft?.trim() ? editedDraft.trim() : item.draft;
    item.draft = finalText;
    item.status = 'sent';
    item.tries = Math.max(1, item.tries + 1);
    item.nextFollowupAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    item.thread.push({
      direction: 'out',
      text: finalText,
      at: new Date().toISOString(),
      language: item.language,
    });

    const run = store.runs[0];
    run.state = 'waiting_supplier_reply';
    run.activeAgent = 'outreach';
    run.updatedAt = new Date().toISOString();
    run.logs.unshift({
      id: `LOG-${Date.now()}`,
      at: run.updatedAt,
      actor: 'exporter',
      message: `Approved & sent ${item.channel.toUpperCase()} request to ${item.supplier}.`,
      detail: 'Outreach agent is now awaiting supplier response.',
      targetId: item.id,
    });

    saveStore(store);
    return cloneJson(item);
  },

  async simulateSupplierReply(outreachId: string) {
    await delay(140);
    const store = loadStore();
    const item = store.outreach.find((o) => o.id === outreachId);
    if (!item) throw new Error(`Outreach request ${outreachId} not found.`);

    const replyText =
      item.id === 'O-1'
        ? 'Namaste ji! Verified Q3 EAF steel wire rod intensity is 0.90 tCO2e/t (batch noted ~40 tonnes). Mill sheet attached.'
        : 'Confirmed Q3 process emissions certificate: 1.48 tCO2e/t (Sample illustrative reply).';

    item.status = 'replied';
    item.nextFollowupAt = null;
    item.thread.push({
      direction: 'in',
      text: replyText,
      at: new Date().toISOString(),
      language: item.language,
    });

    if (item.id === 'O-1') {
      const existingR14 = store.ledger.find((r) => r.id === 'R-14');
      if (!existingR14) {
        store.ledger.push({
          id: 'R-14',
          documentId: 'D-12',
          documentName: 'Sample Steel Wire Co - WhatsApp Reply.txt',
          page: 1,
          quote:
            'Message: Namaste ji, our EAF wire rod intensity is 0.90 tCO2e/t for Q3.',
          field: 'precursor_wire_rod_factor',
          value: 0.9,
          unit: 'tCO2e/t',
          period: '2026-Q3',
          extractedBy: 'outreach',
          confidence: 0.95,
          status: 'verified',
          createdAt: new Date().toISOString(),
        });
      } else {
        existingR14.status = 'verified';
      }

      store.gaps = store.gaps.map((g) =>
        g.outreachRequestId === 'O-1' ? { ...g, status: 'resolved_actual' } : g
      );

      store.suppliers = store.suppliers.map((s) =>
        s.id === 'SUP-01'
          ? {
              ...s,
              emissionsPerTonne: 0.9,
              dataQualityScore: 88,
              lastVerifiedAt: new Date().toISOString(),
            }
          : s
      );
    } else {
      store.gaps = store.gaps.map((g) =>
        g.outreachRequestId === item.id ? { ...g, status: 'resolved_actual' } : g
      );
    }

    recomputeAndSync(store);

    const openBlockers = store.verification.filter(
      (v) => v.severity === 'block' && v.status === 'open'
    ).length;
    const run = store.runs[0];
    run.state = openBlockers > 0 ? 'needs_fixes' : 'ready_for_approval';
    run.activeAgent = openBlockers > 0 ? 'verifier' : 'exporter';
    run.updatedAt = new Date().toISOString();
    run.logs.unshift({
      id: `LOG-${Date.now()}`,
      at: run.updatedAt,
      actor: 'calculator',
      message: `${item.supplier} replied! Ledger updated (R-14 = 0.90 tCO2e/t) and Q3 re-evaluated via gap check.`,
      detail: `Q3 emissions updated to ${store.reports.find((r) => r.period === '2026-Q3')?.emissionsPerTonne ?? 2.43} tCO2e/t.`,
      targetId: item.id,
    });

    saveStore(store);
    return {
      outreach: cloneJson(item),
      ledger: cloneJson(store.ledger),
      run: cloneJson(run),
    };
  },

  async simulateNoReplyFallback(outreachId: string) {
    await delay(120);
    const store = loadStore();
    const item = store.outreach.find((o) => o.id === outreachId);
    if (!item) throw new Error(`Outreach request ${outreachId} not found.`);

    item.tries = item.maxTries;
    item.status = 'gave_up';
    item.nextFollowupAt = null;
    item.thread.push({
      direction: 'out',
      text: `Final follow-up (try ${item.maxTries}/${item.maxTries}) unanswered. Gap closed using EU default value.`,
      at: new Date().toISOString(),
      language: 'English',
    });

    store.gaps = store.gaps.map((g) =>
      g.outreachRequestId === item.id ? { ...g, status: 'closed_default' } : g
    );

    recomputeAndSync(store);
    const run = store.runs[0];
    run.updatedAt = new Date().toISOString();
    run.logs.unshift({
      id: `LOG-${Date.now()}`,
      at: run.updatedAt,
      actor: 'outreach',
      message: `No reply from ${item.supplier} after ${item.maxTries} tries — gap closed with EU default label.`,
      targetId: item.id,
    });

    saveStore(store);
    return {
      outreach: cloneJson(item),
      run: cloneJson(run),
    };
  },

  async getCalculations(): Promise<CalculationLine[]> {
    await delay(70);
    const store = recomputeAndSync(loadStore());
    return cloneJson(store.calculations);
  },

  async getEmissionFactors(): Promise<EmissionFactor[]> {
    await delay(60);
    return cloneJson(loadStore().factors);
  },

  async getVerificationFlags(): Promise<VerificationFlag[]> {
    await delay(70);
    return cloneJson(loadStore().verification);
  },

  async resolveVerificationFlag(flagId: string, resolution: 'resolve' | 'accept') {
    await delay(110);
    const store = loadStore();
    const flag = store.verification.find((v) => v.id === flagId);
    if (!flag) throw new Error(`Verification flag ${flagId} not found.`);

    flag.status = resolution === 'resolve' ? 'resolved' : 'accepted';

    if (flag.id === 'V-1') {
      store.ledger = store.ledger.map((r) =>
        r.id === 'R-11' ? { ...r, status: 'superseded' } : r
      );
    } else if (flag.id === 'V-2') {
      store.ledger = store.ledger.map((r) =>
        r.id === 'R-05' ? { ...r, status: 'superseded' } : r
      );
    } else if (flag.id === 'V-3') {
      store.ledger = store.ledger.map((r) =>
        r.id === 'R-15' ? { ...r, status: 'superseded' } : r
      );
    } else if (flag.id === 'V-4') {
      store.ledger = store.ledger.map((r) =>
        r.id === 'R-13' ? { ...r, status: 'rejected' } : r
      );
    }

    recomputeAndSync(store);
    const openBlockers = store.verification.filter(
      (v) => v.severity === 'block' && v.status === 'open'
    ).length;

    const run = store.runs[0];
    run.updatedAt = new Date().toISOString();
    run.logs.unshift({
      id: `LOG-${Date.now()}`,
      at: run.updatedAt,
      actor: 'verifier',
      message: `${flag.code} marked ${flag.status}. ${
        openBlockers === 0
          ? 'All blocking issues cleared — ready for Exporter approval!'
          : `${openBlockers} blocking flag(s) still open.`
      }`,
      targetId: flag.id,
    });

    saveStore(store);
    return {
      flag: cloneJson(flag),
      run: cloneJson(run),
    };
  },

  async approveReport(runId: string): Promise<ReportSnapshot> {
    await delay(120);
    const store = recomputeAndSync(loadStore());
    const openBlockers = store.verification.filter(
      (v) => v.severity === 'block' && v.status === 'open'
    ).length;

    if (openBlockers > 0) {
      throw new Error(
        `Report approval blocked by Verifier: ${openBlockers} open blocking flag(s) remain.`
      );
    }

    const q3Idx = store.reports.findIndex((r) => r.period === '2026-Q3');
    if (q3Idx < 0) throw new Error('Q3 report not found.');

    store.reports[q3Idx].status = 'approved';
    store.reports[q3Idx].approvedAt = new Date().toISOString();
    const run = store.runs.find((r) => r.id === runId) ?? store.runs[0];
    run.state = 'approved';
    run.activeAgent = 'exporter';
    run.updatedAt = store.reports[q3Idx].approvedAt;
    run.logs.unshift({
      id: `LOG-${Date.now()}`,
      at: run.updatedAt,
      actor: 'exporter',
      message: 'Exporter approved Q3 2026 CBAM report snapshot. Exports unlocked.',
    });

    saveStore(store);
    return cloneJson(store.reports[q3Idx]);
  },

  async getReports(): Promise<ReportSnapshot[]> {
    await delay(70);
    const store = recomputeAndSync(loadStore());
    return cloneJson(store.reports);
  },

  async exportReport(reportId: string, format: 'pdf' | 'xlsx') {
    await delay(120);
    const store = recomputeAndSync(loadStore());
    const report =
      store.reports.find((r) => r.id === reportId) ?? store.reports[store.reports.length - 1];
    const run = store.runs[0];
    if (run.state === 'approved') {
      run.state = 'exported';
      run.updatedAt = new Date().toISOString();
      run.logs.unshift({
        id: `LOG-${Date.now()}`,
        at: run.updatedAt,
        actor: 'exporter',
        message: `Exported ${report.period} CBAM snapshot as ${format.toUpperCase()} (Demo sample file).`,
      });
      if (report.period === '2026-Q3') {
        report.status = 'exported';
      }
      saveStore(store);
    }

    if (format === 'pdf') {
      const pdfBytes = buildSimplePdfBytes([
        'CarbonTrace EU CBAM Report (SAMPLE DATA ONLY)',
        `Company: Demo Fasteners Pvt Ltd  |  Period: ${report.period}`,
        `Product: ${report.product}  |  Status: ${report.status.toUpperCase()}`,
        `Embedded Emissions: ${report.emissionsPerTonne.toFixed(2)} tCO2e/t (EU Sample Default: ${report.euDefaultPerTonne.toFixed(2)} tCO2e/t)`,
        `Breakdown -> Direct: ${report.breakdown.direct.toFixed(2)} | Indirect: ${report.breakdown.indirect.toFixed(2)} | Precursors: ${report.breakdown.precursors.toFixed(2)} tCO2e/t`,
        `Data Basis -> Actual: ${Math.round(report.basisSummary.actual * 100)}% | Default: ${Math.round(report.basisSummary.default * 100)}%`,
        `Total Output: ${report.totalProductionTonnes} t  |  EU Exported: ${report.exportedTonnes} t`,
        '--- Calculation Lines (Illustrative Sample Factors) ---',
        ...store.calculations.map(
          (c) => `${c.id}: ${c.label} = ${c.result} ${c.unit} [${c.basis}]`
        ),
        'Disclaimer: Demo prototype with fictional sample company & illustrative emission factors.',
      ]);
      return {
        fileName: `CarbonTrace_${report.period}_CBAM_Sample.pdf`,
        mimeType: 'application/pdf',
        content: pdfBytes,
      };
    }

    const xml = buildSpreadsheetXml(report, store.calculations, store.ledger);
    return {
      fileName: `CarbonTrace_${report.period}_CBAM_Sample.xls`,
      mimeType: 'application/vnd.ms-excel',
      content: xml,
    };
  },

  async getHistory(product = 'Steel Fasteners (CN 7318 15)'): Promise<HistoryResponse> {
    await delay(80);
    const store = recomputeAndSync(loadStore());
    const [q1, q2, q3] = store.reports;

    const deltas: HistoryResponse['deltas'] = [];
    if (q1 && q2) {
      deltas.push({
        fromPeriod: q1.period,
        toPeriod: q2.period,
        totalDelta: Number((q2.emissionsPerTonne - q1.emissionsPerTonne).toFixed(2)),
        drivers: [
          {
            label: 'More verified supplier data (+16% actual)',
            delta: -0.08,
            reason: 'Sample Alloy Traders provided mill emission sheet, replacing EU default.',
          },
          {
            label: 'Lower furnace oil & grid usage',
            delta: -0.09,
            reason: 'Furnace scheduling cut fuel and kWh consumption per tonne.',
          },
        ],
      });
    }
    if (q2 && q3) {
      const q3Diff = Number((q3.emissionsPerTonne - q2.emissionsPerTonne).toFixed(2));
      const wireIsActual = q3.basisSummary.default === 0;
      deltas.push({
        fromPeriod: q2.period,
        toPeriod: q3.period,
        totalDelta: q3Diff,
        drivers: wireIsActual
          ? [
              {
                label: 'EAF wire rod reply replaced EU default',
                delta: -0.08,
                reason:
                  'Sample Steel Wire Co. WhatsApp reply (0.90 tCO2e/t) replaced 1.60 tCO2e/t fallback.',
              },
              {
                label: 'Furnace & grid efficiency gain',
                delta: -0.1,
                reason: 'Direct & indirect intensity improved from 1.57 to 1.47 tCO2e/t.',
              },
            ]
          : [
              {
                label: 'Wire rod temporarily on EU default',
                delta: 0.55,
                reason:
                  'Waiting on Sample Steel Wire Co. reply; EU fallback 1.60 tCO2e/t pushes precursors up.',
              },
              {
                label: 'Direct & electricity efficiency gain',
                delta: -0.1,
                reason: 'Plant direct + electricity intensity improved from 1.57 to 1.47 tCO2e/t.',
              },
            ],
      });
    }

    return {
      product,
      snapshots: cloneJson(store.reports),
      deltas,
    };
  },

  async getSuppliers(): Promise<Supplier[]> {
    await delay(70);
    const suppliers = cloneJson<Supplier[]>(loadStore().suppliers);
    return suppliers.sort((a, b) => b.dataQualityScore - a.dataQualityScore);
  },

  async getSupplier(supplierId: string): Promise<Supplier | null> {
    await delay(50);
    const found = loadStore().suppliers.find((s) => s.id === supplierId);
    return found ? cloneJson(found) : null;
  },

  async appendRunLog(runId: string, item: Omit<ActivityLogItem, 'id' | 'at'>): Promise<PipelineRun> {
    const store = loadStore();
    const run = store.runs.find((r) => r.id === runId) ?? store.runs[0];
    run.logs.unshift({
      id: `LOG-${Date.now()}`,
      at: new Date().toISOString(),
      ...item,
    });
    saveStore(store);
    return cloneJson(run);
  },
};

