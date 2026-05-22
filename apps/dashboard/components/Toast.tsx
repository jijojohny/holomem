'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ConfirmOptions {
  title: string;
  body?: string;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = String(counter.current++);
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  function settle(result: boolean) {
    confirmState?.resolve(result);
    setConfirmState(null);
  }

  const ICONS: Record<ToastKind, string> = { success: '✓', error: '✕', info: 'ℹ' };
  const COLORS: Record<ToastKind, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    info: 'border-white/15 bg-white/8 text-zinc-200',
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 backdrop-blur-md border rounded-xl px-4 py-3 text-sm shadow-lg max-w-sm animate-in ${COLORS[t.kind]}`}
          >
            <span className="text-xs font-bold shrink-0">{ICONS[t.kind]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirmation modal */}
      {confirmState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => settle(false)} />
          <div className="relative backdrop-blur-md bg-[#111]/90 border border-white/15 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h2 className="text-base font-semibold text-white">{confirmState.title}</h2>
            {confirmState.body && (
              <p className="text-sm text-zinc-400 leading-relaxed">{confirmState.body}</p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => settle(false)}
                className="btn-ghost px-4 py-2 text-sm"
              >
                {confirmState.cancel ?? 'Cancel'}
              </button>
              <button
                onClick={() => settle(true)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                  confirmState.danger
                    ? 'bg-red-600 hover:bg-red-500 text-white focus-visible:ring-red-500'
                    : 'bg-violet-600 hover:bg-violet-500 text-white focus-visible:ring-violet-500'
                }`}
              >
                {confirmState.confirm ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
