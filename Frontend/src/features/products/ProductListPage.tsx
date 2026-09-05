import { Boxes } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { API_ORIGIN } from '../../api/client'
import { listProducts } from '../../api/endpoints/products'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import { PRODUCT_TYPE_LABELS, type Product } from '../../types/product'

function ProductThumb({ product, size }: { product: Product; size: number }) {
  return product.image_url ? (
    <img
      src={`${API_ORIGIN}${product.image_url}`}
      alt=""
      style={{ height: size, width: size }}
      className="shrink-0 rounded-md object-cover"
    />
  ) : (
    <div
      style={{ height: size, width: size }}
      className="flex shrink-0 items-center justify-center rounded-md bg-[var(--color-accent-bg)] text-[var(--color-accent)]"
    >
      <Boxes size={size * 0.55} />
    </div>
  )
}

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
          accessor: (p) => (
            <div className="flex items-center gap-2.5">
              <ProductThumb product={p} size={28} />
              <span className="font-medium">{p.name}</span>
            </div>
          ),
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
            <div className="flex items-center gap-2">
              <ProductThumb product={p} size={24} />
              <span className="text-sm font-medium text-[var(--color-ink)]">{p.name}</span>
            </div>
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
