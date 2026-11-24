'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { formatNumber } from '@/lib/formatters';
import type { LedgerRecordStatus } from '@/types';
import { GlossaryTooltip } from '@/components/shared/GlossaryTooltip';
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
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const FIELD_LABELS: Record<string, string> = {
  electricity_used: 'Factory electricity',
  furnace_oil_used: 'Furnace oil',
  furnace_oil_used_duplicate: 'Furnace oil (copy)',
  diesel_used: 'Generator diesel',
  precursor_wire_rod_tonnes: 'Steel wire rod',
  precursor_alloy_tonnes: 'Zinc-alloy wire',
  precursor_alloy_factor: 'Alloy carbon rate',
  product_tonnes_made: 'Fasteners made',
  electricity_log_check: 'Power log check',
  eu_exported_tonnes: 'Shipped to EU',
  unsourced_manual_factor: 'Manual gas rate',
  precursor_wire_rod_tonnes_reply: 'Wire rod reply',
  precursor_wire_rod_factor: 'Wire rod carbon rate',
};

const STATUS_BADGE: Record<
  LedgerRecordStatus,
  { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
> = {
  verified: { variant: 'success', label: 'verified' },
  pending: { variant: 'warning', label: 'pending' },
  rejected: { variant: 'danger', label: 'rejected' },
  superseded: { variant: 'neutral', label: 'superseded' },
};

export default function EvidenceLedgerPage() {
  const { openSource } = useSourceViewer();
  const fetchLedgerBundle = React.useCallback(
    async () => Promise.all([api.getLedger(), api.getEmissionFactors()]),
    []
  );
  const { data: bundle, loading, error, refetch: loadLedger } = useDemoQuery(fetchLedgerBundle);
  const records = React.useMemo(() => bundle?.[0] ?? [], [bundle]);
  const factors = React.useMemo(() => bundle?.[1] ?? [], [bundle]);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (!q) return true;
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.field.toLowerCase().includes(q) ||
        rec.documentName.toLowerCase().includes(q) ||
        rec.quote.toLowerCase().includes(q) ||
        rec.unit.toLowerCase().includes(q)
      );
    });
  }, [records, search, statusFilter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="collector">{records.length} facts</Badge>
          <h1 className="ct-page-title">
            <GlossaryTooltip term="evidence ledger" label="Proof List" />
          </h1>
          <p className="ct-body">
            Click any row to open the exact bill page and quote.
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

      {/* Search & Status Filters */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ct-ink-secondary)]"
              aria-hidden="true"
            />
            <label htmlFor="ledger-search" className="visually-hidden">
              Search proof list
            </label>
            <Input
              id="ledger-search"
              placeholder="Search items, files, or units..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {(['all', 'verified', 'pending', 'rejected', 'superseded'] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All' : status}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4-Column Proof Table */}
      {error ? (
        <PageErrorState message={error} onRetry={loadLedger} />
      ) : loading ? (
        <PageLoadingSkeleton cards={0} rows={5} />
      ) : records.length === 0 ? (
        <EmptyStateCard
          title="Proof list is empty"
          hint="Upload factory files and run the Collector to stage extracted facts."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-base text-[var(--ct-ink-secondary)]">
                No matching facts found.
              </div>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby="ledger-table-caption"
                className="overflow-x-auto rounded-2xl"
              >
                <table className="w-full min-w-[540px] border-collapse text-left text-[15px]">
                  <caption id="ledger-table-caption" className="visually-hidden">
                    Proof list facts with amounts, status, and source links
                  </caption>
                  <thead>
                    <tr className="border-b border-[var(--ct-border)] bg-[var(--ct-surface-raised)] text-[14px] font-bold uppercase tracking-wide text-[var(--ct-ink-secondary)]">
                      <th scope="col" className="px-4 py-3.5">Item</th>
                      <th scope="col" className="px-4 py-3.5">Amount</th>
                      <th scope="col" className="px-4 py-3.5">Status</th>
                      <th scope="col" className="px-4 py-3.5 text-right">Proof</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ct-divide)]">
                    {filtered.map((rec) => {
                      const statusStyle = STATUS_BADGE[rec.status];
                      const shortLabel = FIELD_LABELS[rec.field] ?? rec.field;
                      return (
                        <tr
                          key={rec.id}
                          onClick={() =>
                            openSource({
                              recordId: rec.id,
                              documentId: rec.documentId,
                              page: rec.page,
                              title: rec.documentName,
                            })
                          }
                          className="cursor-pointer transition-colors hover:bg-[var(--ct-exporter-soft)]/50"
                        >
                          <th scope="row" className="px-4 py-3.5 font-semibold text-[var(--ct-ink)]">
                            {shortLabel}
                          </th>
                          <td className="ct-tabular px-4 py-3.5 font-semibold text-[var(--ct-ink)] whitespace-nowrap">
                            {rec.value.toLocaleString('en-IN')} {rec.unit}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <Badge variant={statusStyle.variant}>{statusStyle.label}</Badge>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSource({
                                  recordId: rec.id,
                                  documentId: rec.documentId,
                                  page: rec.page,
                                  title: rec.documentName,
                                });
                              }}
                              aria-label={`View proof for ${rec.id}`}
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                              View proof
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Emission Factors tucked behind Show details */}
      <details className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface)] p-5 sm:p-6 shadow-xs">
        <summary className="ct-card-title cursor-pointer list-none">
          Show details: <GlossaryTooltip term="emission factor" label="Sample emission factors" />
        </summary>
        <p className="ct-body mt-2">
          Demo numbers are illustrative samples only.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {factors.map((factor) => {
            const missingSource = factor.id === 'F-6';
            return (
              <div
                key={factor.id}
                className={`rounded-xl border p-5 text-[14px] ${missingSource
                    ? 'border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)]'
                    : 'border-[var(--ct-border)] bg-[var(--ct-surface-subtle)]'
                  }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--ct-ink)]">{factor.id}</span>
                  <Badge variant={missingSource ? 'danger' : 'calculator'}>
                    {missingSource ? 'No proof' : 'Sample'}
                  </Badge>
                </div>
                <p className="mt-2 font-bold text-base text-[var(--ct-ink)]">{factor.name}</p>
                <p className="ct-tabular mt-1 text-lg font-bold text-[var(--ct-calculator-text)]">
                  {formatNumber(factor.value, factor.value < 0.01 ? 5 : 2)} {factor.unit}
                </p>
                <p className="mt-1.5 text-[14px] text-[var(--ct-ink-secondary)]">{factor.source}</p>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
