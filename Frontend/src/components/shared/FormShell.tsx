import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { absoluteTime, relativeTime } from '../../lib/time'
import { StatusPill } from './StatusPill'

export interface FormAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

const VARIANT_CLASSES: Record<NonNullable<FormAction['variant']>, string> = {
  primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-sm)]',
  secondary: 'border border-[var(--color-rule-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 shadow-[var(--shadow-sm)]',
}

/** Design doc §7.4 — the action bar every form screen in the wireframes
 * shares: Back on the left, a status pill next to the title, and
 * contextual actions (New/Confirm/Print/Pay/…) on the right.
 *
 * Every 'danger' action (Cancel, Reset to Draft, Archive) goes through a
 * one-step confirmation here rather than firing on the first click - this
 * one guard covers every such action across the app since they all go
 * through this component's action bar. */
export function FormShell({
  title,
  status,
  updatedAt,
  actions = [],
  onBack,
  children,
}: {
  title: string
  status?: string
  /** When set, shows "Updated {relative time}" next to the status pill
   * (title carries the precise timestamp) - so a transaction's own page
   * answers "when did this happen", not just the shared notification feed. */
  updatedAt?: string
  actions?: FormAction[]
  onBack: () => void
  children: ReactNode
}) {
  const [pendingAction, setPendingAction] = useState<FormAction | null>(null)

  function handleActionClick(action: FormAction) {
    if (action.variant === 'danger') {
      setPendingAction(action)
    } else {
      action.onClick()
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className="h-4 w-px bg-[var(--color-rule-2)]" />
          <h1 className="font-display text-[19px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
          {status && <StatusPill status={status} />}
          {updatedAt && (
            <span className="text-xs text-[var(--color-ink-3)]" title={absoluteTime(updatedAt)}>
              Updated {relativeTime(updatedAt)}
            </span>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${VARIANT_CLASSES[action.variant ?? 'secondary']}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-md)]">
        {children}
      </div>

      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setPendingAction(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2.5 text-[var(--color-danger)]">
              <AlertTriangle size={18} />
              <h2 className="font-display text-base font-semibold">{pendingAction.label}?</h2>
            </div>
            <p className="mb-5 text-sm text-[var(--color-ink-2)]">
              This action can't be undone. Are you sure you want to continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingAction.onClick()
                  setPendingAction(null)
                }}
                className="rounded-md bg-[var(--color-danger)] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Yes, {pendingAction.label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
