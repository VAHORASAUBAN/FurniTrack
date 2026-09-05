import { apiClient } from '../client'
import type { Many2OneOption } from '../../components/shared/Many2OneSelect'
import type { ListParams, Page } from '../../types/api'
import type { Product, ProductCategory, ProductInput } from '../../types/product'

export async function listProducts(params: ListParams): Promise<Page<Product>> {
  const resp = await apiClient.get<Page<Product>>('/products', { params })
  return resp.data
}

export async function getProduct(id: number): Promise<Product> {
  const resp = await apiClient.get<Product>(`/products/${id}`)
  return resp.data
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const resp = await apiClient.post<Product>('/products', input)
  return resp.data
}

export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const resp = await apiClient.patch<Product>(`/products/${id}`, input)
  return resp.data
}

export async function archiveProduct(id: number): Promise<Product> {
  const resp = await apiClient.post<Product>(`/products/${id}/archive`)
  return resp.data
}

export async function unarchiveProduct(id: number): Promise<Product> {
  const resp = await apiClient.post<Product>(`/products/${id}/unarchive`)
  return resp.data
}

export async function listProductCategories(search: string): Promise<ProductCategory[]> {
  const resp = await apiClient.get<Page<ProductCategory>>('/product-categories', { params: { search, page_size: 25 } })
  return resp.data.items
}

export async function createProductCategory(name: string): Promise<ProductCategory> {
  const resp = await apiClient.post<ProductCategory>('/product-categories', { name })
  return resp.data
}

export async function productCategoryOptions(search: string): Promise<Many2OneOption[]> {
  const categories = await listProductCategories(search)
  return categories.map((c) => ({ id: c.id, label: c.name }))
}

export async function productOptions(search: string): Promise<Many2OneOption[]> {
  const page = await listProducts({ search, page_size: 25 })
  return page.items.map((p) => ({ id: p.id, label: p.name }))
}
