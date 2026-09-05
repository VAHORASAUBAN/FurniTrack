import { useNavigate } from 'react-router-dom'
import { listMyInvoices } from '../../api/endpoints/portal'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Document } from '../../types/document'

/** The wireframe's Portal Dashboard: "can only see his invoices/bills in
 * paid/unpaid status and can directly pay his dues from portal" — this
 * list IS that screen, scoped server-side to the logged-in contact. */
export function PortalInvoiceListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Document>
      title="My Invoices"
      queryKey="my-invoices"
      fetcher={listMyInvoices}
      rowKey={(d) => d.id}
      onRowClick={(d) => navigate(`/portal/invoices/${d.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by invoice number or reference…"
      columns={[
        { header: 'Invoice No.', accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
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
