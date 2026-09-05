import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Inbox,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Printer,
  Search,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { ListParams, Page } from '../../types/api'

export interface Column<T> {
  header: string
  accessor: (row: T) => ReactNode
  className?: string
  /** Backend field name this column sorts by (must be in that module's
   * SORT_FIELDS) — omit for columns the API can't sort on. */
  sortKey?: string
  /** Plain-text value for CSV export / print. Falls back to the accessor's
   * own return value when that's already a string or number (most columns
   * are); required only for columns whose accessor renders JSX (a
   * StatusPill, an avatar) if you want that column in the export at all. */
  csvValue?: (row: T) => string | number | null | undefined
}

export interface KanbanColumn {
  key: string
  label: string
}

export interface StatusFilterOption {
  value: string
  label: string
}

export interface KanbanConfig<T> {
  groupBy: (row: T) => string
  columns: KanbanColumn[]
  renderCard: (row: T) => ReactNode
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
  /** Design doc §7.4's "List ⇄ Kanban toggle". Kanban shows every matching
   * row grouped into columns rather than a paginated table — it fetches a
   * larger page instead of paging, since a board isn't naturally split
   * across pages the way a table is. */
  kanban?: KanbanConfig<T>
  /** A status/type dropdown - only shown when the backend actually
   * supports filtering that field (see each router's exact_filters /
   * status Query param before adding this). */
  statusFilter?: { options: StatusFilterOption[]; label?: string }
  /** From/To date inputs, filtering whichever date column that module's
   * backend range-filters on (doc_date, entry_date, payment_date, …). */
  dateRangeFilter?: { label?: string }
}

const EXPORT_PAGE_SIZE = 1000

function cellText<T>(col: Column<T>, row: T): string {
  if (col.csvValue) {
    const value = col.csvValue(row)
    return value === null || value === undefined ? '' : String(value)
  }
  const value = col.accessor(row)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function toCsvField(value: string): string {
  return /["\r\n,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Design doc §7.4 — the shared list screen: search, sort, pagination, New
 * button, and (when the module supports archive) a toggle for archived
 * records — plus CSV export and print, which every module gets for free
 * through this one component. Drives Contacts, Products, Chart of
 * Accounts, Journals, Analytic Accounts, Budgets, Users, and every
 * document/journal-entry/payment list. */
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
  kanban,
  statusFilter,
  dateRangeFilter,
}: ListViewProps<T>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<string | undefined>(undefined)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [isExporting, setIsExporting] = useState(false)
  const isKanban = Boolean(kanban) && viewMode === 'kanban'
  const pageSize = isKanban ? 100 : 25
  const hasActiveFilters = Boolean(search || status || dateFrom || dateTo || includeArchived)

  const filterParams = {
    search: search || undefined,
    sort,
    include_archived: includeArchived,
    status: status || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKey, { ...filterParams, page: isKanban ? 1 : page, pageSize }],
    queryFn: () => fetcher({ ...filterParams, page: isKanban ? 1 : page, page_size: pageSize }),
    placeholderData: (prev) => prev,
  })

  function clearFilters() {
    setSearch('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setIncludeArchived(false)
    setPage(1)
  }

  function toggleSort(key: string) {
    setSort((prev) => (prev === key ? `-${key}` : prev === `-${key}` ? undefined : key))
    setPage(1)
  }

  async function handleExportCsv() {
    setIsExporting(true)
    try {
      const result = await fetcher({ ...filterParams, page: 1, page_size: EXPORT_PAGE_SIZE })
      const rows = [
        columns.map((c) => toCsvField(c.header)).join(','),
        ...result.items.map((row) => columns.map((c) => toCsvField(cellText(c, row))).join(',')),
      ]
      const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
        {onNew && (
          <button
            onClick={onNew}
            className="print:hidden inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <Plus size={16} /> {newLabel}
          </button>
        )}
      </div>

      <div className="print:hidden flex flex-wrap items-center gap-3">
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
        {statusFilter && (
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-2.5 py-2 text-sm text-[var(--color-ink-2)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            <option value="">{statusFilter.label ?? 'Status'}: All</option>
            {statusFilter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {dateRangeFilter && (
          <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink-3)]">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              title={`${dateRangeFilter.label ?? 'Date'} from`}
              className="rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-2 py-[7px] text-sm text-[var(--color-ink-2)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            <span>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              title={`${dateRangeFilter.label ?? 'Date'} to`}
              className="rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-2 py-[7px] text-sm text-[var(--color-ink-2)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
        )}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-[var(--color-ink-3)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-accent)]"
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {kanban && (
            <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-rule-2)] bg-[var(--color-paper-2)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-label="List view"
                title="List view"
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
                }`}
              >
                <ListIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                aria-label="Kanban view"
                title="Kanban view"
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting}
            title="Export the current search as CSV"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)] disabled:opacity-50"
          >
            <Download size={14} /> {isExporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            title="Print this list"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)]"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {isLoading && !data && (
        <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] px-4 py-10 text-center text-sm text-[var(--color-ink-3)] shadow-[var(--shadow-sm)]">
          Loading…
        </div>
      )}
      {isError && (
        <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] px-4 py-10 text-center text-sm text-[var(--color-danger)] shadow-[var(--shadow-sm)]">
          Could not load data.
        </div>
      )}

      {!isLoading && !isError && isKanban && kanban && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {kanban.columns.map((col) => {
            const rows = (data?.items ?? []).filter((row) => kanban.groupBy(row) === col.key)
            return (
              <div
                key={col.key}
                className="flex w-72 shrink-0 flex-col gap-3 rounded-xl border border-[var(--color-rule)] bg-[var(--color-paper-2)]/50 p-3"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    {col.label}
                  </span>
                  <span className="rounded-full bg-[var(--color-rule)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-2)]">
                    {rows.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {rows.length === 0 && (
                    <div className="py-6 text-center text-xs text-[var(--color-ink-3)]">Nothing here</div>
                  )}
                  {rows.map((row) => (
                    <div
                      key={rowKey(row)}
                      onClick={() => onRowClick?.(row)}
                      className={
                        onRowClick
                          ? 'cursor-pointer rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]'
                          : 'rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)]'
                      }
                    >
                      {kanban.renderCard(row)}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!isLoading && !isError && !isKanban && (
        <div className="print:shadow-none print:border-0 overflow-x-auto rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 text-left print:bg-transparent">
                {columns.map((col) => (
                  <th
                    key={col.header}
                    className="px-4 py-3 font-semibold text-[var(--color-ink-3)] text-[11px] uppercase tracking-wider"
                  >
                    {col.sortKey ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.sortKey as string)}
                        className="print:hidden inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
                      >
                        {col.header}
                        {sort === col.sortKey && <ChevronUp size={12} />}
                        {sort === `-${col.sortKey}` && <ChevronDown size={12} />}
                      </button>
                    ) : null}
                    <span className={col.sortKey ? 'hidden print:inline' : undefined}>{col.header}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
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
                      ? 'cursor-pointer border-b border-[var(--color-rule)] transition-colors last:border-0 hover:bg-[var(--color-accent-bg)]/50 print:hover:bg-transparent'
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
      )}

      {!isKanban && data && data.total_pages > 1 && (
        <div className="print:hidden flex items-center justify-between text-sm text-[var(--color-ink-2)]">
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
      {isKanban && data && data.total > data.items.length && (
        <p className="print:hidden text-xs text-[var(--color-ink-3)]">
          Showing {data.items.length} of {data.total} — narrow your search to see the rest on the board.
        </p>
      )}
    </div>
  )
}
