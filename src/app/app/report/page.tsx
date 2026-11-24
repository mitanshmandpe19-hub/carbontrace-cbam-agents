'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { computeMoneySaved } from '@/lib/calculations';
import { formatEuro, formatNumber, formatShortDate } from '@/lib/formatters';
import { useChartTheme } from '@/lib/useChartTheme';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { GlossaryTooltip } from '@/components/shared/GlossaryTooltip';
import {
  EmptyStateCard,
  PageErrorState,
  PageLoadingSkeleton,
} from '@/components/shared/QueryState';
import { useSourceViewer } from '@/components/shared/SourceViewerContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ReportPage() {
  const { openSource } = useSourceViewer();
  const chartTheme = useChartTheme();
  const fetchReportBundle = React.useCallback(async () => {
    const [reports, calcs, factorList, flagList] = await Promise.all([
      api.getReports(),
      api.getCalculations('RUN-2026-Q3'),
      api.getEmissionFactors(),
      api.getVerificationFlags('RUN-2026-Q3'),
    ]);
    return {
      report:
        reports.find((r) => r.period === '2026-Q3') ?? reports[reports.length - 1],
      calculations: calcs,
      factors: factorList,
      flags: flagList,
    };
  }, []);
  const {
    data: bundle,
    setData: setBundle,
    loading,
    error,
    refetch: loadReport,
  } = useDemoQuery(fetchReportBundle);
  const report = bundle?.report ?? null;
  const calculations = bundle?.calculations ?? [];
  const factors = bundle?.factors ?? [];
  const flags = bundle?.flags ?? [];
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onReset = () => setNotice(null);
    window.addEventListener('carbontrace:demo-reset', onReset);
    return () => window.removeEventListener('carbontrace:demo-reset', onReset);
  }, []);

  const openBlockers = flags.filter((f) => f.severity === 'block' && f.status === 'open');
  const isApproved = report?.status === 'approved' || report?.status === 'exported';

  async function handleApprove() {
    if (!report) return;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await api.approveReport('RUN-2026-Q3');
      setBundle((prev) => (prev ? { ...prev, report: updated } : prev));
      setNotice('Q3 2026 CBAM report approved and locked as an audit snapshot. PDF and Excel exports are now enabled.');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to approve report.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format: 'pdf' | 'xlsx') {
    if (!report) return;
    setBusy(true);
    try {
      const file = await api.exportReport(report.id, format);
      const blobPart: BlobPart =
        typeof file.content === 'string'
          ? file.content
          : new Uint8Array(file.content);
      const blob = new Blob([blobPart], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice(`Downloaded export file: ${file.fileName} (labelled Sample Data).`);
      await loadReport();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to export report right now.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <PageLoadingSkeleton cards={2} rows={4} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={loadReport} />;
  }

  if (!report) {
    return (
      <EmptyStateCard
        title="No carbon report ready yet"
        hint="Upload your files and run the team to build a Q3 snapshot."
      />
    );
  }

  const savings = computeMoneySaved({
    euDefaultPerTonne: report.euDefaultPerTonne,
    actualPerTonne: report.emissionsPerTonne,
    exportedTonnes: report.exportedTonnes,
    carbonPriceEur: 85,
  });

  const chartData = [
    { name: 'Fuel', value: report.breakdown.direct, color: chartTheme.seriesColors.fuel },
    { name: 'Power', value: report.breakdown.indirect, color: chartTheme.seriesColors.power },
    { name: 'Inputs', value: report.breakdown.precursors, color: chartTheme.seriesColors.inputs },
    { name: 'Total Q3', value: report.emissionsPerTonne, color: chartTheme.seriesColors.total },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AgentBadge agent="calculator" />
            <AgentBadge agent="exporter" />
            <Badge variant={isApproved ? 'success' : openBlockers.length > 0 ? 'danger' : 'exporter'}>
              {isApproved
                ? `Approved (${formatShortDate(report.approvedAt)})`
                : openBlockers.length > 0
                  ? 'Blocked'
                  : 'Ready'}
            </Badge>
          </div>
          <h1 className="ct-page-title">
            Carbon Report — {report.period}
          </h1>
          <p className="ct-body">
            Click any number or row to view the source bill.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="default"
            disabled={busy || openBlockers.length > 0 || isApproved}
            onClick={handleApprove}
          >
            {isApproved ? (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approved
              </>
            ) : openBlockers.length > 0 ? (
              <>
                <Lock className="h-4 w-4" aria-hidden="true" />
                Approve (Blocked)
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Approve
              </>
            )}
          </Button>

          <Button
            variant="outline"
            disabled={busy || !isApproved}
            onClick={() => void handleExport('pdf')}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            disabled={busy || !isApproved}
            onClick={() => void handleExport('xlsx')}
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Export Excel
          </Button>
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] px-5 py-3.5 text-base font-semibold text-[var(--ct-outreach-text)]"
        >
          {notice}
        </div>
      ) : null}

      {openBlockers.length > 0 ? (
        <Card className="border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-start gap-3 text-base">
              <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-verifier-text)]" aria-hidden="true" />
              <div>
                <p className="font-bold text-[var(--ct-ink)]">
                  {openBlockers.length} blocking issue(s) must be fixed first.
                </p>
              </div>
            </div>
            <Link
              href="/app/verification"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-[var(--ct-verifier-btn)] px-4 py-2 text-base font-bold text-white hover:bg-[var(--ct-verifier-btn-hover)]"
            >
              Fix issues
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {/* Top Summary & Chart */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>
              <GlossaryTooltip term="embedded emissions" label="Carbon in your product" />
            </CardTitle>
            <CardDescription>
              Click any card below to inspect the source file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <button
              type="button"
              onClick={() => openSource({ recordId: 'R-10', documentId: 'D-09', page: 1 })}
              className="w-full rounded-2xl ct-hero-gradient border border-[var(--ct-exporter-border)] p-5 text-left transition-transform hover:scale-[1.01] cursor-pointer"
            >
              <p className="text-[14px] font-bold uppercase tracking-wide text-[var(--ct-exporter-text)]">
                Total per tonne
              </p>
              <p className="ct-stat-number mt-2 text-[var(--ct-ink)]">
                {formatNumber(report.emissionsPerTonne, 2)}
              </p>
              <p className="ct-stat-label mt-1">
                tCO2e/t · {Math.round(report.basisSummary.actual * 100)}% real · {Math.round(report.basisSummary.default * 100)}% default
              </p>
            </button>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => openSource({ recordId: 'R-12', documentId: 'D-10', page: 1 })}
                className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-4 text-left hover:bg-[var(--ct-exporter-soft)] cursor-pointer"
              >
                <p className="text-[14px] font-semibold text-[var(--ct-ink-secondary)]">EU Shipped</p>
                <p className="ct-tabular mt-1 text-2xl font-bold text-[var(--ct-ink)]">
                  {report.exportedTonnes} t
                </p>
                <p className="mt-1 text-[14px] font-semibold text-[var(--ct-collector-text)]">View proof</p>
              </button>

              <div className="rounded-xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] p-4">
                <p className="text-[14px] font-semibold text-[var(--ct-outreach-text)]">Saved (@€85/t)</p>
                <p className="ct-tabular mt-1 text-2xl font-bold text-[var(--ct-outreach-text)]">
                  {formatEuro(savings.moneySavedEur)}
                </p>
                <p className="mt-1 text-[14px] text-[var(--ct-ink-secondary)]">
                  vs {report.euDefaultPerTonne.toFixed(2)} default
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Where your carbon comes from</CardTitle>
            <CardDescription>
              Fuel, power, and <GlossaryTooltip term="precursor" label="input materials" /> vs EU default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <figure>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 16, right: 20, left: 0, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                    <XAxis dataKey="name" tick={{ fill: chartTheme.tickPrimary, fontSize: 14 }} />
                    <YAxis domain={[0, 4]} tick={{ fill: chartTheme.tickSecondary, fontSize: 14 }} />
                    <Tooltip
                      contentStyle={chartTheme.tooltipContentStyle}
                      itemStyle={chartTheme.tooltipItemStyle}
                      labelStyle={chartTheme.tooltipLabelStyle}
                      cursor={{ fill: chartTheme.cursorFill }}
                      formatter={(val) => [`${Number(val).toFixed(2)} tCO2e/t`, 'Carbon']}
                    />
                    <ReferenceLine
                      y={report.euDefaultPerTonne}
                      stroke={chartTheme.defaultLineStroke}
                      strokeDasharray="5 5"
                      label={{
                        value: `EU Default ${report.euDefaultPerTonne}`,
                        position: 'insideTopRight',
                        fill: chartTheme.defaultLabelFill,
                        fontSize: 14,
                      }}
                    />
                    <Bar isAnimationActive={false} dataKey="value" radius={[10, 10, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <figcaption className="mt-3 text-[14px] text-[var(--ct-ink-secondary)]">
                Fuel: {report.breakdown.direct.toFixed(2)} · Power: {report.breakdown.indirect.toFixed(2)} · Inputs: {report.breakdown.precursors.toFixed(2)} tCO2e/t.
              </figcaption>
            </figure>
          </CardContent>
        </Card>
      </div>

      {/* 4-Column Calculation Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Carbon Breakdown</CardTitle>
          <CardDescription>
            Click any row to see the exact bill behind the number.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div tabIndex={0} role="region" aria-label="Calculation lines" className="overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-[var(--ct-border)] bg-[var(--ct-surface-raised)] text-[14px] font-bold uppercase tracking-wide text-[var(--ct-ink-secondary)]">
                  <th scope="col" className="px-4 py-3.5">Item</th>
                  <th scope="col" className="px-4 py-3.5">Data type</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Carbon</th>
                  <th scope="col" className="px-4 py-3.5 text-right">Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ct-divide)]">
                {calculations.map((line) => {
                  const firstRec = line.inputRecordIds[0];
                  return (
                    <tr
                      key={line.id}
                      onClick={() => {
                        if (firstRec) openSource({ recordId: firstRec, title: `${line.label} (${line.formulaText})` });
                      }}
                      className="cursor-pointer transition-colors hover:bg-[var(--ct-exporter-soft)]/50"
                    >
                      <th scope="row" className="px-4 py-4 font-semibold text-[var(--ct-ink)]">
                        {line.label}
                      </th>
                      <td className="px-4 py-4">
                        <Badge variant={line.basis === 'actual' ? 'success' : 'warning'}>
                          {line.basis}
                        </Badge>
                      </td>
                      <td className="ct-tabular px-4 py-4 text-right text-base font-bold text-[var(--ct-ink)]">
                        {line.result.toFixed(2)} {line.unit}
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (firstRec) openSource({ recordId: firstRec, title: `${line.label} (${line.formulaText})` });
                          }}
                          aria-label={`View proof for ${line.id}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          View proof
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Extra details: formulas & sample factor citations */}
      <details className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5 sm:p-6 shadow-xs">
        <summary className="ct-card-title cursor-pointer list-none">
          Show details: Formulas and sample factors
        </summary>
        <div className="mt-4 space-y-4">
          <ul className="space-y-2 text-[14px] text-[var(--ct-ink-secondary)]">
            {calculations.map((line) => (
              <li key={line.id} className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-3">
                <strong className="text-[var(--ct-ink)]">{line.id} · {line.label}:</strong> {line.formulaText}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[14px] text-[var(--ct-ink-secondary)]">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--ct-calculator)]" aria-hidden="true" />
              <span>
                Factors:{' '}
                {factors
                  .filter((f) => f.id !== 'F-6')
                  .map((f) => `${f.id} (${f.source})`)
                  .join(' · ')}
              </span>
            </div>
            <span className="font-bold text-[var(--ct-calculator-text)]">Sample factor (illustrative)</span>
          </div>
        </div>
      </details>
    </div>
  );
}
