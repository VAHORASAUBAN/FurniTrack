import { useNavigate } from 'react-router-dom'
import { listProducts } from '../../api/endpoints/products'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import { PRODUCT_TYPE_LABELS, type Product } from '../../types/product'

export function ProductListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Product>
      title="Products"
      queryKey="products"
      fetcher={listProducts}
      rowKey={(p) => p.id}
      onNew={() => navigate('/products/new')}
      onRowClick={(p) => navigate(`/products/${p.id}`)}
      columns={[
        { header: 'Name', accessor: (p) => <span className="font-medium">{p.name}</span> },
        { header: 'Category', accessor: (p) => p.category?.name ?? '—' },
        { header: 'Type', accessor: (p) => PRODUCT_TYPE_LABELS[p.product_type] },
        { header: 'Sales Price', accessor: (p) => formatMoney(p.sales_price), className: 'text-right font-mono' },
        { header: 'Cost', accessor: (p) => formatMoney(p.purchase_cost), className: 'text-right font-mono' },
        { header: 'Status', accessor: (p) => <StatusPill status={p.is_active ? 'ACTIVE' : 'ARCHIVED'} /> },
      ]}
    />
  )
}
