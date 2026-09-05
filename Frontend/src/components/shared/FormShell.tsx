import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { StatusPill } from './StatusPill'

export interface FormAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

const VARIANT_CLASSES: Record<NonNullable<FormAction['variant']>, string> = {
  primary: 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]',
  secondary: 'border border-[var(--color-rule-2)] text-[var(--color-ink)] hover:bg-[var(--color-paper)]',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
}

/** Design doc §7.4 — the action bar every form screen in the wireframes
 * shares: Back on the left, a status pill next to the title, and
 * contextual actions (New/Confirm/Print/Pay/…) on the right. */
export function FormShell({
  title,
  status,
  actions = [],
  onBack,
  children,
}: {
  title: string
  status?: string
  actions?: FormAction[]
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <span className="h-4 w-px bg-[var(--color-rule-2)]" />
          <h1 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h1>
          {status && <StatusPill status={status} />}
        </div>
        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${VARIANT_CLASSES[action.variant ?? 'secondary']}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-6">{children}</div>
    </div>
  )
}
