import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Inbox, Plus, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { ListParams, Page } from '../../types/api'

export interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
}

interface ListViewProps<T> {
  title: string
  queryKey: string
  fetcher: (params: ListParams) => Promise<Page<T>>
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  onRowClick?: (row: T) => void
  onNew?: () => void
  newLabel?: string
  supportsArchive?: boolean
  searchPlaceholder?: string
}

/** Design doc §7.4 — the shared list screen: search, pagination, New
 * button, and (when the module supports archive) a toggle for archived
 * records. One component drives Contacts, Products, Chart of Accounts,
 * Journals, Analytic Accounts, and every document/journal-entry list. */
export function ListView<T>({
  title,
  queryKey,
  fetcher,
  columns,
  rowKey,
  onRowClick,
  onNew,
  newLabel = 'New',
  supportsArchive = true,
  searchPlaceholder = 'Search…',
}: ListViewProps<T>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [includeArchived, setIncludeArchived] = useState(false)
  const pageSize = 25

  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKey, { search, page, includeArchived }],
    queryFn: () => fetcher({ search: search || undefined, page, page_size: pageSize, include_archived: includeArchived }),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
        {onNew && (
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Plus size={16} /> {newLabel}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        {supportsArchive && (
          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] select-none">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                setIncludeArchived(e.target.checked)
                setPage(1)
              }}
              className="accent-[var(--color-accent)]"
            />
            Show archived
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 text-left">
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-3 font-semibold text-[var(--color-ink-3)] text-[11px] uppercase tracking-wider">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-[var(--color-ink-3)]">
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-[var(--color-danger)]">
                  Could not load data.
                </td>
              </tr>
            )}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Inbox size={22} className="text-[var(--color-ink-3)]" />
                    <span className="text-sm text-[var(--color-ink-3)]">Nothing here yet.</span>
                  </div>
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={
                  onRowClick
                    ? 'cursor-pointer border-b border-[var(--color-rule)] transition-colors last:border-0 hover:bg-[var(--color-accent-bg)]/50'
                    : 'border-b border-[var(--color-rule)] last:border-0'
                }
              >
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-3 text-[var(--color-ink)] ${col.className ?? ''}`}>
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-ink-2)]">
          <span>
            {data.total} record{data.total === 1 ? '' : 's'} · page {data.page} of {data.total_pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 transition-colors hover:bg-[var(--color-paper-2)] disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 transition-colors hover:bg-[var(--color-paper-2)] disabled:opacity-40"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
