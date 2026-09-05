import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info } as const

const VARIANT_CLASSES = {
  success: 'border-[var(--color-success)]/30 bg-[var(--color-success-bg)] text-[var(--color-success)]',
  error: 'border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  info: 'border-[var(--color-rule-2)] bg-[var(--color-surface)] text-[var(--color-ink)]',
} as const

/** Mounted once at the app root (App.tsx) so every mutation — across every
 * feature page and the axios interceptor's automatic action toasts — has
 * one shared place to land, regardless of which route is active. */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="print:hidden fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant]
        return (
          <div
            key={t.id}
            role="status"
            className={`animate-[toast-in_0.2s_ease-out] flex items-start gap-2.5 rounded-lg border px-4 py-3 shadow-[var(--shadow-md)] ${VARIANT_CLASSES[t.variant]}`}
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-sm font-medium leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
