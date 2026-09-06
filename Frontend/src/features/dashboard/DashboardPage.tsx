import { useQuery } from '@tanstack/react-query'
import { ArrowDownCircle, ArrowUpCircle, Inbox, RotateCcw, ShoppingCart, SlidersHorizontal, Target } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { listBudgets } from '../../api/endpoints/budgets'
import { getDashboardSummary } from '../../api/endpoints/dashboard'
import { listCustomerInvoices, listSalesOrders } from '../../api/endpoints/sales'
import { listPurchaseOrders, listVendorBills } from '../../api/endpoints/purchase'
import { DashboardDetailModal, type DetailColumn } from '../../components/shared/DashboardDetailModal'
import { StatusPill } from '../../components/shared/StatusPill'
import { useFloatingMenu } from '../../hooks/useFloatingMenu'
import { documentPath, DOC_TYPE_LABEL } from '../../lib/documentRoutes'
import { formatMoney } from '../../lib/money'
import { relativeTime } from '../../lib/time'
import { useDashboardPrefsStore, WIDGET_LABELS, type DashboardWidget } from '../../stores/dashboardPrefsStore'
import type { Budget } from '../../types/budget'
import type { Document } from '../../types/document'

type DetailKind = 'customer_invoices' | 'vendor_bills' | 'sales_orders' | 'purchase_orders' | 'budgets'
type PaymentFilter = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'DRAFT' | null
interface DetailView {
  kind: DetailKind
  filter: PaymentFilter
}

const DOC_COLUMNS: DetailColumn<Document>[] = [
  { header: 'Doc No.', render: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
  { header: 'Date', render: (d) => d.doc_date },
  {
    header: 'Total', className: 'text-right font-mono', render: (d) => formatMoney(d.total_amount),
  },
  {
    header: 'Status',
    render: (d) => <StatusPill status={d.balance?.payment_status === 'PAID' ? 'PAID' : d.status} />,
  },
]

const BUDGET_COLUMNS: DetailColumn<Budget>[] = [
  { header: 'Name', render: (b) => b.name },
  { header: 'Period', render: (b) => `${b.start_date} → ${b.end_date}` },
  {
    header: 'Achieved',
    className: 'text-right font-mono',
    render: (b) => {
      const planned = b.lines.reduce((sum, l) => sum + Number(l.planned_amount), 0)
      const achieved = b.lines.reduce((sum, l) => sum + Number(l.achieved_amount), 0)
      return planned === 0 ? '—' : `${((achieved / planned) * 100).toFixed(0)}%`
    },
  },
]

const PAYMENT_FILTER_LABEL: Record<Exclude<PaymentFilter, null>, string> = {
  UNPAID: 'unpaid', PARTIALLY_PAID: 'partially paid', PAID: 'paid', DRAFT: 'draft',
}

function KpiTile({
  icon,
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: string
  sub: string
  accent?: 'accent' | 'warning' | 'success'
  onClick?: () => void
}) {
  const tone = accent ?? 'accent'
  return (
    <div
      onClick={onClick}
      title={onClick ? 'Click for details' : undefined}
      className={`flex flex-col gap-3 rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)] transition-shadow ${onClick ? 'cursor-pointer hover:shadow-[var(--shadow-md)]' : ''}`}
    >
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
  const { triggerRef, menuRef, menuPosition } = useFloatingMenu({ open, onClose: () => setOpen(false), align: 'right' })
  const hidden = useDashboardPrefsStore((s) => s.hidden)
  const toggle = useDashboardPrefsStore((s) => s.toggle)
  const resetToDefault = useDashboardPrefsStore((s) => s.resetToDefault)
  const isVisible = (w: DashboardWidget) => !hidden.includes(w)

  return (
    <div ref={triggerRef} className="relative print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)]"
      >
        <SlidersHorizontal size={14} /> Customize
      </button>

      {open &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPosition.top, right: menuPosition.right }}
            className="z-[60] w-64 rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] p-3 shadow-lg"
          >
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
          </div>,
          document.body
        )}
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const hidden = useDashboardPrefsStore((s) => s.hidden)
  const isVisible = (w: DashboardWidget) => !hidden.includes(w)
  const [detailView, setDetailView] = useState<DetailView | null>(null)
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
              onClick={() => setDetailView({ kind: 'customer_invoices', filter: null })}
            />
          )}
          {isVisible('kpi_payable') && (
            <KpiTile
              icon={<ArrowUpCircle size={16} />}
              label="Payable"
              value={formatMoney(data.vendor_bills.total_amount_due)}
              sub={`${data.vendor_bills.unpaid_count} unpaid · ${data.vendor_bills.partially_paid_count} partial`}
              accent="warning"
              onClick={() => setDetailView({ kind: 'vendor_bills', filter: null })}
            />
          )}
          {isVisible('kpi_sales_orders') && (
            <KpiTile
              icon={<ShoppingCart size={16} />}
              label="Sales Orders"
              value={String(data.sales_orders.confirmed)}
              sub={`confirmed · ${data.sales_orders.draft} draft`}
              onClick={() => setDetailView({ kind: 'sales_orders', filter: null })}
            />
          )}
          {isVisible('kpi_purchase_orders') && (
            <KpiTile
              icon={<Inbox size={16} />}
              label="Purchase Orders"
              value={String(data.purchase_orders.confirmed)}
              sub={`confirmed · ${data.purchase_orders.draft} draft`}
              onClick={() => setDetailView({ kind: 'purchase_orders', filter: null })}
            />
          )}
          {isVisible('kpi_budget_achieved') && (
            <KpiTile
              icon={<Target size={16} />}
              label="Budget Achieved"
              value={`${budgetPct.toFixed(0)}%`}
              sub={`${data.budgets.active_count} active budget${data.budgets.active_count === 1 ? '' : 's'}`}
              accent="success"
              onClick={() => setDetailView({ kind: 'budgets', filter: null })}
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
                  ['Unpaid', data.customer_invoices.unpaid_count, 'var(--color-warning)', 'UNPAID'],
                  ['Partially paid', data.customer_invoices.partially_paid_count, 'var(--color-warning)', 'PARTIALLY_PAID'],
                  ['Paid', data.customer_invoices.paid_count, 'var(--color-success)', 'PAID'],
                  ['Draft', data.customer_invoices.draft_count, 'var(--color-ink-3)', 'DRAFT'],
                ]}
                onRowClick={(filter) => setDetailView({ kind: 'customer_invoices', filter })}
              />
            </div>
          )}
          {isVisible('vendor_bills_breakdown') && (
            <div className="rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-sm)]">
              <h2 className="mb-3 font-display text-sm font-semibold text-[var(--color-ink)]">Vendor Bills</h2>
              <StatusBreakdown
                rows={[
                  ['Unpaid', data.vendor_bills.unpaid_count, 'var(--color-warning)', 'UNPAID'],
                  ['Partially paid', data.vendor_bills.partially_paid_count, 'var(--color-warning)', 'PARTIALLY_PAID'],
                  ['Paid', data.vendor_bills.paid_count, 'var(--color-success)', 'PAID'],
                  ['Draft', data.vendor_bills.draft_count, 'var(--color-ink-3)', 'DRAFT'],
                ]}
                onRowClick={(filter) => setDetailView({ kind: 'vendor_bills', filter })}
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
                    <span className="w-16 shrink-0 text-right text-xs text-[var(--color-ink-3)]">
                      {relativeTime(doc.updated_at)}
                    </span>
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

      {detailView && (detailView.kind === 'customer_invoices' || detailView.kind === 'vendor_bills') && (
        <DashboardDetailModal<Document>
          title={detailView.kind === 'customer_invoices' ? 'Customer Invoices' : 'Vendor Bills'}
          subtitle={
            detailView.filter
              ? `Showing ${PAYMENT_FILTER_LABEL[detailView.filter]} ${detailView.kind === 'customer_invoices' ? 'invoices' : 'bills'}`
              : 'Unpaid and partially paid, most recently updated first'
          }
          queryKey={`${detailView.kind}-${detailView.filter ?? 'all'}`}
          fetcher={async () => {
            const list = detailView.kind === 'customer_invoices' ? listCustomerInvoices : listVendorBills
            const page = await list({
              page: 1, page_size: 50, sort: '-updated_at',
              status: detailView.filter === 'DRAFT' ? 'DRAFT' : 'POSTED',
            })
            if (detailView.filter === null) return page.items.filter((d) => d.balance?.payment_status !== 'PAID')
            if (detailView.filter === 'DRAFT') return page.items
            return page.items.filter((d) => d.balance?.payment_status === detailView.filter)
          }}
          columns={DOC_COLUMNS}
          rowKey={(d) => d.id}
          onRowClick={(d) => {
            setDetailView(null)
            navigate(documentPath(d.doc_type, d.id))
          }}
          emptyMessage="Nothing matches this status right now."
          onClose={() => setDetailView(null)}
        />
      )}

      {detailView && (detailView.kind === 'sales_orders' || detailView.kind === 'purchase_orders') && (
        <DashboardDetailModal<Document>
          title={detailView.kind === 'sales_orders' ? 'Sales Orders' : 'Purchase Orders'}
          subtitle="Most recently updated first"
          queryKey={detailView.kind}
          fetcher={async () => {
            const list = detailView.kind === 'sales_orders' ? listSalesOrders : listPurchaseOrders
            const page = await list({ page: 1, page_size: 50, sort: '-updated_at' })
            return page.items
          }}
          columns={DOC_COLUMNS}
          rowKey={(d) => d.id}
          onRowClick={(d) => {
            setDetailView(null)
            navigate(documentPath(d.doc_type, d.id))
          }}
          onClose={() => setDetailView(null)}
        />
      )}

      {detailView && detailView.kind === 'budgets' && (
        <DashboardDetailModal<Budget>
          title="Active Budgets"
          subtitle="Confirmed budgets, most recently updated first"
          queryKey="budgets"
          fetcher={async () => {
            const page = await listBudgets({ page: 1, page_size: 50, sort: '-updated_at', status: 'CONFIRMED' })
            return page.items
          }}
          columns={BUDGET_COLUMNS}
          rowKey={(b) => b.id}
          onRowClick={(b) => {
            setDetailView(null)
            navigate(`/budgets/${b.id}`)
          }}
          emptyMessage="No confirmed budgets yet."
          onClose={() => setDetailView(null)}
        />
      )}
    </div>
  )
}

function StatusBreakdown({
  rows,
  onRowClick,
}: {
  rows: [string, number, string, PaymentFilter][]
  onRowClick?: (filter: PaymentFilter) => void
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map(([label, count, color, filter]) => (
        <div
          key={label}
          onClick={onRowClick ? () => onRowClick(filter) : undefined}
          className={`flex items-center gap-3 rounded-md ${onRowClick ? 'cursor-pointer hover:bg-[var(--color-paper-2)]' : ''}`}
        >
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
