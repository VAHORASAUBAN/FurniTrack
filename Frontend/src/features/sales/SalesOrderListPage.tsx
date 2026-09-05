import { useNavigate } from 'react-router-dom'
import { listSalesOrders } from '../../api/endpoints/sales'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Document } from '../../types/document'

export function SalesOrderListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Document>
      title="Sales Orders"
      queryKey="sales-orders"
      fetcher={listSalesOrders}
      rowKey={(d) => d.id}
      onNew={() => navigate('/sales/orders/new')}
      onRowClick={(d) => navigate(`/sales/orders/${d.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by SO number or reference…"
      columns={[
        {
          header: 'SO No.', sortKey: 'doc_number', csvValue: (d) => d.doc_number,
          accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span>,
        },
        { header: 'Date', sortKey: 'doc_date', accessor: (d) => d.doc_date },
        { header: 'Total', accessor: (d) => formatMoney(d.total_amount), className: 'text-right font-mono' },
        {
          header: 'Status', sortKey: 'status', csvValue: (d) => d.status,
          accessor: (d) => <StatusPill status={d.status} />,
        },
      ]}
      kanban={{
        groupBy: (d) => d.status,
        columns: [
          { key: 'DRAFT', label: 'Draft' },
          { key: 'CONFIRMED', label: 'Confirmed' },
          { key: 'CANCELLED', label: 'Cancelled' },
        ],
        renderCard: (d) => (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium text-[var(--color-ink)]">{d.doc_number}</span>
            <span className="text-xs text-[var(--color-ink-3)]">{d.doc_date}</span>
            <span className="font-mono text-xs text-[var(--color-ink-2)]">{formatMoney(d.total_amount)}</span>
          </div>
        ),
      }}
    />
  )
}
