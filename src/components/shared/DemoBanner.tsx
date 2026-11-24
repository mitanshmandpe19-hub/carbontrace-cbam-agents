'use client';

import * as React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';

export function DemoBanner({ onReset }: { onReset?: () => void }) {
  const [resetting, setResetting] = React.useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await api.resetDemoState();
      onReset?.();
      window.dispatchEvent(new CustomEvent('carbontrace:demo-reset'));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Demo mode notice"
      className="ct-demo-banner border-b px-4 py-2.5 text-[14px] leading-snug sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 font-medium text-[var(--ct-ink)] min-w-0">
          <span
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[14px] font-bold border border-transparent dark:border-[#FF5294]/45"
            style={{
              backgroundColor: 'var(--ct-banner-pill-bg)',
              color: 'var(--ct-banner-pill-ink)',
            }}
          >
            <Sparkles
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--ct-banner-pill-icon)' }}
              aria-hidden="true"
            />
            Demo mode: sample data
          </span>
          <span className="min-w-0 text-[14px] text-[var(--ct-ink)]">
            Sample factory data and illustrative factors only.
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-4 py-2 text-base font-bold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)] cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {resetting ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>
    </div>
  );
}
