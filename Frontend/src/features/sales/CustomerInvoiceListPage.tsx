import { useNavigate } from 'react-router-dom'
import { listCustomerInvoices } from '../../api/endpoints/sales'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Document } from '../../types/document'

export function CustomerInvoiceListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Document>
      title="Customer Invoices"
      queryKey="customer-invoices"
      fetcher={listCustomerInvoices}
      rowKey={(d) => d.id}
      onNew={() => navigate('/sales/invoices/new')}
      onRowClick={(d) => navigate(`/sales/invoices/${d.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by invoice number or reference…"
      columns={[
        { header: 'Invoice No.', accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
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
