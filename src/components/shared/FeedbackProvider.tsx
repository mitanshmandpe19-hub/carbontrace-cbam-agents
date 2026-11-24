'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export type ToastTone = 'error' | 'success' | 'info';

export interface FeedbackToast {
  id: string;
  tone: ToastTone;
  message: string;
}

const TOAST_EVENT = 'carbontrace:toast';
const WAKING_EVENT = 'carbontrace:server-waking';

let recentToastKey = '';
let recentToastAt = 0;

export function notifyToast(tone: ToastTone, message: string): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const key = `${tone}:${message}`;
  if (key === recentToastKey && now - recentToastAt < 3000) {
    return;
  }
  recentToastKey = key;
  recentToastAt = now;
  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: { tone, message },
    })
  );
}

export function notifyServerWaking(active: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WAKING_EVENT, {
      detail: { active },
    })
  );
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<FeedbackToast[]>([]);
  const [waking, setWaking] = React.useState(false);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const onToast = (ev: Event) => {
      const detail = (ev as CustomEvent<{ tone?: ToastTone; message?: string }>).detail;
      if (!detail?.message) return;
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const tone: ToastTone = detail.tone ?? 'info';
      setToasts((prev) => [...prev.slice(-3), { id, tone, message: detail.message! }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5500);
    };

    const onWaking = (ev: Event) => {
      const detail = (ev as CustomEvent<{ active?: boolean }>).detail;
      setWaking(Boolean(detail?.active));
    };

    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(WAKING_EVENT, onWaking);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(WAKING_EVENT, onWaking);
    };
  }, []);

  return (
    <>
      {children}

      {waking && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-5 z-50 flex max-w-md items-center gap-3 rounded-[14px] border border-[var(--ct-calculator-border)] bg-[var(--ct-surface)] px-4 py-3 text-[14px] font-medium text-[var(--ct-ink)] shadow-xl transition-all"
        >
          <Loader2
            size={18}
            className="shrink-0 animate-spin text-[var(--ct-calculator)]"
          />
          <span>Waking up the server, this may take 30-50 seconds on free hosting...</span>
        </div>
      )}

      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed right-5 bottom-5 z-50 flex w-[calc(100vw-2.5rem)] max-w-md flex-col gap-2.5"
        >
          {toasts.map((toast) => {
            const borderClass =
              toast.tone === 'error'
                ? 'border-[var(--ct-verifier-border)]'
                : toast.tone === 'success'
                  ? 'border-[var(--ct-outreach-border)]'
                  : 'border-[var(--ct-collector-border)]';
            const iconColorClass =
              toast.tone === 'error'
                ? 'text-[var(--ct-verifier)]'
                : toast.tone === 'success'
                  ? 'text-[var(--ct-outreach)]'
                  : 'text-[var(--ct-collector)]';

            return (
              <div
                key={toast.id}
                role={toast.tone === 'error' ? 'alert' : 'status'}
                className={`flex items-start justify-between gap-3 rounded-[14px] border ${borderClass} bg-[var(--ct-surface)] px-4 py-3 text-[14px] text-[var(--ct-ink)] shadow-lg`}
              >
                <div className="flex items-start gap-2.5">
                  {toast.tone === 'error' ? (
                    <AlertCircle size={18} className={`mt-0.5 shrink-0 ${iconColorClass}`} />
                  ) : toast.tone === 'success' ? (
                    <CheckCircle2 size={18} className={`mt-0.5 shrink-0 ${iconColorClass}`} />
                  ) : (
                    <Info size={18} className={`mt-0.5 shrink-0 ${iconColorClass}`} />
                  )}
                  <p className="leading-[1.5] text-[var(--ct-ink)]">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Close message"
                  className="shrink-0 rounded-md p-1 text-[var(--ct-ink-secondary)] hover:bg-[var(--ct-surface-raised)] hover:text-[var(--ct-ink)]"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

