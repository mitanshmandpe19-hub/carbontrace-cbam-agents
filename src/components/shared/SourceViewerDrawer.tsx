'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Eye,
  Download,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DocumentFile, LedgerRecord } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSourceViewer } from './SourceViewerContext';

export function SourceViewerDrawer() {
  const { target, closeSource } = useSourceViewer();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const matchLineRef = React.useRef<HTMLDivElement>(null);

  const [loading, setLoading] = React.useState(false);
  const [record, setRecord] = React.useState<LedgerRecord | null>(null);
  const [doc, setDoc] = React.useState<DocumentFile | null>(null);
  const [selectedPage, setSelectedPage] = React.useState<number>(1);
  const [viewMode, setViewMode] = React.useState<'text' | 'raw'>('text');
  const [rawBlobUrl, setRawBlobUrl] = React.useState<string | null>(null);
  const [rawMimeType, setRawMimeType] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (target) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [target]);

  React.useEffect(() => {
    if (!target) return;
    let active = true;
    let objectUrl: string | null = null;

    setViewMode('text');
    setRawBlobUrl(null);
    setRawMimeType('');

    async function load() {
      setLoading(true);
      setError(null);
      try {
        let fetchedRecord: LedgerRecord | null = null;
        if (target?.recordId) {
          fetchedRecord = await api.getLedgerRecord(target.recordId);
        }
        const docId = target?.documentId ?? fetchedRecord?.documentId;
        const pageNum = target?.page ?? fetchedRecord?.page ?? 1;
        setSelectedPage(pageNum);

        let fetchedDoc: DocumentFile | null = null;
        if (docId) {
          fetchedDoc = await api.getDocumentPreview(docId, pageNum);
          if (api.fetchDocumentRawBlob) {
            const raw = await api.fetchDocumentRawBlob(docId).catch(() => null);
            if (raw && active) {
              objectUrl = URL.createObjectURL(raw.blob);
              setRawBlobUrl(objectUrl);
              setRawMimeType(raw.mimeType);
            }
          }
        }
        if (!active) return;
        setRecord(fetchedRecord);
        setDoc(fetchedDoc);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load source preview.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [target]);

  React.useEffect(() => {
    if (!loading && viewMode === 'text' && matchLineRef.current) {
      matchLineRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [loading, viewMode, selectedPage, doc]);

  const handleClose = React.useCallback(() => {
    closeSource();
  }, [closeSource]);

  const activePage =
    doc?.previewPages.find((p) => p.page === selectedPage) ??
    doc?.previewPages.find((p) => p.page === (target?.page ?? record?.page ?? 1)) ??
    doc?.previewPages[0];

  const isInlinePdf = rawMimeType.includes('pdf');
  const isInlineImage = rawMimeType.startsWith('image/');

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="source-drawer-title"
      closedby="any"
      onClose={handleClose}
      className="ct-drawer border-l border-[var(--ct-border)] bg-[var(--ct-bg)] p-0 text-[var(--ct-ink)] shadow-2xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--ct-border)] bg-[var(--ct-surface)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="collector">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Source Evidence
            </Badge>
            {record ? <Badge variant="neutral">{record.id}</Badge> : null}
            {doc?.isSample ? <Badge variant="warning">Sample Document</Badge> : null}
          </div>
          <h2 id="source-drawer-title" className="ct-card-title mt-2 truncate">
            {target?.title ?? doc?.fileName ?? record?.documentName ?? 'Source document'}
          </h2>
          <p className="ct-label mt-1">Exact page and quote behind this number.</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleClose}
          aria-label="Close source viewer"
          autoFocus
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
        {loading ? (
          <div className="space-y-4" aria-live="polite">
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--ct-skeleton)]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--ct-skeleton)]" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] p-5 text-base text-[var(--ct-verifier-text)]">
            {error}
          </div>
        ) : (
          <>
            {record ? (
              <div className="rounded-2xl border border-[var(--ct-collector-border)] bg-[var(--ct-surface)] p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold uppercase tracking-wide text-[var(--ct-collector-text)]">
                    Extracted Fact ({record.field})
                  </span>
                  <Badge
                    variant={
                      record.status === 'verified'
                        ? 'success'
                        : record.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {record.status === 'verified' ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    )}
                    {record.status}
                  </Badge>
                </div>
                <div className="mt-2.5 flex flex-wrap items-baseline gap-3">
                  <span className="ct-tabular text-3xl font-bold text-[var(--ct-ink)]">
                    {record.value.toLocaleString('en-IN')} {record.unit}
                  </span>
                  <span className="text-[14px] text-[var(--ct-ink-secondary)]">
                    ID: <strong className="text-[var(--ct-ink)]">{record.id}</strong> · Period:{' '}
                    <strong className="text-[var(--ct-ink)]">{record.period}</strong> · Confidence:{' '}
                    <strong className="text-[var(--ct-ink)]">
                      {Math.round(record.confidence * 100)}%
                    </strong>{' '}
                    · Page {record.page} · By {record.extractedBy}
                  </span>
                </div>
                <blockquote
                  className="mt-3 rounded-xl border-l-4 border-[var(--ct-calculator)] px-4 py-3 text-[15px] leading-relaxed"
                  style={{
                    backgroundColor: 'var(--ct-quote-bg)',
                    color: 'var(--ct-quote-ink)',
                  }}
                >
                  “{record.quote}”
                </blockquote>
              </div>
            ) : null}

            {(rawBlobUrl || (doc?.previewPages.length ?? 0) > 1) && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {doc && doc.previewPages.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {doc.previewPages.map((pg) => (
                      <button
                        key={pg.page}
                        type="button"
                        onClick={() => {
                          setSelectedPage(pg.page);
                          setViewMode('text');
                        }}
                        className={cn(
                          'min-h-[40px] rounded-xl border px-3.5 py-1.5 text-[14px] font-semibold transition-colors cursor-pointer',
                          selectedPage === pg.page && viewMode === 'text'
                            ? 'border-[var(--ct-collector)] bg-[var(--ct-collector-soft)] text-[var(--ct-collector-text)]'
                            : 'border-[var(--ct-border)] bg-[var(--ct-surface)] text-[var(--ct-ink-secondary)] hover:bg-[var(--ct-surface-raised)]'
                        )}
                      >
                        Page {pg.page}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div />
                )}

                {rawBlobUrl ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {(isInlinePdf || isInlineImage) && (
                      <Button
                        variant={viewMode === 'raw' ? 'blue' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode((m) => (m === 'raw' ? 'text' : 'raw'))}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        {viewMode === 'raw' ? 'Highlighted text' : 'Original file'}
                      </Button>
                    )}
                    <a
                      href={rawBlobUrl}
                      download={doc?.fileName || 'source-document'}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-3.5 py-1.5 text-[14px] font-semibold text-[var(--ct-ink)] hover:bg-[var(--ct-surface-raised)]"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download
                    </a>
                  </div>
                ) : null}
              </div>
            )}

            {viewMode === 'raw' && rawBlobUrl && (isInlinePdf || isInlineImage) ? (
              <div
                data-document-paper="true"
                className="overflow-hidden rounded-2xl border border-[#2A1740]/20 bg-white text-[#2A1740] shadow-md"
              >
                {isInlinePdf ? (
                  <iframe
                    src={rawBlobUrl}
                    title={doc?.fileName || 'Stored PDF document'}
                    className="h-[520px] w-full bg-white"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={rawBlobUrl}
                    alt={doc?.fileName || 'Stored document'}
                    className="max-h-[540px] w-full object-contain bg-white p-3"
                  />
                )}
              </div>
            ) : activePage ? (
              /* Document paper stays crisp white with dark ink in both Light and Black modes */
              <div
                data-document-paper="true"
                className="rounded-2xl border border-[#2A1740]/20 bg-white text-[#2A1740] shadow-md"
              >
                <div className="rounded-t-2xl border-b border-[#2A1740]/10 bg-[#F7F4FA] px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-[#2A1740]">{activePage.title}</p>
                    <span className="rounded-md border border-[#2A1740]/15 bg-white px-2.5 py-1 text-[14px] font-semibold text-[#5B4B6E]">
                      Page {activePage.page}
                    </span>
                  </div>
                  {activePage.subtitle ? (
                    <p className="mt-1 text-[14px] text-[#5B4B6E]">{activePage.subtitle}</p>
                  ) : null}
                </div>
                <div className="space-y-2.5 rounded-b-2xl bg-white p-5 text-[15px] leading-relaxed text-[#2A1740]">
                  {activePage.lines.map((line) => {
                    const textMatch =
                      Boolean(record?.quote) &&
                      line.text
                        .toLowerCase()
                        .includes(record!.quote.slice(0, 28).toLowerCase());
                    const isMatch =
                      (record && line.highlightRecordId === record.id) ||
                      (target?.recordId && line.highlightRecordId === target.recordId) ||
                      textMatch;
                    return (
                      <div
                        key={line.lineNumber}
                        ref={isMatch ? matchLineRef : undefined}
                        className={cn(
                          'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                          isMatch
                            ? 'border border-[#EF6C00]/50 bg-[#FFF3D1] font-semibold text-[#2A1740] shadow-xs'
                            : 'text-[#5B4B6E]'
                        )}
                      >
                        <span className="w-6 shrink-0 select-none text-[14px] text-[#5B4B6E]">
                          {line.lineNumber}
                        </span>
                        <span className="flex-1 break-words">{line.text}</span>
                        {isMatch ? (
                          <span className="shrink-0 rounded-md bg-[#C85300] px-2.5 py-0.5 text-[14px] font-bold text-white">
                            Matched Quote
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--ct-border-strong)] bg-[var(--ct-surface)] p-6 text-center text-base text-[var(--ct-ink-secondary)]">
                No document page preview found for this reference.
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--ct-border)] bg-[var(--ct-surface)] px-5 py-4 sm:px-6">
        <Link
          href="/app/ledger"
          onClick={handleClose}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-bold text-[var(--ct-exporter-text)] hover:underline"
        >
          Open proof list
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Button variant="outline" onClick={handleClose}>
          Close
        </Button>
      </div>
    </dialog>
  );
}
