export type ProductType = 'GOODS' | 'SERVICE' | 'COMBO'

export interface ProductCategory {
  id: number
  name: string
  is_active: boolean
}

export interface Product {
  id: number
  name: string
  product_type: ProductType
  category_id: number | null
  category: ProductCategory | null
  sales_price: string
  purchase_cost: string
  default_tax_rate: string
  income_account_id: number | null
  expense_account_id: number | null
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ProductInput {
  name: string
  product_type: ProductType
  category_id?: number | null
  sales_price?: string
  purchase_cost?: string
  default_tax_rate?: string
  income_account_id?: number | null
  expense_account_id?: number | null
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  GOODS: 'Goods',
  SERVICE: 'Service',
  COMBO: 'Combo',
}
