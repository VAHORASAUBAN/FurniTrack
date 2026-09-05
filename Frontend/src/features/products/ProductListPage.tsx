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
        {
          header: 'Name', sortKey: 'name', csvValue: (p) => p.name,
          accessor: (p) => <span className="font-medium">{p.name}</span>,
        },
        { header: 'Category', accessor: (p) => p.category?.name ?? '—' },
        { header: 'Type', sortKey: 'product_type', accessor: (p) => PRODUCT_TYPE_LABELS[p.product_type] },
        { header: 'Sales Price', accessor: (p) => formatMoney(p.sales_price), className: 'text-right font-mono' },
        { header: 'Cost', accessor: (p) => formatMoney(p.purchase_cost), className: 'text-right font-mono' },
        {
          header: 'Status', csvValue: (p) => (p.is_active ? 'Active' : 'Archived'),
          accessor: (p) => <StatusPill status={p.is_active ? 'ACTIVE' : 'ARCHIVED'} />,
        },
      ]}
      kanban={{
        groupBy: (p) => p.product_type,
        columns: [
          { key: 'GOODS', label: 'Goods' },
          { key: 'SERVICE', label: 'Service' },
          { key: 'COMBO', label: 'Combo' },
        ],
        renderCard: (p) => (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--color-ink)]">{p.name}</span>
            <span className="text-xs text-[var(--color-ink-3)]">{p.category?.name ?? 'No category'}</span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[var(--color-ink-2)]">{formatMoney(p.sales_price)}</span>
              {!p.is_active && <StatusPill status="ARCHIVED" />}
            </div>
          </div>
        ),
      }}
    />
  )
}
