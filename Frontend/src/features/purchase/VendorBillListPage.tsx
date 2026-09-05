import { useNavigate } from 'react-router-dom'
import { listVendorBills } from '../../api/endpoints/purchase'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Document } from '../../types/document'

export function VendorBillListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Document>
      title="Vendor Bills"
      queryKey="vendor-bills"
      fetcher={listVendorBills}
      rowKey={(d) => d.id}
      onNew={() => navigate('/purchase/bills/new')}
      onRowClick={(d) => navigate(`/purchase/bills/${d.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by bill number or reference…"
      columns={[
        {
          header: 'Bill No.', sortKey: 'doc_number', csvValue: (d) => d.doc_number,
          accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span>,
        },
        { header: 'Due Date', accessor: (d) => d.due_date ?? '—' },
        { header: 'Total', accessor: (d) => formatMoney(d.total_amount), className: 'text-right font-mono' },
        { header: 'Amount Due', accessor: (d) => formatMoney(d.balance?.amount_due), className: 'text-right font-mono' },
        {
          header: 'Status',
          sortKey: 'status',
          csvValue: (d) => (d.balance?.payment_status === 'PAID' ? 'PAID' : d.status),
          accessor: (d) => <StatusPill status={d.balance?.payment_status === 'PAID' ? 'PAID' : d.status} />,
        },
      ]}
      kanban={{
        groupBy: (d) => (d.status === 'POSTED' ? d.balance?.payment_status ?? 'UNPAID' : d.status),
        columns: [
          { key: 'DRAFT', label: 'Draft' },
          { key: 'UNPAID', label: 'Unpaid' },
          { key: 'PARTIALLY_PAID', label: 'Partially Paid' },
          { key: 'PAID', label: 'Paid' },
          { key: 'CANCELLED', label: 'Cancelled' },
        ],
        renderCard: (d) => (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs font-medium text-[var(--color-ink)]">{d.doc_number}</span>
            <span className="text-xs text-[var(--color-ink-3)]">Due {d.due_date ?? '—'}</span>
            <span className="font-mono text-xs text-[var(--color-ink-2)]">
              {d.balance?.payment_status === 'PAID' ? formatMoney(d.total_amount) : formatMoney(d.balance?.amount_due)}
            </span>
          </div>
        ),
      }}
    />
  )
}
