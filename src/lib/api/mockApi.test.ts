import { beforeEach, describe, expect, it } from 'vitest';
import { api } from './index';

describe('CarbonTrace mockApi workflow', () => {
  beforeEach(async () => {
    await api.resetDemoState();
  });

  it('starts with 4 Verifier flags (3 blocking, 1 warning) and blocks report approval', async () => {
    const flags = await api.getVerificationFlags();
    expect(flags).toHaveLength(4);
    expect(flags.filter((f) => f.severity === 'block' && f.status === 'open')).toHaveLength(3);

    await expect(api.approveReport('RUN-2026-Q3')).rejects.toThrow(/blocked by Verifier/i);
  });

  it('approves outreach, simulates reply, updates ledger R-14, and lowers Q3 intensity to 2.43', async () => {
    const approved = await api.approveOutreach('O-1');
    expect(approved.status).toBe('sent');

    const replyRes = await api.simulateSupplierReply('O-1');
    expect(replyRes.outreach.status).toBe('replied');
    expect(replyRes.ledger.some((r) => r.id === 'R-14' && r.value === 0.9)).toBe(true);

    const calcs = await api.getCalculations();
    const wireLine = calcs.find((c) => c.id === 'C-4');
    const totalLine = calcs.find((c) => c.id === 'C-6');
    expect(wireLine?.basis).toBe('actual');
    expect(totalLine?.result).toBe(2.43);
  });

  it('closes unanswered outreach with EU default fallback after max retries', async () => {
    const res = await api.simulateNoReplyFallback('O-3');
    expect(res.outreach.status).toBe('gave_up');
    expect(res.outreach.tries).toBe(res.outreach.maxTries);
    const gaps = await api.getGaps();
    expect(gaps.find((g) => g.outreachRequestId === 'O-3')?.status).toBe('closed_default');
  });

  it('unlocks report approval and exports PDF/Excel once all blocking flags are resolved', async () => {
    await api.resolveVerificationFlag('V-1', 'resolve');
    await api.resolveVerificationFlag('V-3', 'resolve');
    await api.resolveVerificationFlag('V-4', 'resolve');

    const snapshot = await api.approveReport('RUN-2026-Q3');
    expect(snapshot.status).toBe('approved');
    expect(snapshot.approvedAt).toBeTruthy();

    const pdf = await api.exportReport(snapshot.id, 'pdf');
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.content).toBeInstanceOf(Uint8Array);

    const xls = await api.exportReport(snapshot.id, 'xlsx');
    expect(xls.fileName.endsWith('.xls')).toBe(true);
    expect(String(xls.content)).toContain('SAMPLE DATA ONLY');
  });
});

