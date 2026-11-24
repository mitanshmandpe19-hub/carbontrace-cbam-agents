'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Pause,
  Play,
  Radio,
  Sparkles,
  StepForward,
  UserCheck,
} from 'lucide-react';
import { api, USE_MOCK_API } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import {
  AGENT_METADATA,
  formatTimeShort,
  PIPELINE_STATE_LABELS,
} from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { AgentRole, PipelineRun, PipelineState } from '@/types';
import { AgentBadge } from '@/components/shared/AgentBadge';
import {
  EmptyStateCard,
  PageErrorState,
  PageLoadingSkeleton,
} from '@/components/shared/QueryState';
import { HubSceneWrapper } from '@/components/three/HubSceneWrapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const PIPELINE_STEPS: {
  state: PipelineState;
  label: string;
  actor: AgentRole;
}[] = [
  { state: 'created', label: 'Created', actor: 'collector' },
  { state: 'collecting', label: 'Collecting', actor: 'collector' },
  { state: 'gaps_found', label: 'Gaps check', actor: 'outreach' },
  { state: 'awaiting_message_approval', label: 'Approve msg', actor: 'exporter' },
  { state: 'waiting_supplier_reply', label: 'Supplier reply', actor: 'outreach' },
  { state: 'calculating', label: 'Calculating', actor: 'calculator' },
  { state: 'verifying', label: 'Verifying', actor: 'verifier' },
  { state: 'needs_fixes', label: 'Needs fixes', actor: 'verifier' },
  { state: 'ready_for_approval', label: 'Ready', actor: 'exporter' },
  { state: 'approved', label: 'Approved', actor: 'exporter' },
  { state: 'exported', label: 'Exported', actor: 'exporter' },
];

export default function AgentRunPage() {
  const fetchRun = React.useCallback(() => api.getRun('RUN-2026-Q3'), []);
  const {
    data: run,
    setData: setRun,
    loading,
    error,
    refetch: loadRun,
  } = useDemoQuery(fetchRun);
  const [runningSim, setRunningSim] = React.useState(false);
  const [creatingRun, setCreatingRun] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [streamMode, setStreamMode] = React.useState<'mock' | 'sse' | 'polling'>(
    USE_MOCK_API ? 'mock' : 'sse'
  );

  React.useEffect(() => {
    const onReset = () => {
      setRunningSim(false);
      setActionError(null);
    };
    window.addEventListener('carbontrace:demo-reset', onReset);
    return () => window.removeEventListener('carbontrace:demo-reset', onReset);
  }, []);

  // Subscribe to backend SSE stream with automatic polling fallback.
  React.useEffect(() => {
    if (USE_MOCK_API || !run?.id || !api.streamRun) return;
    setStreamMode('sse');
    const unsubscribe = api.streamRun(
      run.id,
      (updatedRun: PipelineRun) => {
        setRun(updatedRun);
      },
      () => {
        setStreamMode('polling');
      }
    );
    return unsubscribe;
  }, [run?.id, setRun]);

  // Polling fallback when SSE disconnects or while run is actively progressing.
  React.useEffect(() => {
    if (USE_MOCK_API || !run?.id) return;
    const isTransientState =
      run.state === 'created' ||
      run.state === 'collecting' ||
      run.state === 'gaps_found' ||
      run.state === 'calculating' ||
      run.state === 'verifying';
    if (streamMode !== 'polling' && !isTransientState) return;

    const interval = setInterval(async () => {
      try {
        const next = await api.getRun(run.id);
        setRun(next);
      } catch {
        // Ignore transient poll errors; FeedbackProvider surfaces real failures.
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [run?.id, run?.state, streamMode, setRun]);

  // Interactive step simulation timer (used in mock mode or manual playback).
  React.useEffect(() => {
    if (!runningSim || !run) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const next = await api.runSimulatedPipelineStep(run.id);
        if (cancelled) return;
        setRun(next);
        if (
          next.state === 'awaiting_message_approval' ||
          next.state === 'needs_fixes' ||
          next.state === 'ready_for_approval' ||
          next.state === 'approved' ||
          next.state === 'exported'
        ) {
          setRunningSim(false);
        }
      } catch (err) {
        if (!cancelled) {
          setActionError(err instanceof Error ? err.message : 'Unable to advance pipeline.');
          setRunningSim(false);
        }
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runningSim, run, setRun]);

  async function handleStepOnce() {
    if (!run) return;
    setActionError(null);
    try {
      const next = await api.runSimulatedPipelineStep(run.id);
      setRun(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to run step.');
    }
  }

  async function handleStartFreshRun() {
    setCreatingRun(true);
    setActionError(null);
    try {
      const nextRun = await api.createRun(
        run?.period ?? '2026-Q3',
        run?.product ?? 'Steel Fasteners (Hex Bolts & Nuts)'
      );
      setRun(nextRun);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start agent run.');
    } finally {
      setCreatingRun(false);
    }
  }

  if (loading) {
    return <PageLoadingSkeleton cards={2} rows={4} />;
  }

  if (error) {
    return (
      <PageErrorState
        message={error}
        onRetry={loadRun}
      />
    );
  }

  if (!run) {
    return (
      <EmptyStateCard
        title="No agent run yet"
        hint="Start a run to extract facts and check your bills."
        action={
          <Button onClick={handleStartFreshRun} disabled={creatingRun}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {creatingRun ? 'Starting…' : 'Start run'}
          </Button>
        }
      />
    );
  }

  const currentIdx = PIPELINE_STEPS.findIndex((s) => s.state === run.state);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="exporter">{run.period}</Badge>
            <Badge variant={run.state === 'needs_fixes' ? 'danger' : 'success'}>
              {PIPELINE_STATE_LABELS[run.state]}
            </Badge>
            {!USE_MOCK_API ? (
              <Badge variant="collector">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                {streamMode === 'sse' ? 'Live stream' : 'Polling'}
              </Badge>
            ) : null}
          </div>
          <h1 className="ct-page-title">Agent Team Run</h1>
          <p className="ct-body">Watch all four agents work around your proof list.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!USE_MOCK_API ? (
            <Button
              variant="default"
              onClick={handleStartFreshRun}
              disabled={creatingRun || runningSim}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {creatingRun ? 'Starting…' : 'New run'}
            </Button>
          ) : (
            <Button
              variant={runningSim ? 'magenta' : 'default'}
              onClick={() => setRunningSim((prev) => !prev)}
            >
              {runningSim ? (
                <>
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Run pipeline
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleStepOnce} disabled={runningSim || creatingRun}>
            <StepForward className="h-4 w-4" aria-hidden="true" />
            Step once
          </Button>
        </div>
      </div>

      {actionError ? (
        <PageErrorState message={actionError} onRetry={loadRun} />
      ) : null}

      {/* 3D Hub-and-Spoke Scene (with automatic 2D fallback) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Live Agent Hub</CardTitle>
              <CardDescription>
                The working agent lights up while pulses travel to the proof cube.
              </CardDescription>
            </div>
            {run.activeAgent ? <AgentBadge agent={run.activeAgent} /> : null}
          </div>
        </CardHeader>
        <CardContent>
          <HubSceneWrapper
            variant="workspace"
            activeAgent={run.activeAgent}
            runState={run.state}
            hasVerifierBlocker={run.state === 'needs_fixes'}
          />
        </CardContent>
      </Card>

      {/* Live Step Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Step Progress</CardTitle>
          <CardDescription>
            Purple steps pause for your approval before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {PIPELINE_STEPS.map((step, index) => {
              const meta = AGENT_METADATA[step.actor];
              const backendStep = run.steps?.find((s) => s.state === step.state);
              const isDone = backendStep
                ? backendStep.status === 'completed'
                : index < currentIdx;
              const isCurrent = backendStep
                ? backendStep.status === 'active'
                : index === currentIdx;
              return (
                <li
                  key={step.state}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'rounded-xl border p-3.5 text-[14px] transition-colors',
                    isCurrent
                      ? 'border-[var(--ct-exporter)] bg-[var(--ct-exporter-soft)] shadow-xs'
                      : isDone
                        ? 'border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)]'
                        : 'border-[var(--ct-border)] bg-[var(--ct-surface-subtle)]'
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[14px] font-bold text-[var(--ct-ink-secondary)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: meta.accentCss }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-1.5 font-bold text-[var(--ct-ink)]">{step.label}</p>
                  <p className="mt-0.5 text-[14px] text-[var(--ct-ink-secondary)]">
                    {step.actor === 'exporter' ? 'Your approval' : meta.name}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] px-4 py-3.5 text-[15px]">
            <div className="flex items-center gap-2 text-[var(--ct-ink-secondary)]">
              <UserCheck className="h-5 w-5 text-[var(--ct-exporter)]" aria-hidden="true" />
              <span>Approve messages or fix flags to finish this run.</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/app/outreach"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-base font-bold text-[var(--ct-outreach-text)] hover:underline"
              >
                Messages
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/app/verification"
                className="inline-flex min-h-[44px] items-center gap-1.5 text-base font-bold text-[var(--ct-verifier-text)] hover:underline"
              >
                Checks
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log behind disclosure */}
      <details className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5 shadow-xs sm:p-6">
        <summary className="ct-card-title cursor-pointer list-none">
          Show details: Activity log ({run.logs.length} events)
        </summary>
        <ul className="mt-4 space-y-3" aria-live="polite">
          {run.logs.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-2 rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <AgentBadge agent={entry.actor} />
                  <span className="text-base font-bold text-[var(--ct-ink)]">
                    {entry.message}
                  </span>
                </div>
                {entry.detail ? <p className="ct-body">{entry.detail}</p> : null}
              </div>
              <time
                dateTime={entry.at}
                className="shrink-0 text-[14px] font-medium text-[var(--ct-ink-secondary)]"
              >
                {formatTimeShort(entry.at)}
              </time>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
