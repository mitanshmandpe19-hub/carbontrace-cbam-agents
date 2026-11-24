'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { formatShortDate } from '@/lib/formatters';
import { useChartTheme } from '@/lib/useChartTheme';
import { Badge } from '@/components/ui/badge';
import {
  EmptyStateCard,
  PageErrorState,
  PageLoadingSkeleton,
} from '@/components/shared/QueryState';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function HistoryPage() {
  const chartTheme = useChartTheme();
  const fetchHistory = React.useCallback(() => api.getHistory('steel-fasteners'), []);
  const { data: history, loading, error, refetch: loadHistory } = useDemoQuery(fetchHistory);

  if (loading) {
    return <PageLoadingSkeleton cards={3} rows={2} />;
  }

  if (error) {
    return <PageErrorState message={error} onRetry={loadHistory} />;
  }

  if (!history || history.snapshots.length === 0) {
    return (
      <EmptyStateCard
        title="No quarter history yet"
        hint="Approve your first CBAM report to start tracking quarterly progress."
      />
    );
  }

  const chartSeries = history.snapshots.map((snap) => ({
    period: snap.period,
    total: snap.emissionsPerTonne,
    direct: snap.breakdown.direct,
    indirect: snap.breakdown.indirect,
    precursors: snap.breakdown.precursors,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="calculator">Q1–Q3 2026</Badge>
          <h1 className="ct-page-title">
            Quarter History
          </h1>
          <p className="ct-body">
            See how the carbon in your product changed across quarters.
          </p>
        </div>
        <Link
          href="/app/report"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--ct-exporter-btn)] px-5 py-2.5 text-base font-bold text-white hover:bg-[var(--ct-exporter-btn-hover)]"
        >
          Open report
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Carbon per tonne over time</CardTitle>
          <CardDescription>
            Steel fasteners across Q1, Q2, and Q3 2026.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <figure>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartSeries} margin={{ top: 14, right: 20, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridStroke} />
                  <XAxis dataKey="period" tick={{ fill: chartTheme.tickPrimary, fontSize: 14 }} />
                  <YAxis domain={[0, 4]} tick={{ fill: chartTheme.tickSecondary, fontSize: 14 }} />
                  <Tooltip
                    contentStyle={chartTheme.tooltipContentStyle}
                    itemStyle={chartTheme.tooltipItemStyle}
                    labelStyle={chartTheme.tooltipLabelStyle}
                  />
                  <Legend wrapperStyle={chartTheme.legendStyle} />
                  <ReferenceLine
                    y={3.45}
                    stroke={chartTheme.defaultLineStroke}
                    strokeDasharray="5 5"
                    label={{
                      value: 'EU Default (3.45)',
                      position: 'insideTopRight',
                      fill: chartTheme.defaultLabelFill,
                      fontSize: 14,
                    }}
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="total"
                    name="Total tCO2e/t"
                    stroke={chartTheme.seriesColors.total}
                    strokeWidth={3}
                    dot={{ r: 5 }}
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="precursors"
                    name="Inputs"
                    stroke={chartTheme.seriesColors.inputs}
                    strokeWidth={2}
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="direct"
                    name="Fuel"
                    stroke={chartTheme.seriesColors.fuel}
                    strokeWidth={2}
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="indirect"
                    name="Power"
                    stroke={chartTheme.seriesColors.power}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="mt-3 text-[14px] text-[var(--ct-ink-secondary)]">
              Q1: 2.78 → Q2: 2.61 → Q3: {history.snapshots[2]?.emissionsPerTonne.toFixed(2)} tCO2e/t.
            </figcaption>
          </figure>
        </CardContent>
      </Card>

      {/* Period Snapshot Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {history.snapshots.map((snap, idx) => {
          const prev = idx > 0 ? history.snapshots[idx - 1] : null;
          const diff = prev
            ? Number((snap.emissionsPerTonne - prev.emissionsPerTonne).toFixed(2))
            : null;
          const isApproved = snap.status === 'approved' || snap.status === 'exported';

          return (
            <Card key={snap.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={isApproved ? 'success' : 'warning'}>
                    {isApproved ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Clock className="h-4 w-4" aria-hidden="true" />
                    )}
                    {snap.status.replaceAll('_', ' ')}
                  </Badge>
                  <span className="text-[14px] font-semibold text-[var(--ct-ink-secondary)]">{snap.period}</span>
                </div>
                <div className="mt-3">
                  <p className="ct-stat-number text-[var(--ct-ink)]">
                    {snap.emissionsPerTonne.toFixed(2)}
                  </p>
                  <p className="ct-stat-label mt-1">tCO2e per tonne</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-[14px]">
                {diff !== null ? (
                  <div
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold ${
                      diff <= 0
                        ? 'bg-[var(--ct-outreach-soft)] text-[var(--ct-outreach-text)]'
                        : 'bg-[var(--ct-calculator-soft)] text-[var(--ct-calculator-text)]'
                    }`}
                  >
                    {diff <= 0 ? (
                      <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    )}
                    {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} vs {prev?.period}
                  </div>
                ) : (
                  <span className="inline-block rounded-full bg-[var(--ct-surface-raised)] px-3 py-1 font-semibold text-[var(--ct-ink-secondary)]">
                    First quarter
                  </span>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold text-[var(--ct-ink-secondary)]">
                    <span>Real data share</span>
                    <span>{Math.round(snap.basisSummary.actual * 100)}%</span>
                  </div>
                  <Progress
                    value={snap.basisSummary.actual * 100}
                    label={`${snap.period} actual data share`}
                    barColorClass="bg-[var(--ct-outreach)]"
                  />
                </div>

                <p className="text-[14px] text-[var(--ct-ink-secondary)]">
                  Approved: <strong className="text-[var(--ct-ink)]">{formatShortDate(snap.approvedAt)}</strong>
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* What Changed Breakdown behind Show details */}
      <details className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5 sm:p-6 shadow-xs">
        <summary className="ct-card-title cursor-pointer list-none">
          Show details: What changed between quarters
        </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {history.deltas.map((delta) => (
            <div
              key={`${delta.fromPeriod}-${delta.toPeriod}`}
              className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="ct-card-title">
                  {delta.fromPeriod} → {delta.toPeriod}
                </h3>
                <Badge variant={delta.totalDelta <= 0 ? 'success' : 'warning'}>
                  {delta.totalDelta > 0 ? `+${delta.totalDelta.toFixed(2)}` : delta.totalDelta.toFixed(2)} tCO2e/t
                </Badge>
              </div>
              <ul className="space-y-2.5 text-[15px]">
                {delta.drivers.map((drv) => (
                  <li
                    key={drv.label}
                    className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-4"
                  >
                    <div className="flex items-center justify-between gap-2 font-bold text-[var(--ct-ink)]">
                      <span>{drv.label}</span>
                      <span>
                        {drv.delta > 0 ? `+${drv.delta.toFixed(2)}` : drv.delta.toFixed(2)}
                      </span>
                    </div>
                    <p className="ct-body mt-1">{drv.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
