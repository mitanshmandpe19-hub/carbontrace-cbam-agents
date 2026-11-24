'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { formatTimeShort } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { OutreachRequest } from '@/types';
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const STATUS_META: Record<
  OutreachRequest['status'],
  { label: string; variant: 'warning' | 'outreach' | 'success' | 'danger' | 'exporter' }
> = {
  draft: { label: 'Approve draft', variant: 'exporter' },
  approved: { label: 'Approved', variant: 'outreach' },
  sent: { label: 'Waiting reply', variant: 'warning' },
  replied: { label: 'Replied', variant: 'success' },
  gave_up: { label: 'EU default', variant: 'danger' },
};

export default function OutreachPage() {
  const { openSource } = useSourceViewer();
  const fetchOutreach = React.useCallback(() => api.getOutreach(), []);
  const {
    data: fetchedRequests,
    setData: setRequests,
    loading,
    error,
    refetch: loadOutreach,
  } = useDemoQuery(fetchOutreach);
  const requests = React.useMemo(() => fetchedRequests ?? [], [fetchedRequests]);
  const [selectedId, setSelectedId] = React.useState<string>('O-1');
  const [editedDrafts, setEditedDrafts] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [replyProofTarget, setReplyProofTarget] = React.useState<{
    recordId: string;
    documentId: string;
  }>({ recordId: 'R-14', documentId: 'D-12' });

  React.useEffect(() => {
    const onReset = () => {
      setBanner(null);
      setActionError(null);
      setEditedDrafts({});
    };
    window.addEventListener('carbontrace:demo-reset', onReset);
    return () => window.removeEventListener('carbontrace:demo-reset', onReset);
  }, []);

  const active = requests.find((r) => r.id === selectedId) ?? requests[0] ?? null;
  const draftText = active ? editedDrafts[active.id] ?? active.draft : '';

  function handleSelect(req: OutreachRequest) {
    setSelectedId(req.id);
  }

  async function handleApproveAndSend() {
    if (!active) return;
    setBusy(true);
    setBanner(null);
    setActionError(null);
    try {
      const updated = await api.approveOutreach(active.id, draftText);
      setRequests((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
      setBanner(
        `Approved & sent ${updated.channel.toUpperCase()} message to ${updated.supplier}. You can now simulate their reply below.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateReply() {
    if (!active) return;
    setBusy(true);
    setBanner(null);
    setActionError(null);
    try {
      const res = await api.simulateSupplierReply(active.id);
      setRequests((prev) =>
        (prev ?? []).map((r) => (r.id === res.outreach.id ? res.outreach : r))
      );
      const replyRec =
        res.ledger.find((r) => r.id.endsWith('R-14')) ?? res.ledger[0];
      if (replyRec) {
        setReplyProofTarget({
          recordId: replyRec.id,
          documentId: replyRec.documentId,
        });
      }
      setBanner(
        `${res.outreach.supplier} replied! Record ${replyRec?.id ?? 'R-14'} was added to your proof list and calculations updated.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to simulate reply.');
    } finally {
      setBusy(false);
    }
  }

  async function handleNoReplyFallback() {
    if (!active) return;
    setBusy(true);
    setBanner(null);
    setActionError(null);
    try {
      const res = await api.simulateNoReplyFallback(active.id);
      setRequests((prev) =>
        (prev ?? []).map((r) => (r.id === res.outreach.id ? res.outreach : r))
      );
      setBanner(
        `${res.outreach.supplier} did not reply after ${res.outreach.maxTries} tries — gap closed using the EU default value.`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to apply default fallback.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <AgentBadge agent="outreach" />
            <AgentBadge agent="exporter" />
          </div>
          <h1 className="ct-page-title">
            Supplier Messages
          </h1>
          <p className="ct-body">
            Approve messages before they go to your suppliers.
          </p>
        </div>

        <Link
          href="/app/verification"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-4 py-2.5 text-base font-bold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)]"
        >
          Open checks
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {actionError ? <PageErrorState message={actionError} onRetry={loadOutreach} /> : null}

      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] px-5 py-3.5 text-base font-semibold text-[var(--ct-outreach-text)]"
        >
          <span>{banner}</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => openSource({ ...replyProofTarget, page: 1 })}
              className="text-base font-bold underline cursor-pointer"
            >
              View proof
            </button>
            <Link href="/app/ledger" className="text-base font-bold underline">
              Proof list
            </Link>
          </div>
        </div>
      ) : null}

      {error ? (
        <PageErrorState message={error} onRetry={loadOutreach} />
      ) : loading ? (
        <PageLoadingSkeleton cards={0} rows={4} />
      ) : requests.length === 0 ? (
        <EmptyStateCard
          title="No supplier messages needed"
          hint="All input material records already have verified emissions values."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Inbox List */}
          <div className="space-y-3 lg:col-span-4" role="list" aria-label="Supplier outreach queue">
            {requests.map((req) => {
              const meta = STATUS_META[req.status];
              const isSelected = active?.id === req.id;
              return (
                <button
                  key={req.id}
                  type="button"
                  onClick={() => handleSelect(req)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={cn(
                    'w-full rounded-2xl border p-5 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'border-[var(--ct-outreach)] bg-[var(--ct-surface)] shadow-md ring-2 ring-[var(--ct-outreach)]/25'
                      : 'border-[var(--ct-border)] bg-[var(--ct-surface)] hover:bg-[var(--ct-surface-raised)]'
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-bold text-[var(--ct-ink)]">
                      {req.channel === 'whatsapp' ? (
                        <MessageCircle className="h-4 w-4 text-[var(--ct-outreach)]" aria-hidden="true" />
                      ) : (
                        <Mail className="h-4 w-4 text-[var(--ct-collector)]" aria-hidden="true" />
                      )}
                      {req.channel.toUpperCase()} · {req.language}
                    </span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="mt-2.5 text-base font-bold text-[var(--ct-ink)]">{req.supplier}</p>
                </button>
              );
            })}
          </div>

          {/* Active Thread & Approval Composer */}
          {active ? (
            <Card className="lg:col-span-8">
              <CardHeader className="border-b border-[var(--ct-border)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_META[active.status].variant}>
                        {STATUS_META[active.status].label}
                      </Badge>
                      <Badge variant="neutral">
                        Tries: {active.tries}/{active.maxTries}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2">{active.supplier}</CardTitle>
                    <CardDescription>{active.gap}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-5 sm:p-6">
                {/* WhatsApp / Email Thread */}
                <div
                  className={cn(
                    'space-y-3 rounded-2xl border p-5 max-h-80 overflow-y-auto',
                    active.channel === 'whatsapp'
                      ? 'border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)]'
                      : 'border-[var(--ct-collector-border)] bg-[var(--ct-collector-soft)]'
                  )}
                  aria-label="Conversation thread"
                >
                  {active.thread.map((msg, idx) => (
                    <div
                      key={`${msg.at}-${idx}`}
                      className={cn(
                        'flex flex-col max-w-[85%] rounded-2xl px-4 py-3 text-base leading-[1.6] shadow-2xs',
                        msg.direction === 'out'
                          ? 'ml-auto rounded-br-sm'
                          : 'mr-auto border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] text-[var(--ct-ink)] rounded-bl-sm'
                      )}
                      style={
                        msg.direction === 'out'
                          ? {
                              backgroundColor: 'var(--ct-bubble-out-bg)',
                              color: 'var(--ct-bubble-out-ink)',
                            }
                          : undefined
                      }
                    >
                      <p>{msg.text}</p>
                      <span
                        className={cn(
                          'mt-1.5 text-[14px]',
                          msg.direction === 'out'
                            ? 'text-white/85'
                            : 'text-[var(--ct-ink-secondary)]'
                        )}
                      >
                        {msg.direction === 'out' ? 'Sent' : active.supplier} ·{' '}
                        {formatTimeShort(msg.at)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Human Approval Gate / Simulation Controls */}
                {active.status === 'draft' ? (
                  <div className="space-y-4 rounded-2xl border border-[var(--ct-exporter-border)] bg-[var(--ct-exporter-soft)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="outreach-draft-box"
                        className="text-[14px] font-bold uppercase tracking-wide text-[var(--ct-exporter-text)]"
                      >
                        Draft ({active.language})
                      </label>
                      <span className="text-[14px] text-[var(--ct-ink-secondary)]">
                        Approve before sending
                      </span>
                    </div>
                    <textarea
                      id="outreach-draft-box"
                      rows={3}
                      value={draftText}
                      onChange={(e) =>
                        setEditedDrafts((prev) => ({
                          ...prev,
                          [active.id]: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--ct-exporter-border)] bg-[var(--ct-surface)] p-3.5 text-base leading-[1.6] text-[var(--ct-ink)]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[14px] text-[var(--ct-ink-secondary)]">
                        Demo mode does not message real phones.
                      </p>
                      <Button
                        variant="default"
                        disabled={busy || !draftText.trim()}
                        onClick={handleApproveAndSend}
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Send message
                      </Button>
                    </div>
                  </div>
                ) : active.status === 'sent' ? (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] p-5">
                    <div className="space-y-1 text-[15px]">
                      <p className="font-bold text-[var(--ct-outreach-text)] flex items-center gap-2">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        Waiting for {active.supplier}
                      </p>
                      <p className="text-[14px] text-[var(--ct-ink-secondary)]">
                        Test a supplier reply or fall back to EU defaults.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="teal" disabled={busy} onClick={handleSimulateReply}>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        Simulate reply
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={handleNoReplyFallback}>
                        Use default
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] p-5 text-base">
                    <div className="flex items-center gap-2 font-semibold text-[var(--ct-outreach-text)]">
                      <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>
                        {active.status === 'replied'
                          ? 'Reply saved to your proof list.'
                          : 'Gap closed using EU default value.'}
                      </span>
                    </div>
                    {active.id === 'O-1' && active.status === 'replied' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSource({ recordId: 'R-14', documentId: 'D-12', page: 1 })}
                      >
                        View proof
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
