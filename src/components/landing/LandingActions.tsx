'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthContext';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { notifyToast } from '@/components/shared/FeedbackProvider';

export function LandingHeaderNav() {
  const { isAuthenticated } = useAuth();

  return (
    <nav aria-label="Landing Navigation" className="flex items-center gap-3 sm:gap-4">
      <Link
        href="/app/ledger"
        className="hidden sm:inline-flex min-h-[44px] items-center text-base font-semibold text-[var(--ct-ink-secondary)] hover:text-[var(--ct-ink)]"
      >
        Proof list
      </Link>
      {!isAuthenticated ? (
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center text-base font-semibold text-[var(--ct-ink-secondary)] hover:text-[var(--ct-ink)]"
        >
          Log in
        </Link>
      ) : null}
      <ThemeToggle />
      <Link
        href="/app"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--ct-exporter-btn)] px-5 py-2.5 text-base font-bold text-white hover:bg-[var(--ct-exporter-btn-hover)]"
      >
        Open app
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}

export function LandingHeroActions() {
  const router = useRouter();
  const { loginAsDemo } = useAuth();
  const [loading, setLoading] = React.useState(false);

  async function handleTrySample() {
    if (loading) return;
    setLoading(true);
    try {
      await loginAsDemo();
      router.push('/app');
    } catch (err) {
      notifyToast(
        'error',
        err instanceof Error ? err.message : 'Could not open sample session.'
      );
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-3 pt-1">
      <button
        type="button"
        onClick={handleTrySample}
        disabled={loading}
        className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl bg-[var(--ct-exporter-btn)] px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-[var(--ct-exporter-btn-hover)] cursor-pointer disabled:opacity-75"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Opening sample...
          </>
        ) : (
          <>
            Try with sample files
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </>
        )}
      </button>
      <Link
        href="/app/upload"
        className="inline-flex min-h-[50px] items-center gap-2 rounded-2xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-6 py-3 text-base font-bold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)]"
      >
        Upload your own
      </Link>
    </div>
  );
}
