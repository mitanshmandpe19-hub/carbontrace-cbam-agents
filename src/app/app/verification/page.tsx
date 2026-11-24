'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { cn } from '@/lib/utils';
import type { VerificationFlag } from '@/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const PLAIN_FLAG_COPY: Record<string, { title: string; line: string }> = {
  'V-1': {
    title: 'Unit mismatch',
    line: 'Electricity is in MWh here but kWh on the bill.',
  },
  'V-2': {
    title: 'Duplicate fuel bill',
    line: 'Same furnace oil bill uploaded twice; remove the copy.',
  },
  'V-3': {
    title: 'Supplier weight mismatch',
    line: 'Message says 40 tonnes while the invoice says 45.',
  },
  'V-4': {
    title: 'Missing factor proof',
    line: 'Hand-typed gas rate has no source document; remove it.',
  },
};

export default function VerificationPage() {
  const { openSource } = useSourceViewer();
  const fetchFlags = React.useCallback(
    () => api.getVerificationFlags('RUN-2026-Q3'),
    []
  );
  const {
    data: fetchedFlags,
    setData: setFlags,
    loading,
    error,
    refetch: loadFlags,
  } = useDemoQuery(fetchFlags);
  const flags = fetchedFlags ?? [];
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  async function handleResolve(flagId: string, resolution: 'resolve' | 'accept') {
    setBusyId(flagId);
    setActionError(null);
    try {
      const res = await api.resolveVerificationFlag(flagId, resolution);
      setFlags((prev) => (prev ?? []).map((f) => (f.id === res.flag.id ? res.flag : f)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update flag.');
    } finally {
      setBusyId(null);
    }
  }

  function inspectTarget(flag: VerificationFlag) {
    if (flag.targetType === 'emission_factor') {
      openSource({ recordId: 'R-13', documentId: 'D-11', page: 1, title: 'Floor Supervisor Note - Custom Gas Factor.txt' });
      return;
    }
    openSource({ recordId: flag.targetId });
  }

  const openBlockers = flags.filter((f) => f.severity === 'block' && f.status === 'open').length;
  const openWarns = flags.filter((f) => f.severity === 'warn' && f.status === 'open').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <AgentBadge agent="verifier" />
          <h1 className="ct-page-title">
            Quality Checks
          </h1>
          <p className="ct-body">
            Fix blocking issues before you approve your report.
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

      {/* Verifier Gate Summary Banner */}
      <Card
        className={cn(
          openBlockers > 0
            ? 'border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)]'
            : 'border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)]'
        )}
      >
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            {openBlockers > 0 ? (
              <AlertOctagon className="mt-1 h-6 w-6 shrink-0 text-[var(--ct-verifier-text)]" aria-hidden="true" />
            ) : (
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[var(--ct-outreach-text)]" aria-hidden="true" />
            )}
            <div className="space-y-1">
              <h2 className="ct-section-title">
                {openBlockers > 0
                  ? `${openBlockers} blocking issue(s) open`
                  : 'All blocking checks passed'}
              </h2>
              <p className="ct-body">
                {openBlockers > 0
                  ? `${openWarns} warning also listed below.`
                  : 'Your Q3 report is ready to approve.'}
              </p>
            </div>
          </div>

          {openBlockers === 0 ? (
            <Link
              href="/app/report"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-[var(--ct-exporter-btn)] px-5 py-2.5 text-base font-bold text-white hover:bg-[var(--ct-exporter-btn-hover)]"
            >
              Approve report
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </CardContent>
      </Card>

      {actionError ? <PageErrorState message={actionError} onRetry={loadFlags} /> : null}

      {/* Flag Cards */}
      {error ? (
        <PageErrorState message={error} onRetry={loadFlags} />
      ) : loading ? (
        <PageLoadingSkeleton cards={0} rows={4} />
      ) : flags.length === 0 ? (
        <EmptyStateCard
          title="No quality flags yet"
          hint="Run the pipeline on uploaded files to check for errors."
        />
      ) : (
        <div className="space-y-5">
          {flags.map((flag) => {
            const isOpen = flag.status === 'open';
            const isBlock = flag.severity === 'block';
            const baseKey = flag.id.includes('V-')
              ? `V-${flag.id.split('V-').pop()}`
              : flag.id;
            const copy = PLAIN_FLAG_COPY[baseKey] ?? {
              title: flag.code,
              line: flag.message,
            };
            return (
              <Card
                key={flag.id}
                className={cn(
                  'transition-all',
                  isOpen && isBlock
                    ? 'border-[var(--ct-verifier-border)]'
                    : isOpen
                      ? 'border-[var(--ct-calculator-border)]'
                      : 'border-[var(--ct-outreach-border)] bg-[var(--ct-surface)]'
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={isBlock ? 'danger' : 'warning'}>
                        {isBlock ? (
                          <AlertOctagon className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        )}
                        {flag.severity.toUpperCase()} · {flag.code}
                      </Badge>
                    </div>
                    <Badge variant={isOpen ? 'danger' : 'success'}>
                      {isOpen ? 'Open' : flag.status}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2">{copy.title}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="ct-body">{copy.line}</p>

                  <details className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] px-4 py-3 text-[15px] text-[var(--ct-ink-secondary)]">
                    <summary className="cursor-pointer font-semibold text-[var(--ct-ink)]">
                      Show details
                    </summary>
                    <p className="mt-2 leading-relaxed">{flag.plainExplanation}</p>
                    <p className="mt-2 text-[var(--ct-ink)]">
                      <strong>Action:</strong> {flag.suggestedFix}
                    </p>
                  </details>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => inspectTarget(flag)}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      View proof
                    </Button>

                    {isOpen ? (
                      <div className="flex flex-wrap gap-3">
                        {!isBlock ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === flag.id}
                            onClick={() => void handleResolve(flag.id, 'accept')}
                          >
                            Accept warning
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={isBlock ? 'magenta' : 'orange'}
                          disabled={busyId === flag.id}
                          onClick={() => void handleResolve(flag.id, 'resolve')}
                        >
                          <Wrench className="h-4 w-4" aria-hidden="true" />
                          Fix issue
                        </Button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[var(--ct-outreach-text)]">
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        Fixed
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
