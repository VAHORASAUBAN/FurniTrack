import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { Document, DocumentInput } from '../../types/document'

export async function listSalesOrders(params: ListParams): Promise<Page<Document>> {
  const resp = await apiClient.get<Page<Document>>('/sales/orders', { params })
  return resp.data
}

export async function getSalesOrder(id: number): Promise<Document> {
  const resp = await apiClient.get<Document>(`/sales/orders/${id}`)
  return resp.data
}

export async function createSalesOrder(input: DocumentInput): Promise<Document> {
  const resp = await apiClient.post<Document>('/sales/orders', input)
  return resp.data
}

export async function updateSalesOrder(id: number, input: Partial<DocumentInput>): Promise<Document> {
  const resp = await apiClient.patch<Document>(`/sales/orders/${id}`, input)
  return resp.data
}

export async function confirmSalesOrder(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/sales/orders/${id}/confirm`)
  return resp.data
}

export async function cancelSalesOrder(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/sales/orders/${id}/cancel`)
  return resp.data
}

export async function createInvoiceFromOrder(orderId: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/sales/orders/${orderId}/create-invoice`)
  return resp.data
}

export async function listCustomerInvoices(params: ListParams): Promise<Page<Document>> {
  const resp = await apiClient.get<Page<Document>>('/sales/invoices', { params })
  return resp.data
}

export async function getCustomerInvoice(id: number): Promise<Document> {
  const resp = await apiClient.get<Document>(`/sales/invoices/${id}`)
  return resp.data
}

export async function createCustomerInvoice(input: DocumentInput): Promise<Document> {
  const resp = await apiClient.post<Document>('/sales/invoices', input)
  return resp.data
}

export async function updateCustomerInvoice(id: number, input: Partial<DocumentInput>): Promise<Document> {
  const resp = await apiClient.patch<Document>(`/sales/invoices/${id}`, input)
  return resp.data
}

export async function postCustomerInvoice(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/sales/invoices/${id}/post`)
  return resp.data
}

export async function cancelCustomerInvoice(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/sales/invoices/${id}/cancel`)
  return resp.data
}

export async function sendCustomerInvoiceEmail(id: number, toEmail?: string): Promise<{ message: string }> {
  const resp = await apiClient.post<{ message: string }>(`/sales/invoices/${id}/send`, { to_email: toEmail })
  return resp.data
}
