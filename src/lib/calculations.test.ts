import { describe, expect, it } from 'vitest';
import {
  computeEmbeddedEmissions,
  computeMoneySaved,
  recomputeQ3Calculations,
} from './calculations';
import {
  formatEuro,
  formatInrEquivalent,
  formatNumber,
  formatPercent,
} from './formatters';
import rawFactors from '@/mock/factors.json';
import rawLedger from '@/mock/ledger.json';
import rawReports from '@/mock/reports.json';
import type { EmissionFactor, LedgerRecord, ReportSnapshot } from '@/types';

describe('CarbonTrace deterministic calculations', () => {
  it('computes embedded emissions per tonne as (direct + indirect + precursors) / production', () => {
    const result = computeEmbeddedEmissions({
      directTonnesCO2e: 42.0,
      indirectTonnesCO2e: 31.5,
      precursorsTonnesCO2e: 48.0,
      productionTonnes: 50,
    });

    expect(result.totalTonnesCO2e).toBe(121.5);
    expect(result.perTonne).toBe(2.43);
    expect(result.breakdownPerTonne).toEqual({
      direct: 0.84,
      indirect: 0.63,
      precursors: 0.96,
    });
  });

  it('computes money saved against EU default emissions accurately', () => {
    const saved = computeMoneySaved({
      euDefaultPerTonne: 3.45,
      actualPerTonne: 2.43,
      exportedTonnes: 46,
      carbonPriceEur: 85,
    });

    expect(saved.perTonneSaved).toBe(1.02);
    expect(saved.totalTonnesCO2eSaved).toBe(46.92);
    expect(saved.moneySavedEur).toBe(3988.2);
    expect(saved.percentReductionVsDefault).toBe(29.6);
  });

  it('recomputes Q3 calculations with EU default initially and switches to actual on R-14', () => {
    const ledger = rawLedger as LedgerRecord[];
    const factors = rawFactors as EmissionFactor[];
    const q3 = (rawReports as ReportSnapshot[]).find((r) => r.period === '2026-Q3')!;

    const withDefault = recomputeQ3Calculations(ledger, factors, q3);
    expect(withDefault.snapshot.emissionsPerTonne).toBe(3.06);
    expect(withDefault.calculations.find((c) => c.id === 'C-4')?.basis).toBe('default');

    const ledgerWithReply: LedgerRecord[] = [
      ...ledger,
      {
        id: 'R-14',
        documentId: 'D-12',
        documentName: 'Sample Steel Wire Co - WhatsApp Reply.txt',
        page: 1,
        quote: 'Our EAF wire rod intensity is 0.90 tCO2e/t',
        field: 'precursor_wire_rod_factor',
        value: 0.9,
        unit: 'tCO2e/t',
        period: '2026-Q3',
        extractedBy: 'outreach',
        confidence: 0.95,
        status: 'verified',
      },
    ];

    const withActual = recomputeQ3Calculations(ledgerWithReply, factors, q3);
    expect(withActual.snapshot.emissionsPerTonne).toBe(2.43);
    expect(withActual.calculations.find((c) => c.id === 'C-4')?.basis).toBe('actual');
    expect(withActual.snapshot.basisSummary.actual).toBe(1);
  });
});

describe('CarbonTrace formatting helpers', () => {
  it('formats numbers, currencies, and percentages deterministically', () => {
    expect(formatNumber(2.435, 2)).toBe('2.44');
    expect(formatPercent(0.82)).toBe('82%');
    expect(formatEuro(3988.2, 2)).toContain('3,988.20');
    expect(formatInrEquivalent(100, 90)).toContain('9,000');
  });
});

