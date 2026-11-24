'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  FileSpreadsheet,
  FileText,
  MessageSquare,
  Plus,
  StickyNote,
  UploadCloud,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useDemoQuery } from '@/lib/useDemoQuery';
import { cn } from '@/lib/utils';
import type { DocumentFile, DocumentKind } from '@/types';
import { useSourceViewer } from '@/components/shared/SourceViewerContext';
import {
  EmptyStateCard,
  PageErrorState,
  PageLoadingSkeleton,
} from '@/components/shared/QueryState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const FORMAT_ICONS: Record<
  DocumentFile['formatLabel'],
  React.ComponentType<{ className?: string }>
> = {
  PDF: FileText,
  Excel: FileSpreadsheet,
  Message: MessageSquare,
  Note: StickyNote,
};

const ALLOWED_EXTS = ['.pdf', '.xlsx', '.csv', '.png', '.jpg', '.jpeg'];

export default function UploadPage() {
  const { openSource } = useSourceViewer();
  const fetchDocuments = React.useCallback(() => api.getDocuments(), []);
  const {
    data: fetchedDocuments,
    setData: setDocuments,
    loading,
    error,
    refetch: loadDocuments,
  } = useDemoQuery(fetchDocuments);
  const documents = fetchedDocuments ?? [];
  const [dragActive, setDragActive] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [activeUploadName, setActiveUploadName] = React.useState<string>('');
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [customTitle, setCustomTitle] = React.useState('');
  const [customKind, setCustomKind] = React.useState<DocumentKind>('electricity_bill');
  const [customQuote, setCustomQuote] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleToggle(doc: DocumentFile) {
    setUploadError(null);
    try {
      const next = await api.toggleSampleDocument(doc.id, !doc.selectedForRun);
      setDocuments(next);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to update file selection.');
    }
  }

  async function handleUseAll() {
    setUploadError(null);
    try {
      const next = await api.selectAllSampleDocuments();
      setDocuments(next);
      setStatusMessage(`All ${next.length} files selected for the Q3 2026 run.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to select all files.');
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setStatusMessage(null);
    setUploadProgress(0);

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        const lower = file.name.toLowerCase();
        const hasAllowedExt = ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
        if (!hasAllowedExt) {
          throw new Error(
            `"${file.name}" is not supported. Use PDF, Excel (.xlsx), CSV, PNG, or JPG.`
          );
        }

        const formatLabel: DocumentFile['formatLabel'] =
          lower.endsWith('.xlsx') || lower.endsWith('.csv')
            ? 'Excel'
            : lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')
              ? 'Note'
              : 'PDF';

        setActiveUploadName(file.name);
        setUploadProgress(5);
        await api.uploadDocument({
          file,
          fileName: file.name,
          formatLabel,
          docType: customKind,
          period: '2026-Q3',
          summary: `Uploaded file (${Math.max(1, Math.round(file.size / 1024))} KB) — staged for Collector.`,
          quoteText: customQuote.trim() || undefined,
          onProgress: (pct) => setUploadProgress(pct),
        });
      }

      const next = await api.getDocuments();
      setDocuments(next);
      setStatusMessage(
        `Uploaded ${files.length} file(s) and staged record(s) in your proof list.`
      );
      setCustomQuote('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setActiveUploadName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!customTitle.trim()) return;
    setUploading(true);
    setUploadError(null);
    setStatusMessage(null);
    setActiveUploadName(customTitle.trim());
    setUploadProgress(25);
    try {
      await api.uploadDocument({
        fileName: customTitle.trim(),
        formatLabel:
          customKind === 'production_log' || customKind === 'shipment_list' ? 'Excel' : 'PDF',
        docType: customKind,
        period: '2026-Q3',
        summary: 'User-entered document staged for Collector review.',
        quoteText: customQuote.trim() || undefined,
        onProgress: (pct) => setUploadProgress(pct),
      });
      const next = await api.getDocuments();
      setDocuments(next);
      setStatusMessage(`Added "${customTitle.trim()}" to the Q3 run and proof list.`);
      setCustomTitle('');
      setCustomQuote('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not add document.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setActiveUploadName('');
    }
  }

  const sampleDocs = documents.filter((d) => d.isSample);
  const userDocs = documents.filter((d) => !d.isSample);
  const selectedCount = documents.filter((d) => d.selectedForRun).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="collector">Factory Files</Badge>
          <h1 className="ct-page-title">Sample Files & Upload</h1>
          <p className="ct-body">Pick our sample factory bills or upload your own files.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleUseAll} disabled={loading || documents.length === 0}>
            <Check className="h-4 w-4 text-[var(--ct-outreach)]" aria-hidden="true" />
            Use all
          </Button>
          <Link
            href="/app/run"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--ct-collector-btn)] px-5 py-2.5 text-base font-bold text-white hover:bg-[var(--ct-collector-btn-hover)]"
          >
            Run team ({selectedCount})
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-[var(--ct-outreach-border)] bg-[var(--ct-outreach-soft)] px-5 py-3.5 text-base font-semibold text-[var(--ct-outreach-text)]"
        >
          {statusMessage}
        </div>
      ) : null}

      {uploadError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-[var(--ct-verifier-border)] bg-[var(--ct-verifier-soft)] px-5 py-3.5 text-base font-semibold text-[var(--ct-verifier-text)]"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>{uploadError}</span>
        </div>
      ) : null}

      {/* Upload your own drop zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload your own files</CardTitle>
          <CardDescription>
            Drop PDF bills, fuel invoices, or Excel sheets below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                void handleFiles(e.dataTransfer.files);
              }}
              className={cn(
                'min-w-0 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
                dragActive
                  ? 'border-[var(--ct-collector)] bg-[var(--ct-collector-soft)]'
                  : 'border-[var(--ct-border-strong)] bg-[var(--ct-surface-subtle)]'
              )}
            >
              <UploadCloud className="h-10 w-10 text-[var(--ct-collector)]" aria-hidden="true" />
              <p className="mt-3 text-base font-bold text-[var(--ct-ink)]">
                Drop bills, invoices, or Excel sheets here
              </p>
              <p className="ct-label mt-1">PDF, Excel (.xlsx), CSV, PNG, or JPG</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.xlsx,.csv,.png,.jpg,.jpeg"
                onChange={(e) => void handleFiles(e.target.files)}
                className="sr-only"
                id="upload-file-input"
                aria-label="Upload bills, logs, or supplier files"
              />
              <Button
                variant="blue"
                className="mt-4"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? `Uploading ${uploadProgress}%…` : 'Choose files'}
              </Button>
            </div>

            <form
              onSubmit={handleManualAdd}
              className="min-w-0 space-y-4 rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-surface-subtle)] p-5 sm:p-6"
            >
              <p className="text-base font-bold text-[var(--ct-ink)]">Or add a quick note</p>
              <div>
                <label
                  htmlFor="doc-name-input"
                  className="mb-1.5 block text-[14px] font-semibold text-[var(--ct-ink-secondary)]"
                >
                  File name
                </label>
                <Input
                  id="doc-name-input"
                  placeholder="e.g. Oct_Power_Bill.pdf"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="doc-kind-select"
                    className="mb-1.5 block text-[14px] font-semibold text-[var(--ct-ink-secondary)]"
                  >
                    File type
                  </label>
                  <select
                    id="doc-kind-select"
                    value={customKind}
                    onChange={(e) => setCustomKind(e.target.value as DocumentKind)}
                    className="min-h-[44px] w-full rounded-xl border border-[var(--ct-border-strong)] bg-[var(--ct-surface)] px-3.5 text-[15px] text-[var(--ct-ink)]"
                  >
                    <option value="electricity_bill">Electricity bill</option>
                    <option value="fuel_invoice">Fuel invoice</option>
                    <option value="material_invoice">Material invoice</option>
                    <option value="production_log">Production log</option>
                    <option value="shipment_list">Shipment list</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="doc-quote-input"
                    className="mb-1.5 block text-[14px] font-semibold text-[var(--ct-ink-secondary)]"
                  >
                    Quote (optional)
                  </label>
                  <Input
                    id="doc-quote-input"
                    placeholder="e.g. 12,400 kWh"
                    value={customQuote}
                    onChange={(e) => setCustomQuote(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" variant="outline" disabled={uploading || !customTitle.trim()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add file
              </Button>
            </form>
          </div>

          {uploading ? (
            <div
              role="status"
              aria-live="polite"
              className="space-y-2 rounded-2xl border border-[var(--ct-collector-border)] bg-[var(--ct-collector-soft)] p-4"
            >
              <div className="flex items-center justify-between gap-2 text-[14px] font-semibold text-[var(--ct-collector-text)]">
                <span className="truncate">Uploading {activeUploadName || 'file'}...</span>
                <span className="ct-tabular">{uploadProgress}%</span>
              </div>
              <Progress
                value={uploadProgress}
                label="Upload progress"
                barColorClass="bg-[var(--ct-collector)]"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <PageErrorState message={error} onRetry={loadDocuments} />
      ) : loading ? (
        <PageLoadingSkeleton cards={3} rows={3} />
      ) : documents.length === 0 ? (
        <EmptyStateCard
          title="No files yet"
          hint="Drop a PDF or Excel bill above to start collecting facts."
        />
      ) : (
        <>
          {userDocs.length > 0 ? (
            <section aria-labelledby="user-uploads-heading" className="space-y-4">
              <h2 id="user-uploads-heading" className="ct-section-title">
                Your Uploaded Files ({userDocs.length})
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {userDocs.map((doc) => {
                  const Icon = FORMAT_ICONS[doc.formatLabel];
                  return (
                    <Card key={doc.id} className="border-[var(--ct-collector-border)]">
                      <CardContent className="flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="collector">
                              <Icon className="h-4 w-4" aria-hidden="true" />
                              {doc.formatLabel}
                            </Badge>
                            <Badge variant="success">Uploaded</Badge>
                          </div>
                          <h3 className="ct-card-title mt-3 break-words">{doc.fileName}</h3>
                          <p className="ct-body mt-1.5">{doc.summary}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ct-border)] pt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openSource({ documentId: doc.id, page: 1, title: doc.fileName })
                            }
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant={doc.selectedForRun ? 'blue' : 'outline'}
                            onClick={() => void handleToggle(doc)}
                          >
                            {doc.selectedForRun ? 'Using' : 'Use this'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Sample Files Panel */}
          <section aria-labelledby="sample-files-heading" className="space-y-4">
            <div className="space-y-1.5">
              <h2 id="sample-files-heading" className="ct-section-title">
                Sample Files ({sampleDocs.length} demo documents)
              </h2>
              <p className="ct-body">
                Includes deliberate errors so you can watch the Verifier catch them.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sampleDocs.map((doc) => {
                const Icon = FORMAT_ICONS[doc.formatLabel];
                return (
                  <Card
                    key={doc.id}
                    className={cn(
                      'min-w-0 overflow-hidden transition-colors',
                      doc.selectedForRun
                        ? 'border-[var(--ct-collector-border)]'
                        : 'border-[var(--ct-border)] bg-[var(--ct-surface-raised)]'
                    )}
                  >
                    <CardContent className="flex h-full min-w-0 flex-col justify-between gap-4 p-5 sm:p-6">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="collector">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            {doc.formatLabel}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            {doc.duplicateOfId ? (
                              <Badge variant="warning">Duplicate copy</Badge>
                            ) : null}
                            <Badge variant="neutral">Sample</Badge>
                          </div>
                        </div>
                        <h3 className="ct-card-title mt-3 break-words">{doc.fileName}</h3>
                        <p className="ct-body mt-1.5">{doc.summary}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ct-border)] pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openSource({ documentId: doc.id, page: 1, title: doc.fileName })
                          }
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Preview
                        </Button>
                        <Button
                          size="sm"
                          variant={doc.selectedForRun ? 'secondary' : 'outline'}
                          aria-pressed={doc.selectedForRun}
                          onClick={() => void handleToggle(doc)}
                        >
                          {doc.selectedForRun ? (
                            <>
                              <Check className="h-4 w-4" aria-hidden="true" />
                              Using
                            </>
                          ) : (
                            'Use this'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
