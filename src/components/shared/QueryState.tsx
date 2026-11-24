'use client';

import * as React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

export function PageLoadingSkeleton({
  rows = 3,
  cards = 4,
}: {
  rows?: number;
  cards?: number;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading screen data">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, idx) => (
          <div
            key={idx}
            className="h-32 animate-pulse rounded-[18px] border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5"
          >
            <div className="h-4 w-28 rounded bg-[var(--ct-skeleton)]" />
            <div className="mt-4 h-9 w-24 rounded bg-[var(--ct-skeleton)]" />
            <div className="mt-3 h-3.5 w-36 rounded bg-[var(--ct-skeleton)]" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-[18px] border border-[var(--ct-border)] bg-[var(--ct-surface)] p-6">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-14 animate-pulse rounded-xl bg-[var(--ct-skeleton)]"
          />
        ))}
      </div>
    </div>
  );
}

export function PageErrorState({
  message,
  onRetry,
}: {
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <section
      role="alert"
      className="rounded-[18px] border border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] p-6 text-[var(--ct-ink)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle
            size={22}
            className="mt-0.5 shrink-0 text-[var(--ct-verifier)]"
          />
          <div>
            <h2 className="text-[18px] font-semibold text-[var(--ct-ink)]">
              Could not load data
            </h2>
            <p className="mt-1 max-w-[65ch] text-[15px] leading-[1.6] text-[var(--ct-ink-secondary)]">
              {message || 'Check that the server is running and try again.'}
            </p>
          </div>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--ct-verifier-btn)] px-5 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-[var(--ct-verifier-btn-hover)]"
          >
            <RefreshCw size={16} />
            Retry
          </button>
        )}
      </div>
    </section>
  );
}

export function EmptyStateCard({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-start justify-between gap-4 rounded-[18px] border border-dashed border-[var(--ct-border-strong)] bg-[var(--ct-surface)] p-6 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3.5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ct-surface-raised)] text-[var(--ct-ink-secondary)]">
          <Inbox size={20} />
        </div>
        <div>
          <h3 className="text-[18px] font-semibold text-[var(--ct-ink)]">{title}</h3>
          <p className="mt-1 max-w-[65ch] text-[15px] leading-[1.6] text-[var(--ct-ink-secondary)]">
            {hint}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}

