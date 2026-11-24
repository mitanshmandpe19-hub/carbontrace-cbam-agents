'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bot,
  FileCheck2,
  FileSpreadsheet,
  FolderUp,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthContext';
import { DemoBanner } from '@/components/shared/DemoBanner';
import { GlossaryProvider } from '@/components/shared/GlossaryTooltip';
import { SourceViewerProvider } from '@/components/shared/SourceViewerContext';
import { SourceViewerDrawer } from '@/components/shared/SourceViewerDrawer';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

const NAV_ITEMS = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/upload', label: 'Files', icon: FolderUp },
  { href: '/app/run', label: 'Agent team', icon: Bot },
  { href: '/app/ledger', label: 'Proof list', icon: FileSpreadsheet },
  { href: '/app/outreach', label: 'Messages', icon: MessageSquare },
  { href: '/app/verification', label: 'Checks', icon: ShieldAlert },
  { href: '/app/report', label: 'Report', icon: FileCheck2 },
  { href: '/app/history', label: 'History', icon: History },
  { href: '/app/suppliers', label: 'Suppliers', icon: Users },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, hydrated, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  // Prevent unauthenticated flash while checking sessionStorage.
  if (!hydrated || !isAuthenticated) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--ct-bg)] px-4 text-[var(--ct-ink)]"
        aria-busy="true"
        aria-label="Checking session"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl ct-hero-gradient border border-[var(--ct-exporter-border)] text-base font-extrabold text-[var(--ct-exporter-text)]">
            CT
          </span>
          <p className="text-base font-semibold text-[var(--ct-ink-secondary)]">
            {hydrated ? 'Redirecting to login…' : 'Loading workspace…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <GlossaryProvider>
        <SourceViewerProvider>
          <div className="min-h-screen flex flex-col bg-[var(--ct-bg)] text-[var(--ct-ink)]">
            <a
              href="#main-content"
              className="visually-hidden fixed left-4 top-4 z-50 rounded-xl bg-[var(--ct-exporter-btn)] px-4 py-2.5 text-base font-bold text-white shadow-lg"
            >
              Skip to main content
            </a>

            <DemoBanner />

            <header
              className="sticky top-0 z-30 border-b border-[var(--ct-border)] backdrop-blur-md"
              style={{ backgroundColor: 'var(--ct-header-bg)' }}
            >
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileNavOpen((prev) => !prev)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] text-[var(--ct-ink)] lg:hidden cursor-pointer"
                    aria-expanded={mobileNavOpen}
                    aria-controls="mobile-app-nav"
                    aria-label="Toggle navigation menu"
                  >
                    {mobileNavOpen ? (
                      <X className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Menu className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>

                  <Link href="/" className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ct-hero-gradient border border-[var(--ct-exporter-border)] text-base font-extrabold text-[var(--ct-exporter-text)] shadow-xs">
                      CT
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-extrabold tracking-tight text-[var(--ct-ink)]">
                        CarbonTrace
                      </span>
                      <span className="block truncate text-[14px] font-medium text-[var(--ct-ink-secondary)]">
                        Demo Fasteners Pvt Ltd · Q3 2026
                      </span>
                    </span>
                  </Link>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="hidden xl:flex items-center gap-2 rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-raised)] px-3.5 py-2 text-[14px] font-semibold text-[var(--ct-ink-secondary)]">
                    <Activity className="h-4 w-4 text-[var(--ct-outreach)]" aria-hidden="true" />
                    <span>CN 7318 15 · Steel Fasteners</span>
                  </div>

                  <Link
                    href="/app/run"
                    className="hidden sm:inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--ct-exporter-btn)] px-4 py-2 text-base font-bold text-white hover:bg-[var(--ct-exporter-btn-hover)] shadow-xs"
                  >
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                    <span>Live run</span>
                  </Link>

                  <ThemeToggle />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-3.5 py-2 text-[15px] font-bold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)] cursor-pointer"
                    aria-label="Log out"
                  >
                    <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Log out</span>
                  </button>
                </div>
              </div>
            </header>

            {mobileNavOpen ? (
              <nav
                id="mobile-app-nav"
                aria-label="Mobile Primary"
                className="border-b border-[var(--ct-border)] bg-[var(--ct-surface)] px-4 py-3 lg:hidden"
              >
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex min-h-[44px] items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition-colors',
                            active
                              ? 'bg-[var(--ct-exporter-soft)] text-[var(--ct-exporter-text)] border border-[var(--ct-exporter-border)]'
                              : 'text-[var(--ct-ink-secondary)] hover:bg-[var(--ct-surface-raised)] hover:text-[var(--ct-ink)]'
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : null}

            <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
              <aside className="hidden w-60 shrink-0 lg:block">
                <nav aria-label="Primary" className="sticky top-20 space-y-5">
                  <ul className="space-y-1">
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition-colors',
                              active
                                ? 'bg-[var(--ct-exporter-soft)] text-[var(--ct-exporter-text)] border border-[var(--ct-exporter-border)] shadow-xs'
                                : 'text-[var(--ct-ink-secondary)] hover:bg-[var(--ct-surface)] hover:text-[var(--ct-ink)]'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5 text-[14px] shadow-xs">
                    <p className="font-bold text-[var(--ct-ink)]">Team Colours</p>
                    <ul className="mt-3 space-y-2.5 text-[var(--ct-ink-secondary)]">
                      <li className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--ct-collector)]" aria-hidden="true" />
                        <span>Collector (reads files)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--ct-outreach)]" aria-hidden="true" />
                        <span>Outreach (messages)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--ct-calculator)]" aria-hidden="true" />
                        <span>Calculator (math)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--ct-verifier)]" aria-hidden="true" />
                        <span>Verifier (checks)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[var(--ct-exporter)]" aria-hidden="true" />
                        <span>You (approvals)</span>
                      </li>
                    </ul>
                  </div>
                </nav>
              </aside>

              <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 pb-12 outline-none">
                {children}
              </main>
            </div>

            <SourceViewerDrawer />
          </div>
        </SourceViewerProvider>
      </GlossaryProvider>
    </MotionConfig>
  );
}
