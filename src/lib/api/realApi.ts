import type { CarbonTraceApi, UploadDocumentPayload } from './client';
import { emitAuthExpired, getAccessToken } from '@/lib/authSession';
import { notifyServerWaking, notifyToast } from '@/components/shared/FeedbackProvider';
import type {
  CalculationLine,
  DashboardSummary,
  DocumentFile,
  EmissionFactor,
  GapItem,
  HistoryResponse,
  LedgerRecord,
  OutreachRequest,
  PipelineRun,
  ReportSnapshot,
  Supplier,
  VerificationFlag,
} from '@/types/carbon';

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  return raw.replace(/\/+$/, '');
}

export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;

  constructor(status: number, message: string, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

export interface BackendUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName: string;
  isDemo: boolean;
}

export interface BackendTokenResponse {
  accessToken: string;
  tokenType: 'bearer';
  expiresInSeconds: number;
  user: BackendUserProfile;
}

let inFlightCount = 0;
let wakingTimer: ReturnType<typeof setTimeout> | null = null;

function beginRequestTracking(): () => void {
  inFlightCount += 1;
  if (typeof window !== 'undefined' && wakingTimer === null) {
    wakingTimer = setTimeout(() => {
      if (inFlightCount > 0) {
        notifyServerWaking(true);
      }
    }, 2200);
  }

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    inFlightCount = Math.max(0, inFlightCount - 1);
    if (inFlightCount === 0) {
      if (wakingTimer !== null) {
        clearTimeout(wakingTimer);
        wakingTimer = null;
      }
      notifyServerWaking(false);
    }
  };
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text) as {
        detail?: string | { msg?: string }[];
        message?: string;
      };
      if (typeof parsed.detail === 'string') return parsed.detail;
      if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
        return parsed.detail.map((item) => item.msg || 'Invalid input').join('. ');
      }
      if (typeof parsed.message === 'string') return parsed.message;
    } catch {
      // Plain text error body
    }
    return text.slice(0, 180);
  } catch {
    return `Request failed (${res.status})`;
  }
}

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
  explicitToken?: string;
  suppressToast?: boolean;
  allowNotFound?: boolean;
}

let serverAwakePromise: Promise<boolean> | null = null;

async function pollHealthUntilAwake(maxWaitMs = 60000): Promise<boolean> {
  if (serverAwakePromise) {
    return serverAwakePromise;
  }

  serverAwakePromise = (async () => {
    const healthUrl = `${getApiBaseUrl()}/health`;
    const startTime = Date.now();
    notifyServerWaking(true);

    try {
      while (Date.now() - startTime < maxWaitMs) {
        try {
          const res = await fetch(healthUrl, { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            return true;
          }
        } catch {
          // Still waiting for backend instance to boot
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      return false;
    } finally {
      notifyServerWaking(false);
      serverAwakePromise = null;
    }
  })();

  return serverAwakePromise;
}

async function rawRequest(path: string, init: RequestOptions = {}): Promise<Response> {
  const {
    requireAuth = true,
    explicitToken,
    suppressToast = false,
    allowNotFound = false,
    headers: customHeaders,
    ...rest
  } = init;

  const endTracking = beginRequestTracking();
  const headers = new Headers(customHeaders);
  const token = explicitToken ?? getAccessToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (requireAuth && !token) {
    endTracking();
    emitAuthExpired('Please log in to continue.');
    throw new ApiError(401, 'Please log in to continue.');
  }

  const url = `${getApiBaseUrl()}${path}`;
  const isHealthCheck = path === '/health' || path === '/api/health';

  const execute = async (isRetry = false): Promise<Response> => {
    try {
      const res = await fetch(url, {
        ...rest,
        headers,
      });

      // Handle Render free tier cold-start gateways (502, 503, 504)
      if (!isHealthCheck && !isRetry && (res.status === 502 || res.status === 503 || res.status === 504)) {
        notifyServerWaking(true);
        const wokeUp = await pollHealthUntilAwake(60000);
        if (wokeUp) {
          return await execute(true);
        }
      }

      if (res.status === 401) {
        const message = await extractErrorMessage(res);
        if (requireAuth) {
          emitAuthExpired('Your session ended. Please log in again.');
        }
        if (!suppressToast) notifyToast('error', message);
        throw new ApiError(401, message);
      }

      if (res.status === 404 && allowNotFound) {
        return res;
      }

      if (!res.ok) {
        const message = await extractErrorMessage(res);
        if (!suppressToast) notifyToast('error', message);
        throw new ApiError(res.status, message);
      }

      return res;
    } catch (err) {
      if (err instanceof ApiError) throw err;

      // Connection dropped or refused during cold-start boot: retry via /health check
      if (!isHealthCheck && !isRetry) {
        notifyServerWaking(true);
        const wokeUp = await pollHealthUntilAwake(60000);
        if (wokeUp) {
          return await execute(true);
        }
      }

      const message =
        err instanceof Error && err.message && err.message !== 'Failed to fetch'
          ? err.message
          : 'Cannot reach the CarbonTrace server. Check that it is running.';
      if (!suppressToast) notifyToast('error', message);
      throw new ApiError(0, message, true);
    }
  };

  try {
    return await execute();
  } finally {
    endTracking();
  }
}

async function fetchJson<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await rawRequest(path, { ...init, headers });
  return (await res.json()) as T;
}

export const realAuthApi = {
  async login(email: string, password: string): Promise<BackendTokenResponse> {
    return fetchJson<BackendTokenResponse>('/api/auth/login', {
      method: 'POST',
      requireAuth: false,
      suppressToast: true,
      body: JSON.stringify({ email, password }),
    });
  },

  async demoLogin(): Promise<BackendTokenResponse> {
    return fetchJson<BackendTokenResponse>('/api/auth/demo', {
      method: 'POST',
      requireAuth: false,
      suppressToast: true,
    });
  },

  async requestMagicLink(email: string): Promise<{ message: string }> {
    return fetchJson<{ message: string }>('/api/auth/magic-link', {
      method: 'POST',
      requireAuth: false,
      suppressToast: true,
      body: JSON.stringify({ email }),
    });
  },

  async getMe(token?: string): Promise<BackendUserProfile> {
    return fetchJson<BackendUserProfile>('/api/auth/me', {
      method: 'GET',
      explicitToken: token,
      suppressToast: true,
    });
  },
};

function parseFilenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename\*?=(?:UTF-8''|"?)([^";\n]+)"?/i);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1].replace(/["']/g, '').trim());
    } catch {
      return match[1].replace(/["']/g, '').trim();
    }
  }
  return fallback;
}

export const realApi: CarbonTraceApi = {
  getDashboard: (period) =>
    fetchJson<DashboardSummary>(
      period ? `/api/dashboard?period=${encodeURIComponent(period)}` : '/api/dashboard'
    ),

  getDocuments: () => fetchJson<DocumentFile[]>('/api/documents'),

  toggleSampleDocument: (documentId, selected) =>
    fetchJson<DocumentFile[]>(`/api/documents/${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ selectedForRun: selected }),
    }),

  selectAllSampleDocuments: () =>
    fetchJson<DocumentFile[]>('/api/documents/select-all', { method: 'POST' }),

  async uploadDocument(payload: UploadDocumentPayload): Promise<DocumentFile> {
    if (!payload.file) {
      payload.onProgress?.(40);
      const doc = await fetchJson<DocumentFile>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          fileName: payload.fileName,
          formatLabel: payload.formatLabel,
          docType: payload.docType,
          period: payload.period,
          summary: payload.summary,
          quoteText: payload.quoteText,
        }),
      });
      payload.onProgress?.(100);
      return doc;
    }

    const token = getAccessToken();
    if (!token) {
      emitAuthExpired('Please log in before uploading documents.');
      throw new ApiError(401, 'Please log in before uploading documents.');
    }

    const formData = new FormData();
    formData.append('file', payload.file, payload.fileName || payload.file.name);
    formData.append('docType', payload.docType);
    formData.append('period', payload.period);
    formData.append('summary', payload.summary);
    if (payload.quoteText) {
      formData.append('quoteText', payload.quoteText);
    }

    const endTracking = beginRequestTracking();
    payload.onProgress?.(5);

    try {
      return await new Promise<DocumentFile>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getApiBaseUrl()}/api/documents`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && ev.total > 0) {
            const pct = Math.min(95, Math.max(8, Math.round((ev.loaded / ev.total) * 95)));
            payload.onProgress?.(pct);
          }
        };

        xhr.onload = () => {
          payload.onProgress?.(100);
          if (xhr.status === 401) {
            emitAuthExpired('Your session ended. Please log in again.');
            reject(new ApiError(401, 'Session expired. Please log in again.'));
            return;
          }

          let parsed: unknown = null;
          try {
            parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            parsed = null;
          }

          if (xhr.status >= 200 && xhr.status < 300 && parsed) {
            resolve(parsed as DocumentFile);
            return;
          }

          const detail =
            parsed && typeof parsed === 'object' && 'detail' in parsed
              ? String((parsed as { detail: unknown }).detail)
              : `Upload failed (${xhr.status})`;
          notifyToast('error', detail);
          reject(new ApiError(xhr.status, detail));
        };

        xhr.onerror = () => {
          const message = 'Upload failed. Check connection to the CarbonTrace server.';
          notifyToast('error', message);
          reject(new ApiError(0, message, true));
        };

        xhr.send(formData);
      });
    } finally {
      endTracking();
    }
  },

  async getDocumentPreview(documentId, page) {
    const query = page ? `?page=${page}` : '';
    const res = await rawRequest(
      `/api/documents/${encodeURIComponent(documentId)}/preview${query}`,
      { allowNotFound: true }
    );
    if (res.status === 404) return null;
    return (await res.json()) as DocumentFile;
  },

  async fetchDocumentRawBlob(documentId) {
    const res = await rawRequest(`/api/documents/${encodeURIComponent(documentId)}/raw`, {
      allowNotFound: true,
      suppressToast: true,
    });
    if (res.status === 404) return null;
    const blob = await res.blob();
    return {
      blob,
      mimeType: res.headers.get('Content-Type') || blob.type || 'application/octet-stream',
    };
  },

  createRun: (period, product) =>
    fetchJson<PipelineRun>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ period, product }),
    }),

  async getRun(runId) {
    if (runId) {
      return fetchJson<PipelineRun>(`/api/runs/${encodeURIComponent(runId)}`);
    }
    const runs = await fetchJson<PipelineRun[]>('/api/runs');
    if (runs.length > 0) return runs[0];
    throw new ApiError(404, 'No CBAM run found yet. Start one on Upload or Runs.');
  },

  runSimulatedPipelineStep: (runId) =>
    fetchJson<PipelineRun>(`/api/runs/${encodeURIComponent(runId)}/step`, {
      method: 'POST',
    }),

  async resetDemoState(): Promise<void> {
    await fetchJson<{ status: string }>('/api/auth/demo/reset', {
      method: 'POST',
    });
    notifyToast('success', 'Demo data reset to starting state.');
  },

  getLedger: (runId) =>
    fetchJson<LedgerRecord[]>(
      runId ? `/api/ledger?runId=${encodeURIComponent(runId)}` : '/api/ledger'
    ),

  async getLedgerRecord(recordId) {
    const res = await rawRequest(`/api/ledger/${encodeURIComponent(recordId)}`, {
      allowNotFound: true,
    });
    if (res.status === 404) return null;
    return (await res.json()) as LedgerRecord;
  },

  getGaps: (runId) =>
    fetchJson<GapItem[]>(
      runId ? `/api/gaps?runId=${encodeURIComponent(runId)}` : '/api/gaps'
    ),

  getOutreach: (runId) =>
    fetchJson<OutreachRequest[]>(
      runId ? `/api/outreach?runId=${encodeURIComponent(runId)}` : '/api/outreach'
    ),

  approveOutreach: (outreachId, editedDraft) =>
    fetchJson<OutreachRequest>(`/api/outreach/${encodeURIComponent(outreachId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ draft: editedDraft ?? null }),
    }),

  simulateSupplierReply: (outreachId) =>
    fetchJson(`/api/outreach/${encodeURIComponent(outreachId)}/simulate-reply`, {
      method: 'POST',
    }),

  simulateNoReplyFallback: (outreachId) =>
    fetchJson(`/api/outreach/${encodeURIComponent(outreachId)}/fallback`, {
      method: 'POST',
    }),

  getCalculations: (runId) =>
    fetchJson<CalculationLine[]>(
      runId ? `/api/calculations?runId=${encodeURIComponent(runId)}` : '/api/calculations'
    ),

  getEmissionFactors: () => fetchJson<EmissionFactor[]>('/api/factors'),

  getVerificationFlags: (runId) =>
    fetchJson<VerificationFlag[]>(
      runId ? `/api/verification?runId=${encodeURIComponent(runId)}` : '/api/verification'
    ),

  resolveVerificationFlag: (flagId, resolution) =>
    fetchJson(`/api/verification/${encodeURIComponent(flagId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    }),

  approveReport: (runId) =>
    fetchJson<ReportSnapshot>(`/api/reports/${encodeURIComponent(runId)}/approve`, {
      method: 'POST',
    }),

  getReports: () => fetchJson<ReportSnapshot[]>('/api/reports'),

  async exportReport(reportId, format) {
    const res = await rawRequest(
      `/api/reports/${encodeURIComponent(reportId)}/export?format=${format}`,
      { method: 'GET' }
    );
    const fallbackName = `CarbonTrace_${reportId}_CBAM.${format}`;
    const fileName = parseFilenameFromHeader(
      res.headers.get('Content-Disposition'),
      fallbackName
    );
    const mimeType =
      res.headers.get('Content-Type') ||
      (format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { fileName, mimeType, content: bytes };
  },

  getHistory: (product) =>
    fetchJson<HistoryResponse>(
      product ? `/api/history?product=${encodeURIComponent(product)}` : '/api/history'
    ),

  getSuppliers: () => fetchJson<Supplier[]>('/api/suppliers'),

  async getSupplier(supplierId) {
    const res = await rawRequest(`/api/suppliers/${encodeURIComponent(supplierId)}`, {
      allowNotFound: true,
    });
    if (res.status === 404) return null;
    return (await res.json()) as Supplier;
  },

  appendRunLog: (runId) => fetchJson<PipelineRun>(`/api/runs/${encodeURIComponent(runId)}`),

  streamRun(runId, onUpdate, onFallbackPolling) {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      onFallbackPolling?.();
      return () => { };
    }
    const token = getAccessToken();
    if (!token) {
      onFallbackPolling?.();
      return () => { };
    }

    const url = `${getApiBaseUrl()}/api/runs/${encodeURIComponent(
      runId
    )}/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    let closed = false;
    let errorCount = 0;

    es.addEventListener('run_update', (ev) => {
      if (closed) return;
      errorCount = 0;
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as PipelineRun;
        onUpdate(parsed);
      } catch {
        // Ignore malformed SSE chunks cleanly
      }
    });

    es.onerror = () => {
      errorCount += 1;
      if (closed || errorCount >= 2) {
        closed = true;
        es.close();
        onFallbackPolling?.();
      }
    };

    return () => {
      closed = true;
      es.close();
    };
  },
};
