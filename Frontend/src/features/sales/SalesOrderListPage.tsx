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
        { header: 'SO No.', accessor: (d) => <span className="font-mono text-xs">{d.doc_number}</span> },
        { header: 'Date', accessor: (d) => d.doc_date },
        { header: 'Total', accessor: (d) => formatMoney(d.total_amount), className: 'text-right font-mono' },
        { header: 'Status', accessor: (d) => <StatusPill status={d.status} /> },
      ]}
    />
  )
}
