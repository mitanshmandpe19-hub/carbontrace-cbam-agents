import type {
  CalculationLine,
  EmissionFactor,
  LedgerRecord,
  ReportSnapshot,
} from '@/types';

export interface EmbeddedEmissionsInput {
  directTonnesCO2e: number;
  indirectTonnesCO2e: number;
  precursorsTonnesCO2e: number;
  productionTonnes: number;
}

export interface EmbeddedEmissionsResult {
  totalTonnesCO2e: number;
  perTonne: number;
  breakdownPerTonne: {
    direct: number;
    indirect: number;
    precursors: number;
  };
}

/**
 * Deterministic embedded emissions formula mirroring backend Python Calculator.
 * embedded_emissions_per_tonne = (direct + indirect + precursors) / tonnes_of_product_made
 */
export function computeEmbeddedEmissions(
  input: EmbeddedEmissionsInput
): EmbeddedEmissionsResult {
  const safeTonnes = input.productionTonnes > 0 ? input.productionTonnes : 1;
  const totalTonnesCO2e = roundTo(
    input.directTonnesCO2e + input.indirectTonnesCO2e + input.precursorsTonnesCO2e,
    2
  );
  const directPerTonne = roundTo(input.directTonnesCO2e / safeTonnes, 2);
  const indirectPerTonne = roundTo(input.indirectTonnesCO2e / safeTonnes, 2);
  const precursorsPerTonne = roundTo(input.precursorsTonnesCO2e / safeTonnes, 2);
  const perTonne = roundTo(totalTonnesCO2e / safeTonnes, 2);

  return {
    totalTonnesCO2e,
    perTonne,
    breakdownPerTonne: {
      direct: directPerTonne,
      indirect: indirectPerTonne,
      precursors: precursorsPerTonne,
    },
  };
}

export interface MoneySavedInput {
  euDefaultPerTonne: number;
  actualPerTonne: number;
  exportedTonnes: number;
  carbonPriceEur: number;
}

export interface MoneySavedResult {
  perTonneSaved: number;
  totalTonnesCO2eSaved: number;
  moneySavedEur: number;
  percentReductionVsDefault: number;
}

/**
 * Deterministic money-saved calculation:
 * money_saved_view = (EU_default_per_tonne - actual_per_tonne) * tonnes * carbon_price
 */
export function computeMoneySaved(input: MoneySavedInput): MoneySavedResult {
  const perTonneSaved = roundTo(
    Math.max(0, input.euDefaultPerTonne - input.actualPerTonne),
    2
  );
  const totalTonnesCO2eSaved = roundTo(
    perTonneSaved * Math.max(0, input.exportedTonnes),
    2
  );
  const moneySavedEur = roundTo(
    totalTonnesCO2eSaved * Math.max(0, input.carbonPriceEur),
    2
  );
  const percentReductionVsDefault =
    input.euDefaultPerTonne > 0
      ? roundTo((perTonneSaved / input.euDefaultPerTonne) * 100, 1)
      : 0;

  return {
    perTonneSaved,
    totalTonnesCO2eSaved,
    moneySavedEur,
    percentReductionVsDefault,
  };
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Recompute Q3 calculations and snapshot deterministically from Evidence Ledger records and factor table.
 */
export function recomputeQ3Calculations(
  ledger: LedgerRecord[],
  factors: EmissionFactor[],
  existingQ3: ReportSnapshot
): {
  calculations: CalculationLine[];
  snapshot: ReportSnapshot;
} {
  const findRecord = (id: string) => ledger.find((r) => r.id === id);
  const findFactor = (id: string) => factors.find((f) => f.id === id);

  const furnaceOil = findRecord('R-04')?.value ?? 10000;
  const diesel = findRecord('R-06')?.value ?? 4000;
  const elecJul = findRecord('R-01')?.value ?? 14000;
  const elecAug = findRecord('R-02')?.value ?? 16000;
  const elecSep = findRecord('R-03')?.value ?? 15000;
  const totalKwh = elecJul + elecAug + elecSep;

  const wireRodTonnes = findRecord('R-07')?.value ?? 45;
  const alloyTonnes = findRecord('R-08')?.value ?? 6;
  const alloyFactorVal = findRecord('R-09')?.value ?? findFactor('F-5')?.value ?? 1.25;
  const finishedTonnes = findRecord('R-10')?.value ?? 50;
  const exportedTonnes = findRecord('R-12')?.value ?? 46;

  const wireRodActualRecord = ledger.find(
    (r) => r.id === 'R-14' && r.status === 'verified'
  );
  const wireRodFactor = wireRodActualRecord
    ? findFactor('F-4B') ?? { id: 'F-4B', value: wireRodActualRecord.value }
    : findFactor('F-4') ?? { id: 'F-4', value: 1.6 };
  const wireRodBasis = wireRodActualRecord ? 'actual' : 'default';

  const f1 = findFactor('F-1')?.value ?? 0.0031;
  const f2 = findFactor('F-2')?.value ?? 0.00275;
  const f3 = findFactor('F-3')?.value ?? 0.0007;

  const c1Result = roundTo(furnaceOil * f1, 2);
  const c2Result = roundTo(diesel * f2, 2);
  const c3Result = roundTo(totalKwh * f3, 2);
  const c4Result = roundTo(wireRodTonnes * wireRodFactor.value, 2);
  const c5Result = roundTo(alloyTonnes * alloyFactorVal, 2);

  const directTotal = roundTo(c1Result + c2Result, 2);
  const indirectTotal = c3Result;
  const precursorsTotal = roundTo(c4Result + c5Result, 2);

  const summary = computeEmbeddedEmissions({
    directTonnesCO2e: directTotal,
    indirectTonnesCO2e: indirectTotal,
    precursorsTonnesCO2e: precursorsTotal,
    productionTonnes: finishedTonnes,
  });

  const totalCO2e = summary.totalTonnesCO2e;
  const actualCO2e =
    directTotal +
    indirectTotal +
    c5Result +
    (wireRodBasis === 'actual' ? c4Result : 0);
  const actualShare = totalCO2e > 0 ? roundTo(actualCO2e / totalCO2e, 2) : 0;
  const defaultShare = roundTo(Math.max(0, 1 - actualShare), 2);

  const calculations: CalculationLine[] = [
    {
      id: 'C-1',
      label: 'Direct emissions — Furnace oil',
      category: 'direct',
      formulaText: `furnace_oil(R-04: ${furnaceOil.toLocaleString('en-IN')} L) x factor(F-1: ${f1} tCO2e/L)`,
      inputRecordIds: ['R-04'],
      factorIds: ['F-1'],
      result: c1Result,
      unit: 'tCO2e',
      basis: 'actual',
    },
    {
      id: 'C-2',
      label: 'Direct emissions — Diesel generator',
      category: 'direct',
      formulaText: `diesel(R-06: ${diesel.toLocaleString('en-IN')} L) x factor(F-2: ${f2} tCO2e/L)`,
      inputRecordIds: ['R-06'],
      factorIds: ['F-2'],
      result: c2Result,
      unit: 'tCO2e',
      basis: 'actual',
    },
    {
      id: 'C-3',
      label: 'Indirect emissions — Grid electricity',
      category: 'indirect',
      formulaText: `electricity(R-01+R-02+R-03: ${totalKwh.toLocaleString('en-IN')} kWh) x grid_factor(F-3: ${f3} tCO2e/kWh)`,
      inputRecordIds: ['R-01', 'R-02', 'R-03'],
      factorIds: ['F-3'],
      result: c3Result,
      unit: 'tCO2e',
      basis: 'actual',
    },
    {
      id: 'C-4',
      label: 'Precursor — Steel wire rod (Sample Steel Wire Co.)',
      category: 'precursors',
      formulaText: `wire_rod(R-07: ${wireRodTonnes} t) x ${
        wireRodBasis === 'actual'
          ? `supplier_verified(F-4B: ${wireRodFactor.value.toFixed(2)} tCO2e/t)`
          : `eu_default_fallback(F-4: ${wireRodFactor.value.toFixed(2)} tCO2e/t)`
      }`,
      inputRecordIds: wireRodActualRecord ? ['R-07', 'R-14'] : ['R-07'],
      factorIds: [wireRodFactor.id],
      result: c4Result,
      unit: 'tCO2e',
      basis: wireRodBasis,
    },
    {
      id: 'C-5',
      label: 'Precursor — Zinc & alloy wire (Sample Alloy Traders)',
      category: 'precursors',
      formulaText: `alloy_wire(R-08: ${alloyTonnes} t) x supplier_factor(F-5: ${alloyFactorVal.toFixed(2)} tCO2e/t)`,
      inputRecordIds: ['R-08', 'R-09'],
      factorIds: ['F-5'],
      result: c5Result,
      unit: 'tCO2e',
      basis: 'actual',
    },
    {
      id: 'C-6',
      label: 'Total embedded emissions per tonne (Q3 2026)',
      category: 'intensity',
      formulaText: `(direct ${directTotal.toFixed(1)} + indirect ${indirectTotal.toFixed(1)} + precursors ${precursorsTotal.toFixed(1)}) / finished_fasteners(R-10: ${finishedTonnes} t)`,
      inputRecordIds: [
        'R-04',
        'R-06',
        'R-01',
        'R-02',
        'R-03',
        ...(wireRodActualRecord ? ['R-07', 'R-14'] : ['R-07']),
        'R-08',
        'R-10',
      ],
      factorIds: ['F-1', 'F-2', 'F-3', wireRodFactor.id, 'F-5'],
      result: summary.perTonne,
      unit: 'tCO2e/t',
      basis: wireRodBasis,
    },
  ];

  const snapshot: ReportSnapshot = {
    ...existingQ3,
    emissionsPerTonne: summary.perTonne,
    breakdown: summary.breakdownPerTonne,
    basisSummary: {
      actual: actualShare,
      default: defaultShare,
    },
    totalProductionTonnes: finishedTonnes,
    exportedTonnes,
  };

  return { calculations, snapshot };
}

