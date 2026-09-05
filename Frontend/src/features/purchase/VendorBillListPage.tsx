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
        { header: 'Bill No.', accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
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
