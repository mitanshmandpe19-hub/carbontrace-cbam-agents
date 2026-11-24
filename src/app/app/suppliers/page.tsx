'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Award, Clock, Globe, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { formatShortDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import {
  EmptyStateCard,
  PageErrorState,
  PageLoadingSkeleton,
} from '@/components/shared/QueryState';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function SuppliersPage() {
  const fetchSuppliers = React.useCallback(() => api.getSuppliers(), []);
  const {
    data: fetchedSuppliers,
    loading,
    error,
    refetch: loadSuppliers,
  } = useDemoQuery(fetchSuppliers);
  const suppliers = fetchedSuppliers ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outreach">Input Materials</Badge>
          <h1 className="ct-page-title">
            Suppliers
          </h1>
          <p className="ct-body">
            Ranked by reply speed and data quality.
          </p>
        </div>

        <Link
          href="/app/outreach"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--ct-outreach-btn)] px-5 py-2.5 text-base font-bold text-white hover:bg-[var(--ct-outreach-btn-hover)]"
        >
          Send messages
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {error ? (
        <PageErrorState message={error} onRetry={loadSuppliers} />
      ) : loading ? (
        <PageLoadingSkeleton cards={3} rows={2} />
      ) : suppliers.length === 0 ? (
        <EmptyStateCard
          title="No suppliers yet"
          hint="Suppliers appear once input material bills are uploaded."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {suppliers.map((sup, index) => (
            <Card key={sup.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={index === 0 ? 'success' : index === 1 ? 'outreach' : 'warning'}>
                    <Award className="h-4 w-4" aria-hidden="true" />
                    Rank #{index + 1}
                  </Badge>
                </div>
                <CardTitle className="mt-2">{sup.name}</CardTitle>
                <CardDescription>{sup.contact}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="flex items-start gap-2.5 rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-3.5 text-[14px]">
                  <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ct-collector)]" aria-hidden="true" />
                  <div>
                    <p className="font-bold text-[var(--ct-ink)]">Supplies</p>
                    <p className="text-[var(--ct-ink-secondary)]">{sup.products.join(', ')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[14px]">
                  <div className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-3.5">
                    <p className="text-[var(--ct-ink-secondary)]">Carbon / tonne</p>
                    <p className="ct-tabular mt-1 text-2xl font-bold text-[var(--ct-ink)]">
                      {sup.emissionsPerTonne.toFixed(2)}
                    </p>
                    <p className="ct-stat-label mt-0.5">tCO2e/t</p>
                  </div>
                  <div className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-3.5">
                    <p className="text-[var(--ct-ink-secondary)]">Q3 Volume</p>
                    <p className="ct-tabular mt-1 text-2xl font-bold text-[var(--ct-ink)]">
                      {sup.volumeByPeriod['2026-Q3'] ?? 0} t
                    </p>
                    <p className="ct-stat-label mt-0.5">
                      Q2: {sup.volumeByPeriod['2026-Q2'] ?? 0} t
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-[14px]">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-[var(--ct-ink-secondary)]">Quality score</span>
                    <span className="font-bold text-[var(--ct-ink)]">
                      {sup.dataQualityScore}/100
                    </span>
                  </div>
                  <Progress
                    value={sup.dataQualityScore}
                    label={`${sup.name} quality score`}
                    barColorClass={
                      sup.dataQualityScore >= 85
                        ? 'bg-[var(--ct-outreach)]'
                        : sup.dataQualityScore >= 70
                          ? 'bg-[var(--ct-collector)]'
                          : 'bg-[var(--ct-calculator)]'
                    }
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ct-border)] pt-3.5 text-[14px] text-[var(--ct-ink-secondary)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    Reply: <strong className="text-[var(--ct-ink)]">{sup.avgReplyHours}h</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="h-4 w-4" aria-hidden="true" />
                    {sup.language}
                  </span>
                </div>
                <p className="text-[14px] text-[var(--ct-ink-secondary)]">
                  Verified: {formatShortDate(sup.lastVerifiedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
