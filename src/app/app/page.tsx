'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  FileSearch,
  MessageSquare,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { computeMoneySaved } from '@/lib/calculations';
import {
  formatEuro,
  formatInrEquivalent,
  formatNumber,
  PIPELINE_STATE_LABELS,
} from '@/lib/formatters';
import type { AgentRole } from '@/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
import { GlossaryTooltip } from '@/components/shared/GlossaryTooltip';
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
import { Progress } from '@/components/ui/progress';

const NEXT_BTN_BG: Record<AgentRole, string> = {
  collector: 'bg-[var(--ct-collector-btn)] hover:bg-[var(--ct-collector-btn-hover)]',
  outreach: 'bg-[var(--ct-outreach-btn)] hover:bg-[var(--ct-outreach-btn-hover)]',
  calculator: 'bg-[var(--ct-calculator-btn)] hover:bg-[var(--ct-calculator-btn-hover)]',
  verifier: 'bg-[var(--ct-verifier-btn)] hover:bg-[var(--ct-verifier-btn-hover)]',
  exporter: 'bg-[var(--ct-exporter-btn)] hover:bg-[var(--ct-exporter-btn-hover)]',
};

export default function DashboardPage() {
  const { openSource } = useSourceViewer();
  const fetchDashboard = React.useCallback(() => api.getDashboard('2026-Q3'), []);
  const {
    data: summary,
    loading,
    error,
    refetch: loadDashboard,
  } = useDemoQuery(fetchDashboard);
  const [carbonPrice, setCarbonPrice] = React.useState<number>(85);
  const [showDetails, setShowDetails] = React.useState(false);

  React.useEffect(() => {
    if (summary?.defaultCarbonPriceEur) {
      setCarbonPrice(summary.defaultCarbonPriceEur);
    }
  }, [summary?.defaultCarbonPriceEur]);

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading dashboard">
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--ct-skeleton)]" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 animate-pulse rounded-2xl bg-[var(--ct-skeleton)]" />
          ))}
        </div>
        <div className="h-44 animate-pulse rounded-2xl bg-[var(--ct-skeleton)]" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)]">
        <CardHeader>
          <CardTitle className="text-[var(--ct-verifier-text)]">Could not load dashboard</CardTitle>
          <CardDescription>{error ?? 'Please try loading the page again.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadDashboard}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const deltaVsPrev = Number(
    (summary.emissionsPerTonne - summary.previousEmissionsPerTonne).toFixed(2)
  );
  const isLowerThanPrev = deltaVsPrev <= 0;
  const savings = computeMoneySaved({
    euDefaultPerTonne: summary.euDefaultPerTonne,
    actualPerTonne: summary.emissionsPerTonne,
    exportedTonnes: summary.exportedTonnes,
    carbonPriceEur: carbonPrice,
  });

  const shortNextTitle =
    summary.nextStep.accent === 'outreach'
      ? 'Approve supplier WhatsApp message'
      : summary.nextStep.accent === 'verifier'
        ? `Fix ${summary.openBlockFlagsCount} blocking issues`
        : summary.nextStep.accent === 'exporter'
          ? 'Approve your Q3 report'
          : 'Review Q1–Q3 trend';
  const shortNextDesc =
    summary.nextStep.accent === 'outreach'
      ? 'Ask Sample Steel Wire Co. for real data to replace EU defaults.'
      : summary.nextStep.accent === 'verifier'
        ? 'Resolve flagged mismatches so you can approve the final report.'
        : summary.nextStep.accent === 'exporter'
          ? 'All checks passed and your Q3 numbers are ready to approve.'
          : 'Download your approved report or compare past quarters.';
  const shortNextCta =
    summary.nextStep.accent === 'outreach'
      ? 'Send message'
      : summary.nextStep.accent === 'verifier'
        ? 'Fix issues'
        : summary.nextStep.accent === 'exporter'
          ? 'Open report'
          : 'View history';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="exporter">{summary.period}</Badge>
            <Badge variant={summary.openBlockFlagsCount > 0 ? 'danger' : 'success'}>
              {PIPELINE_STATE_LABELS[summary.runState]}
            </Badge>
          </div>
          <h1 className="ct-page-title">
            {summary.companyName} Dashboard
          </h1>
          <p className="ct-body">
            Q3 2026 steel fasteners shipped to EuroBolt GmbH, Germany.
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

      {/* Prominent Next Step Card */}
      <Card className="ct-hero-gradient border-[var(--ct-exporter-border)]">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface)] px-3 py-1 text-[14px] font-bold text-[var(--ct-exporter-text)] shadow-2xs">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Next step
              </span>
              <AgentBadge agent={summary.nextStep.accent} />
            </div>
            <h2 className="ct-section-title">{shortNextTitle}</h2>
            <p className="ct-body">{shortNextDesc}</p>
          </div>
          <Link
            href={summary.nextStep.href}
            className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-bold text-white shadow-sm ${NEXT_BTN_BG[summary.nextStep.accent]}`}
          >
            <span>{shortNextCta}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      {/* Primary KPI Grid */}
      <section aria-label="Key Metrics" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>
              <GlossaryTooltip term="embedded emissions" label="Carbon in your product" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="ct-stat-number text-[var(--ct-ink)]">
                {formatNumber(summary.emissionsPerTonne, 2)}
              </p>
              <p className="ct-stat-label mt-1">tCO2e per tonne made</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[14px]">
              {isLowerThanPrev ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ct-outreach-soft)] px-2.5 py-0.5 font-semibold text-[var(--ct-outreach-text)]">
                  <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                  {Math.abs(deltaVsPrev).toFixed(2)} vs Q2 ({summary.previousEmissionsPerTonne.toFixed(2)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ct-calculator-soft)] px-2.5 py-0.5 font-semibold text-[var(--ct-calculator-text)]">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  +{deltaVsPrev.toFixed(2)} vs Q2 ({summary.previousEmissionsPerTonne.toFixed(2)})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => openSource({ recordId: 'R-10', title: 'Production Log Q3 2026.xlsx' })}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-[14px] font-semibold text-[var(--ct-collector-text)] hover:underline cursor-pointer"
            >
              <FileSearch className="h-4 w-4" aria-hidden="true" />
              View proof ({summary.totalProductionTonnes} t)
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[var(--ct-calculator)]" aria-hidden="true" />
              <span>Money saved</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="ct-stat-number text-[var(--ct-outreach-text)]">
                {formatEuro(savings.moneySavedEur, 0)}
              </p>
              <p className="ct-stat-label mt-1">
                {formatInrEquivalent(savings.moneySavedEur)} vs{' '}
                <GlossaryTooltip term="default value" label={`EU default (${summary.euDefaultPerTonne})`} />
              </p>
            </div>
            <button
              type="button"
              onClick={() => openSource({ recordId: 'R-12', title: 'EU Shipment List Q3 2026.xlsx' })}
              className="inline-flex min-h-[36px] items-center gap-1.5 text-[14px] font-semibold text-[var(--ct-collector-text)] hover:underline cursor-pointer"
            >
              <FileSearch className="h-4 w-4" aria-hidden="true" />
              View proof ({summary.exportedTonnes} t)
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[var(--ct-outreach)]" aria-hidden="true" />
              <span>Missing info</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="ct-stat-number text-[var(--ct-outreach-text)]">
                {summary.openGapsCount}
              </p>
              <p className="ct-stat-label mt-1">
                supplier gaps · {summary.actualSharePct}% real data
              </p>
            </div>
            <Progress
              value={summary.actualSharePct}
              label="Share of emissions backed by actual supplier and plant data"
              barColorClass="bg-[var(--ct-outreach)]"
            />
            <Link
              href="/app/outreach"
              className="inline-flex min-h-[36px] items-center gap-1.5 text-[14px] font-semibold text-[var(--ct-outreach-text)] hover:underline"
            >
              Messages
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[var(--ct-verifier)]" aria-hidden="true" />
              <span>Verifier flags</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="ct-stat-number text-[var(--ct-verifier-text)]">
                {summary.openBlockFlagsCount}
              </p>
              <p className="ct-stat-label mt-1">
                blocking · {summary.openWarnFlagsCount} warning
              </p>
            </div>
            <p className="text-[14px] leading-snug text-[var(--ct-ink-secondary)]">
              {summary.openBlockFlagsCount > 0
                ? 'Fix blocking flags to unlock approval.'
                : 'All checks passed for sign-off.'}
            </p>
            <Link
              href="/app/verification"
              className="inline-flex min-h-[36px] items-center gap-1.5 text-[14px] font-semibold text-[var(--ct-verifier-text)] hover:underline"
            >
              Fix issues
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((prev) => !prev)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </Button>
      </div>

      {showDetails ? (
        <section aria-label="Calculator and Trust Guarantees" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Carbon Price Savings Slider</CardTitle>
              <CardDescription>
                Adjust EU carbon price to test Q3 savings on {summary.exportedTonnes} tonnes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label htmlFor="carbon-price-slider" className="text-[15px] font-semibold text-[var(--ct-ink)]">
                  EU carbon price
                </label>
                <span className="ct-tabular rounded-lg bg-[var(--ct-calculator-soft)] px-3 py-1.5 text-[15px] font-bold text-[var(--ct-calculator-text)]">
                  €{carbonPrice} / tCO2e
                </span>
              </div>
              <input
                id="carbon-price-slider"
                type="range"
                min={50}
                max={130}
                step={5}
                value={carbonPrice}
                onChange={(e) => setCarbonPrice(Number(e.target.value))}
                className="h-2.5 w-full cursor-pointer accent-[#EF6C00]"
              />
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-4 text-center">
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ct-ink-secondary)]">EU Default</p>
                  <p className="ct-tabular mt-1 text-lg font-bold text-[var(--ct-ink)]">
                    {formatEuro(summary.euDefaultPerTonne * summary.exportedTonnes * carbonPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ct-ink-secondary)]">Your Data</p>
                  <p className="ct-tabular mt-1 text-lg font-bold text-[var(--ct-collector-text)]">
                    {formatEuro(summary.emissionsPerTonne * summary.exportedTonnes * carbonPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--ct-outreach-text)]">Net Saved</p>
                  <p className="ct-tabular mt-1 text-lg font-extrabold text-[var(--ct-outreach-text)]">
                    {formatEuro(savings.moneySavedEur)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Our 4 Rules</CardTitle>
              <CardDescription>
                Simple safeguards built into every step.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-base leading-[1.6] text-[var(--ct-ink)]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-collector)]" aria-hidden="true" />
                  <span>
                    Every number links to the{' '}
                    <GlossaryTooltip term="evidence ledger" label="proof list" />.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-calculator)]" aria-hidden="true" />
                  <span>Fixed code runs math using sample factors.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-exporter)]" aria-hidden="true" />
                  <span>You approve every supplier message and report.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-verifier)]" aria-hidden="true" />
                  <span>Verifier blocks reports with missing proof.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
