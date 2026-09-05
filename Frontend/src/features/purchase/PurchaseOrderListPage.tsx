import { useNavigate } from 'react-router-dom'
import { listPurchaseOrders } from '../../api/endpoints/purchase'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Document } from '../../types/document'

export function PurchaseOrderListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Document>
      title="Purchase Orders"
      queryKey="purchase-orders"
      fetcher={listPurchaseOrders}
      rowKey={(d) => d.id}
      onNew={() => navigate('/purchase/orders/new')}
      onRowClick={(d) => navigate(`/purchase/orders/${d.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by PO number or reference…"
      columns={[
        { header: 'PO No.', accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
        { header: 'Date', accessor: (d) => d.doc_date },
        { header: 'Total', accessor: (d) => formatMoney(d.total_amount), className: 'text-right font-mono' },
        { header: 'Status', accessor: (d) => <StatusPill status={d.status} /> },
      ]}
    />
  )
}
