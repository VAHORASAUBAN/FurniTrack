import { useQuery } from '@tanstack/react-query'
import { Inbox, X } from 'lucide-react'
import type { ReactNode } from 'react'

export interface DetailColumn<T> {
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface DashboardDetailModalProps<T> {
  title: string
  subtitle?: string
  queryKey: string
  fetcher: () => Promise<T[]>
  columns: DetailColumn<T>[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  onClose: () => void
}

/** The "small view pane" behind every Dashboard KPI card and status-
 * breakdown bar: a quick, read-only preview of what's actually behind a
 * number, without leaving the Dashboard - click a row to open the real
 * record. Generic over row shape since Receivable/Payable pull Documents,
 * Sales/Purchase Orders pull Documents too but with different filters,
 * and Budget Achieved pulls Budgets - one shell, different data per KPI. */
export function DashboardDetailModal<T>({
  title,
  subtitle,
  queryKey,
  fetcher,
  columns,
  rowKey,
  onRowClick,
  emptyMessage = 'Nothing here.',
  onClose,
}: DashboardDetailModalProps<T>) {
  const { data: items, isLoading } = useQuery({ queryKey: ['dashboard-detail', queryKey], queryFn: fetcher })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {isLoading && <div className="py-8 text-center text-sm text-[var(--color-ink-3)]">Loading…</div>}

        {!isLoading && items && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox size={20} className="text-[var(--color-ink-3)]" />
            <p className="text-sm text-[var(--color-ink-3)]">{emptyMessage}</p>
          </div>
        )}

        {!isLoading && items && items.length > 0 && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[var(--color-rule)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 text-left">
                  {columns.map((col) => (
                    <th
                      key={col.header}
                      className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)] ${col.className ?? ''}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={
                      onRowClick
                        ? 'cursor-pointer border-b border-[var(--color-rule)] last:border-0 hover:bg-[var(--color-accent-bg)]/50'
                        : 'border-b border-[var(--color-rule)] last:border-0'
                    }
                  >
                    {columns.map((col) => (
                      <td key={col.header} className={`px-3 py-2 text-[var(--color-ink)] ${col.className ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
