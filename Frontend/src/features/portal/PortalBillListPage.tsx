import { useNavigate } from 'react-router-dom'
import { listMyBills } from '../../api/endpoints/portal'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Document } from '../../types/document'

/** The vendor's side of the portal's "invoices/bills" screen — read-only,
 * scoped server-side to the logged-in contact. No Pay action here: a
 * vendor doesn't settle their own bill, the staff side does that. */
export function PortalBillListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Document>
      title="My Bills"
      queryKey="my-bills"
      fetcher={listMyBills}
      rowKey={(d) => d.id}
      onRowClick={(d) => navigate(`/portal/bills/${d.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by bill number or reference…"
      columns={[
        { header: 'Bill No.', accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
        { header: 'Date', accessor: (d) => d.doc_date },
        { header: 'Due Date', accessor: (d) => d.due_date ?? '—' },
        { header: 'Total', accessor: (d) => formatMoney(d.total_amount), className: 'text-right font-mono' },
        { header: 'Amount Due', accessor: (d) => formatMoney(d.balance?.amount_due), className: 'text-right font-mono' },
        {
          header: 'Status',
          accessor: (d) => <StatusPill status={d.balance?.payment_status === 'PAID' ? 'PAID' : d.status} />,
        },
      ]}
    />
  )
}
