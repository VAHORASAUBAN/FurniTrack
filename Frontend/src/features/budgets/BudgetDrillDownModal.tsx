import { useQuery } from '@tanstack/react-query'
import { Inbox, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getBudgetDrillDown } from '../../api/endpoints/reports'
import { documentPath, DOC_TYPE_LABEL } from '../../lib/documentRoutes'
import { formatMoney } from '../../lib/money'

interface BudgetDrillDownModalProps {
  analyticId: number
  analyticName: string
  /** Omit both for all-time traceability (the Analytic Account page's own
   * "what's tracked under this account" view) rather than one budget's period. */
  dateFrom?: string
  dateTo?: string
  onClose: () => void
}

/** Design doc §4.3/§8.4 — clicking a budget line's Achieved figure, or an
 * analytic account's own traceability view, opens every posted journal
 * line tagged with it. A Bill/Invoice/PO/SO-sourced line links back to its
 * document; a manual entry (no source document) links to the journal
 * entry itself instead, rather than being silently excluded. */
export function BudgetDrillDownModal({ analyticId, analyticName, dateFrom, dateTo, onClose }: BudgetDrillDownModalProps) {
  const navigate = useNavigate()

  const { data: items, isLoading } = useQuery({
    queryKey: ['budget-drill-down', analyticId, dateFrom, dateTo],
    queryFn: () => getBudgetDrillDown(analyticId, dateFrom, dateTo),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--color-ink)]">{analyticName}</h2>
            <p className="mt-0.5 text-xs text-[var(--color-ink-3)]">
              {dateFrom && dateTo
                ? `Posted activity behind this figure, ${dateFrom} → ${dateTo}`
                : 'Every posted transaction tagged with this account'}
            </p>
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
            <p className="text-sm text-[var(--color-ink-3)]">No posted activity tagged with this account yet.</p>
          </div>
        )}

        {!isLoading && items && items.length > 0 && (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[var(--color-rule)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]/60 text-left">
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Source
                  </th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Partner
                  </th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Date
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Debit
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.line_id}
                    onClick={() => {
                      onClose()
                      if (item.document_id && item.doc_type) navigate(documentPath(item.doc_type, item.document_id))
                      else navigate(`/journal-entries/${item.entry_id}`)
                    }}
                    className="cursor-pointer border-b border-[var(--color-rule)] last:border-0 hover:bg-[var(--color-accent-bg)]/50"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--color-ink)]">{item.doc_number ?? item.entry_number}</div>
                      <div className="text-xs text-[var(--color-ink-3)]">
                        {item.doc_type ? DOC_TYPE_LABEL[item.doc_type] : `Manual Entry${item.label ? ` · ${item.label}` : ''}`}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--color-ink-2)]">{item.partner_name ?? '—'}</td>
                    <td className="px-3 py-2 text-[var(--color-ink-2)]">{item.entry_date}</td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--color-ink)]">
                      {Number(item.debit) > 0 ? formatMoney(item.debit) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[var(--color-ink)]">
                      {Number(item.credit) > 0 ? formatMoney(item.credit) : '—'}
                    </td>
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
