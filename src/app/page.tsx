import {
  Calculator,
  CheckCircle2,
  FileSearch,
  MessageCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  LandingHeaderNav,
  LandingHeroActions,
} from '@/components/landing/LandingActions';
import { GlossaryProvider, GlossaryTooltip } from '@/components/shared/GlossaryTooltip';
import { HubSceneWrapper } from '@/components/three/HubSceneWrapper';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AGENT_CARDS = [
  {
    name: 'Collector',
    iconBg: 'bg-[var(--ct-collector-btn)]',
    badge: 'collector' as const,
    icon: FileSearch,
    summary: 'Reads your bills and saves every quote with its page.',
  },
  {
    name: 'Outreach',
    iconBg: 'bg-[var(--ct-outreach-btn)]',
    badge: 'outreach' as const,
    icon: MessageCircle,
    summary: 'Asks suppliers for missing data in English, Hindi, or Marathi.',
  },
  {
    name: 'Calculator',
    iconBg: 'bg-[var(--ct-calculator-btn)]',
    badge: 'calculator' as const,
    icon: Calculator,
    summary: 'Runs fixed code math using sample emission factors.',
  },
  {
    name: 'Verifier',
    iconBg: 'bg-[var(--ct-verifier-btn)]',
    badge: 'verifier' as const,
    icon: ShieldAlert,
    summary: 'Catches unit mistakes, duplicates, and missing proof before export.',
  },
];

export default function LandingPage() {
  return (
    <GlossaryProvider>
      <div className="min-h-screen bg-[var(--ct-bg)] text-[var(--ct-ink)]">
        <a
          href="#landing-main"
          className="visually-hidden fixed left-4 top-4 z-50 rounded-xl bg-[var(--ct-exporter-btn)] px-4 py-2.5 text-base font-bold text-white shadow-lg"
        >
          Skip to main content
        </a>

        <header
          className="sticky top-0 z-30 border-b border-[var(--ct-border)] backdrop-blur-md"
          style={{ backgroundColor: 'var(--ct-header-bg)' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl ct-hero-gradient border border-[var(--ct-exporter-border)] text-base font-extrabold text-[var(--ct-exporter-text)]">
                CT
              </span>
              <div>
                <span className="block text-lg font-extrabold tracking-tight text-[var(--ct-ink)]">
                  CarbonTrace
                </span>
                <span className="block text-[14px] font-medium text-[var(--ct-ink-secondary)]">
                  EU CBAM Prototype
                </span>
              </div>
            </div>

            <LandingHeaderNav />
          </div>
        </header>

        <main id="landing-main" className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 sm:py-14">
          {/* Hero Section */}
          <section className="ct-hero-gradient rounded-3xl border border-[var(--ct-border)] p-6 sm:p-10 shadow-sm">
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="min-w-0 space-y-5 lg:col-span-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="exporter">
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Demo mode: sample data
                  </Badge>
                </div>

                <h1 className="ct-page-title">
                  Turn factory bills into CBAM carbon reports.
                </h1>

                <p className="ct-body">
                  Track the{' '}
                  <GlossaryTooltip term="embedded emissions" label="carbon in your product" />{' '}
                  with clickable proof for EU buyers.
                </p>

                <LandingHeroActions />
              </div>

              <div className="min-w-0 lg:col-span-5">
                <HubSceneWrapper variant="hero" />
              </div>
            </div>
          </section>

          {/* 4 Agents Section */}
          <section aria-labelledby="agents-heading" className="space-y-6">
            <div className="space-y-2">
              <h2 id="agents-heading" className="ct-section-title">
                Four agents around one <GlossaryTooltip term="evidence ledger" label="proof list" />
              </h2>
              <p className="ct-body">
                Built for Indian MSME factory owners with zero extra software needed.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {AGENT_CARDS.map((agent) => {
                const Icon = agent.icon;
                return (
                  <Card key={agent.name}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${agent.iconBg}`}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <Badge variant={agent.badge}>{agent.name}</Badge>
                      </div>
                      <CardTitle className="mt-3">{agent.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="ct-body">
                      {agent.summary}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Extra details tucked behind disclosure */}
          <details className="rounded-3xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-6 sm:p-8 shadow-xs">
            <summary className="ct-section-title cursor-pointer list-none">
              Show details: How we keep numbers honest
            </summary>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-base leading-[1.6] text-[var(--ct-ink-secondary)]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-collector)]" aria-hidden="true" />
                <span>Every number links to an invoice quote.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-calculator)]" aria-hidden="true" />
                <span>Fixed code runs all math, never AI.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--ct-exporter)]" aria-hidden="true" />
                <span>You approve every supplier message and report.</span>
              </li>
            </ul>
          </details>
        </main>
      </div>
    </GlossaryProvider>
  );
}
