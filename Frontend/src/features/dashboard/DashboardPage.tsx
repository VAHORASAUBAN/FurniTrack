import { useQuery } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Inbox, RotateCcw, ShoppingCart, SlidersHorizontal, Target } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardSummary } from '../../api/endpoints/dashboard'
import { StatusPill } from '../../components/shared/StatusPill'
import { documentPath, DOC_TYPE_LABEL } from '../../lib/documentRoutes'
import { formatMoney } from '../../lib/money'
import { useDashboardPrefsStore, WIDGET_LABELS, type DashboardWidget } from '../../stores/dashboardPrefsStore'

function KpiTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ReactNode
  label: string
  value: string
  sub: string
  accent?: 'accent' | 'warning' | 'success'
}) {
  const tone = accent ?? 'accent'
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">{label}</span>
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            tone === 'warning'
              ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
              : tone === 'success'
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                : 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]'
          }`}
        >
          {icon}
        </span>
      </div>
      <div className="font-display text-2xl font-semibold tabular-nums text-[var(--color-ink)]">{value}</div>
      <div className="text-xs text-[var(--color-ink-3)]">{sub}</div>
    </div>
  )
}

const KPI_WIDGETS: DashboardWidget[] = [
  'kpi_receivable',
  'kpi_payable',
  'kpi_sales_orders',
  'kpi_purchase_orders',
  'kpi_budget_achieved',
]
const SECTION_WIDGETS: DashboardWidget[] = ['customer_invoices_breakdown', 'vendor_bills_breakdown', 'recent_activity']

function CustomizeMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isVisible = useDashboardPrefsStore((s) => s.isVisible)
  const toggle = useDashboardPrefsStore((s) => s.toggle)
  const resetToDefault = useDashboardPrefsStore((s) => s.resetToDefault)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)]"
      >
        <SlidersHorizontal size={14} /> Customize
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">KPI Cards</p>
          <div className="flex flex-col gap-1.5">
            {KPI_WIDGETS.map((w) => (
              <label key={w} className="flex items-center gap-2 text-sm text-[var(--color-ink)] select-none">
                <input
                  type="checkbox"
                  checked={isVisible(w)}
                  onChange={() => toggle(w)}
                  className="accent-[var(--color-accent)]"
                />
                {WIDGET_LABELS[w]}
              </label>
            ))}
          </div>
          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">Sections</p>
          <div className="flex flex-col gap-1.5">
            {SECTION_WIDGETS.map((w) => (
              <label key={w} className="flex items-center gap-2 text-sm text-[var(--color-ink)] select-none">
                <input
                  type="checkbox"
                  checked={isVisible(w)}
                  onChange={() => toggle(w)}
                  className="accent-[var(--color-accent)]"
                />
                {WIDGET_LABELS[w]}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={resetToDefault}
            className="mt-3 inline-flex items-center gap-1.5 border-t border-[var(--color-rule)] pt-2 text-sm text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
          >
            <RotateCcw size={13} /> Reset to default
          </button>
        </div>
      )}
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const isVisible = useDashboardPrefsStore((s) => s.isVisible)
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  })

  if (isLoading || !data) {
    return <div className="py-12 text-center text-sm text-[var(--color-ink-3)]">Loading…</div>
  }

  const budgetPct =
    Number.parseFloat(data.budgets.total_planned) === 0
      ? 0
      : Math.min(
          100,
          (Number.parseFloat(data.budgets.total_achieved) / Number.parseFloat(data.budgets.total_planned)) * 100
        )

  const anyKpiVisible = KPI_WIDGETS.some(isVisible)
  const anyBreakdownVisible = isVisible('customer_invoices_breakdown') || isVisible('vendor_bills_breakdown')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--color-ink)]">Dashboard</h1>
        <CustomizeMenu />
      </div>

      {anyKpiVisible && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {isVisible('kpi_receivable') && (
            <KpiTile
              icon={<ArrowDownCircle size={16} />}
              label="Receivable"
              value={formatMoney(data.customer_invoices.total_amount_due)}
              sub={`${data.customer_invoices.unpaid_count} unpaid · ${data.customer_invoices.partially_paid_count} partial`}
              accent="warning"
            />
          )}
          {isVisible('kpi_payable') && (
            <KpiTile
              icon={<ArrowUpCircle size={16} />}
              label="Payable"
              value={formatMoney(data.vendor_bills.total_amount_due)}
              sub={`${data.vendor_bills.unpaid_count} unpaid · ${data.vendor_bills.partially_paid_count} partial`}
              accent="warning"
            />
          )}
          {isVisible('kpi_sales_orders') && (
            <KpiTile
              icon={<ShoppingCart size={16} />}
              label="Sales Orders"
              value={String(data.sales_orders.confirmed)}
              sub={`confirmed · ${data.sales_orders.draft} draft`}
            />
          )}
          {isVisible('kpi_purchase_orders') && (
            <KpiTile
              icon={<Inbox size={16} />}
              label="Purchase Orders"
              value={String(data.purchase_orders.confirmed)}
              sub={`confirmed · ${data.purchase_orders.draft} draft`}
            />
          )}
          {isVisible('kpi_budget_achieved') && (
            <KpiTile
              icon={<Target size={16} />}
              label="Budget Achieved"
              value={`${budgetPct.toFixed(0)}%`}
              sub={`${data.budgets.active_count} active budget${data.budgets.active_count === 1 ? '' : 's'}`}
              accent="success"
            />
          )}
        </div>
      )}

      {anyBreakdownVisible && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {isVisible('customer_invoices_breakdown') && (
            <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
              <h2 className="mb-3 font-display text-sm font-semibold text-[var(--color-ink)]">Customer Invoices</h2>
              <StatusBreakdown
                rows={[
                  ['Unpaid', data.customer_invoices.unpaid_count, 'var(--color-warning)'],
                  ['Partially paid', data.customer_invoices.partially_paid_count, 'var(--color-warning)'],
                  ['Paid', data.customer_invoices.paid_count, 'var(--color-success)'],
                  ['Draft', data.customer_invoices.draft_count, 'var(--color-ink-3)'],
                ]}
              />
            </div>
          )}
          {isVisible('vendor_bills_breakdown') && (
            <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
              <h2 className="mb-3 font-display text-sm font-semibold text-[var(--color-ink)]">Vendor Bills</h2>
              <StatusBreakdown
                rows={[
                  ['Unpaid', data.vendor_bills.unpaid_count, 'var(--color-warning)'],
                  ['Partially paid', data.vendor_bills.partially_paid_count, 'var(--color-warning)'],
                  ['Paid', data.vendor_bills.paid_count, 'var(--color-success)'],
                  ['Draft', data.vendor_bills.draft_count, 'var(--color-ink-3)'],
                ]}
              />
            </div>
          )}
        </div>
      )}

      {isVisible('recent_activity') && (
        <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
          <h2 className="border-b border-[var(--color-rule)] px-5 py-3 font-display text-sm font-semibold text-[var(--color-ink)]">
            Recent Activity
          </h2>
          {data.recent_documents.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--color-ink-3)]">Nothing posted yet.</div>
          ) : (
            <div>
              {data.recent_documents.map((doc) => (
                <div
                  key={`${doc.doc_type}-${doc.id}`}
                  onClick={() => navigate(documentPath(doc.doc_type, doc.id))}
                  className="flex cursor-pointer items-center justify-between border-b border-[var(--color-rule)] px-5 py-3 last:border-0 hover:bg-[var(--color-accent-bg)]/50"
                >
                  <div>
                    <div className="text-sm font-medium text-[var(--color-ink)]">{doc.doc_number}</div>
                    <div className="text-xs text-[var(--color-ink-3)]">
                      {DOC_TYPE_LABEL[doc.doc_type]} · {doc.partner_name} · {doc.doc_date}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-[var(--color-ink)]">{formatMoney(doc.total_amount)}</span>
                    <StatusPill status={doc.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!anyKpiVisible && !anyBreakdownVisible && !isVisible('recent_activity') && (
        <div className="rounded-xl border border-dashed border-[var(--color-rule-2)] px-5 py-14 text-center text-sm text-[var(--color-ink-3)]">
          Everything's hidden — use Customize above to bring sections back.
        </div>
      )}
    </div>
  )
}

function StatusBreakdown({ rows }: { rows: [string, number, string][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(([label, count, color]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-xs text-[var(--color-ink-2)]">{label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-rule)]">
            <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, backgroundColor: color }} />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-xs text-[var(--color-ink-2)]">{count}</span>
        </div>
      ))}
    </div>
  )
}
