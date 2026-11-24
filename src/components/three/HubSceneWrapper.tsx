'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import {
  Bot,
  Calculator,
  Eye,
  FileSearch,
  MessageCircle,
  Pause,
  Play,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { AGENT_METADATA, PIPELINE_STATE_LABELS } from '@/lib/formatters';
import { use3DCapability } from '@/lib/use3DCapability';
import { cn } from '@/lib/utils';
import type { AgentRole, PipelineState } from '@/types';
import { Button } from '@/components/ui/button';

const LazyEvidenceCubeScene = dynamic(() => import('./EvidenceCubeScene'), {
  ssr: false,
});

class SceneErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const HUB_NODES: {
  role: AgentRole;
  icon: React.ComponentType<{ className?: string }>;
  position: string;
}[] = [
  { role: 'collector', icon: FileSearch, position: 'top-4 left-4 sm:top-6 sm:left-8' },
  { role: 'outreach', icon: MessageCircle, position: 'top-4 right-4 sm:top-6 sm:right-8' },
  { role: 'calculator', icon: Calculator, position: 'bottom-4 left-4 sm:bottom-6 sm:left-8' },
  { role: 'verifier', icon: ShieldAlert, position: 'bottom-4 right-4 sm:bottom-6 sm:right-8' },
];

export function Fallback2DHub({
  variant,
  activeAgent = null,
  runState = 'needs_fixes',
  hasVerifierBlocker = false,
}: {
  variant: 'hero' | 'workspace';
  activeAgent?: AgentRole | null;
  runState?: PipelineState;
  hasVerifierBlocker?: boolean;
}) {
  if (variant === 'hero') {
    return (
      <div className="rounded-3xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5 sm:p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px] font-bold uppercase tracking-wide text-[var(--ct-ink-secondary)]">
            Demo Fasteners Pvt Ltd · Q3 2026
          </span>
          <span className="rounded-full bg-[var(--ct-outreach-soft)] px-3 py-1 text-[14px] font-bold text-[var(--ct-outreach-text)]">
            Click-to-source
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[var(--ct-collector-border)] bg-[var(--ct-collector-soft)] p-4">
            <p className="text-[14px] font-bold text-[var(--ct-collector-text)]">Collector</p>
            <p className="mt-1 text-[14px] text-[var(--ct-ink)]">12 sample files</p>
          </div>
          <div className="rounded-2xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] p-4">
            <p className="text-[14px] font-bold text-[var(--ct-outreach-text)]">Outreach</p>
            <p className="mt-1 text-[14px] text-[var(--ct-ink)]">Hindi / Marathi</p>
          </div>
          <div className="rounded-2xl border border-[var(--ct-calculator-border)] bg-[var(--ct-calculator-soft)] p-4">
            <p className="text-[14px] font-bold text-[var(--ct-calculator-text)]">Calculator</p>
            <p className="mt-1 text-[14px] text-[var(--ct-ink)]">Deterministic math</p>
          </div>
          <div className="rounded-2xl border border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] p-4">
            <p className="text-[14px] font-bold text-[var(--ct-verifier-text)]">Verifier</p>
            <p className="mt-1 text-[14px] text-[var(--ct-ink)]">4 planted catches</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--ct-exporter-border)] bg-[var(--ct-exporter-soft)] px-4 py-3.5 text-[14px]">
          <span className="flex items-center gap-2 font-bold text-[var(--ct-exporter-text)]">
            <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            You approve messages and reports
          </span>
          <span className="ct-tabular font-bold text-[var(--ct-ink)]">2.43 tCO2e/t</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-[var(--ct-border)] ct-hero-gradient">
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 800 320"
        preserveAspectRatio="none"
      >
        <line x1="150" y1="68" x2="400" y2="160" stroke="var(--ct-collector)" strokeOpacity="0.45" strokeWidth="3" strokeDasharray="6 6" />
        <line x1="650" y1="68" x2="400" y2="160" stroke="var(--ct-outreach)" strokeOpacity="0.45" strokeWidth="3" strokeDasharray="6 6" />
        <line x1="150" y1="252" x2="400" y2="160" stroke="var(--ct-calculator)" strokeOpacity="0.45" strokeWidth="3" strokeDasharray="6 6" />
        <line x1="650" y1="252" x2="400" y2="160" stroke="var(--ct-verifier)" strokeOpacity="0.55" strokeWidth="3" strokeDasharray="6 6" />
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex flex-col items-center rounded-2xl border-2 border-[var(--ct-exporter-border)] bg-[var(--ct-surface)] px-5 py-4 text-center shadow-lg">
          <Bot className="h-6 w-6 text-[var(--ct-exporter)]" aria-hidden="true" />
          <p className="mt-1 text-base font-bold text-[var(--ct-ink)]">Proof list</p>
          <p className="text-[14px] font-semibold text-[var(--ct-ink-secondary)]">
            {PIPELINE_STATE_LABELS[runState]}
          </p>
          {hasVerifierBlocker ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--ct-verifier-soft)] px-2.5 py-0.5 text-[14px] font-bold text-[var(--ct-verifier-text)]">
              Blocked
            </span>
          ) : null}
        </div>
      </div>

      {HUB_NODES.map(({ role, icon: Icon, position }) => {
        const meta = AGENT_METADATA[role];
        const isActive = activeAgent === role;
        return (
          <div
            key={role}
            className={cn(
              'absolute flex items-center gap-2.5 rounded-2xl border bg-[var(--ct-surface)] px-3.5 py-2.5 shadow-sm transition-all',
              position,
              isActive ? 'ring-2 ring-offset-2 scale-[1.03]' : 'border-[var(--ct-border)]'
            )}
            style={{
              borderColor: isActive ? meta.accentCss : undefined,
            }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: meta.accentCss }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="hidden sm:block">
              <p className="text-[14px] font-bold text-[var(--ct-ink)]">{meta.name}</p>
              <p className="text-[14px] text-[var(--ct-ink-secondary)]">{meta.shortRole}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HubSceneWrapper({
  variant,
  activeAgent = null,
  runState = 'needs_fixes',
  hasVerifierBlocker = false,
  className,
}: {
  variant: 'hero' | 'workspace';
  activeAgent?: AgentRole | null;
  runState?: PipelineState;
  hasVerifierBlocker?: boolean;
  className?: string;
}) {
  const cap = use3DCapability();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isOnScreen, setIsOnScreen] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsOnScreen(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const fallback = (
    <Fallback2DHub
      variant={variant}
      activeAgent={activeAgent}
      runState={runState}
      hasVerifierBlocker={hasVerifierBlocker}
    />
  );

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {cap.shouldRender3D ? (
        <div
          role="region"
          aria-label={
            variant === 'hero'
              ? 'Interactive 3D Evidence Ledger cube with four orbiting agents'
              : `Live 3D agent hub showing state ${PIPELINE_STATE_LABELS[runState]}`
          }
          className={cn(
            'relative w-full overflow-hidden rounded-3xl border border-[var(--ct-border)] bg-[var(--ct-surface)] shadow-md',
            variant === 'hero' ? 'h-80 sm:h-[340px]' : 'h-80 sm:h-96'
          )}
        >
          <SceneErrorBoundary fallback={fallback}>
            <LazyEvidenceCubeScene
              variant={variant}
              activeAgent={activeAgent}
              runState={runState}
              hasVerifierBlocker={hasVerifierBlocker}
              paused={cap.paused}
              isOnScreen={isOnScreen}
              isDark={isDark}
            />
          </SceneErrorBoundary>

          <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full border border-[var(--ct-exporter-border)] bg-[var(--ct-surface-raised)]/95 px-3 py-1 text-[14px] font-bold text-[var(--ct-exporter-text)] shadow-2xs">
              Proof List
            </span>
            {(['collector', 'outreach', 'calculator', 'verifier'] as const).map((role) => {
              const meta = AGENT_METADATA[role];
              const isActive = activeAgent === role;
              return (
                <span
                  key={role}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-bold shadow-2xs',
                    isActive
                      ? 'text-white'
                      : 'bg-[var(--ct-surface-raised)]/95 text-[var(--ct-ink)]'
                  )}
                  style={{
                    backgroundColor: isActive ? meta.accentHex : undefined,
                    borderColor: meta.accentCss,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: isActive ? '#FFFFFF' : meta.accentCss }}
                    aria-hidden="true"
                  />
                  {meta.name}
                </span>
              );
            })}
            {hasVerifierBlocker ? (
              <span className="rounded-full border border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] px-3 py-1 text-[14px] font-bold text-[var(--ct-verifier-text)]">
                Blocked
              </span>
            ) : null}
          </div>

          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => cap.setPaused((p) => !p)}
              aria-label={cap.paused ? 'Play 3D motion' : 'Pause 3D motion'}
            >
              {cap.paused ? (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Play
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4" aria-hidden="true" />
                  Pause
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => cap.setManual2D(true)}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              2D view
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {fallback}
          {cap.supported && !cap.prefersReducedMotion && !cap.weakDevice ? (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => cap.setManual2D(false)}
              >
                3D view
              </Button>
            </div>
          ) : (
            <p className="text-[14px] text-[var(--ct-ink-secondary)]">
              2D view active.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
