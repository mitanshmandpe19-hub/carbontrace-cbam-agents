import type { AgentRole, PipelineState, VerificationCode } from '@/types';

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatEuro(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatInrEquivalent(eurAmount: number, eurToInr = 90): string {
  const inr = Math.round(eurAmount * eurToInr);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(inr);
}

export function formatPercent(fractionOrPct: number, isFraction = true): string {
  const pct = isFraction ? fractionOrPct * 100 : fractionOrPct;
  return `${Math.round(pct)}%`;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return 'Pending approval';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTimeShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const PIPELINE_STATE_LABELS: Record<PipelineState, string> = {
  created: 'Ready to start',
  collecting: 'Reading files',
  gaps_found: 'Missing info found',
  awaiting_message_approval: 'Approve message',
  waiting_supplier_reply: 'Waiting for reply',
  calculating: 'Calculating carbon',
  verifying: 'Checking proof',
  needs_fixes: 'Fixes needed',
  ready_for_approval: 'Ready to approve',
  approved: 'Approved',
  exported: 'Exported',
};

export const AGENT_METADATA: Record<
  AgentRole,
  {
    name: string;
    shortRole: string;
    accentHex: string;
    accentCss: string;
    textHex: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
  }
> = {
  collector: {
    name: 'Collector',
    shortRole: 'Reads your bills and logs.',
    accentHex: '#1E63B5',
    accentCss: 'var(--ct-collector)',
    textHex: '#174E91',
    bgClass: 'bg-[var(--ct-collector-soft)]',
    textClass: 'text-[var(--ct-collector-text)]',
    borderClass: 'border-[var(--ct-collector-border)]',
    dotClass: 'bg-[var(--ct-collector)]',
  },
  outreach: {
    name: 'Outreach',
    shortRole: 'Asks suppliers for missing data.',
    accentHex: '#00897B',
    accentCss: 'var(--ct-outreach)',
    textHex: '#00695C',
    bgClass: 'bg-[var(--ct-outreach-soft)]',
    textClass: 'text-[var(--ct-outreach-text)]',
    borderClass: 'border-[var(--ct-outreach-border)]',
    dotClass: 'bg-[var(--ct-outreach)]',
  },
  calculator: {
    name: 'Calculator',
    shortRole: 'Does fixed code math.',
    accentHex: '#EF6C00',
    accentCss: 'var(--ct-calculator)',
    textHex: '#A64600',
    bgClass: 'bg-[var(--ct-calculator-soft)]',
    textClass: 'text-[var(--ct-calculator-text)]',
    borderClass: 'border-[var(--ct-calculator-border)]',
    dotClass: 'bg-[var(--ct-calculator)]',
  },
  verifier: {
    name: 'Verifier',
    shortRole: 'Blocks errors without proof.',
    accentHex: '#D81B60',
    accentCss: 'var(--ct-verifier)',
    textHex: '#AD1457',
    bgClass: 'bg-[var(--ct-verifier-soft)]',
    textClass: 'text-[var(--ct-verifier-text)]',
    borderClass: 'border-[var(--ct-verifier-border)]',
    dotClass: 'bg-[var(--ct-verifier)]',
  },
  exporter: {
    name: 'You (Owner)',
    shortRole: 'Approves messages and final report.',
    accentHex: '#6A1B9A',
    accentCss: 'var(--ct-exporter)',
    textHex: '#5A1485',
    bgClass: 'bg-[var(--ct-exporter-soft)]',
    textClass: 'text-[var(--ct-exporter-text)]',
    borderClass: 'border-[var(--ct-exporter-border)]',
    dotClass: 'bg-[var(--ct-exporter)]',
  },
};

export const VERIFICATION_CODE_LABELS: Record<VerificationCode, string> = {
  NO_EVIDENCE: 'Missing proof',
  RECALC_MISMATCH: 'Math mismatch',
  UNIT_MISMATCH: 'Unit mismatch',
  DUPLICATE_DOCUMENT: 'Duplicate file',
  OUT_OF_RANGE: 'Unusual number',
  CROSS_DOC_CONFLICT: 'File conflict',
  PERIOD_MISMATCH: 'Wrong quarter',
  FACTOR_NO_SOURCE: 'Missing factor proof',
  SUPPLIER_CONFLICT: 'Supplier weight mismatch',
};

export const GLOSSARY_TERMS: Record<string, string> = {
  CBAM: 'EU Carbon Border Adjustment Mechanism: an import fee on steel and other carbon-heavy goods.',
  'embedded emissions':
    'Official EU CBAM term: "Embedded emissions" — total CO2 released making your product.',
  precursor:
    'Official EU CBAM term: "Precursor" — raw steel or coating wire bought from suppliers.',
  'default value':
    'Official EU CBAM term: "Default value" — a higher EU fallback number used when real data is missing.',
  'emission factor':
    'Official term: "Emission factor" — CO2 released per kWh, litre, or tonne. Demo values are illustrative only.',
  'evidence ledger':
    'Technical term: "Evidence Ledger" — our central table linking every number to its exact document quote.',
};

