/** Colour-mapped status badge — design doc §7.4. One component for every
 * document/budget status across the app so a colour always means the same
 * thing wherever it appears. */

const STYLES: Record<string, string> = {
  DRAFT: 'bg-[var(--color-rule)] text-[var(--color-ink-2)]',
  CONFIRMED: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
  POSTED: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  PARTIALLY_PAID: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  PAID: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  UNPAID: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  CANCELLED: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  REVISED: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
  ACTIVE: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  ARCHIVED: 'bg-[var(--color-rule)] text-[var(--color-ink-3)]',
}

const LABELS: Record<string, string> = {
  PARTIALLY_PAID: 'Partially Paid',
}

export function StatusPill({ status }: { status: string }) {
  const style = STYLES[status] ?? 'bg-[var(--color-rule)] text-[var(--color-ink-2)]'
  const label = LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase()
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide ${style}`}
    >
      {label}
    </span>
  )
}
