import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { Document, DocumentInput } from '../../types/document'

export async function listPurchaseOrders(params: ListParams): Promise<Page<Document>> {
  const resp = await apiClient.get<Page<Document>>('/purchase/orders', { params })
  return resp.data
}

export async function getPurchaseOrder(id: number): Promise<Document> {
  const resp = await apiClient.get<Document>(`/purchase/orders/${id}`)
  return resp.data
}

export async function createPurchaseOrder(input: DocumentInput): Promise<Document> {
  const resp = await apiClient.post<Document>('/purchase/orders', input)
  return resp.data
}

export async function updatePurchaseOrder(id: number, input: Partial<DocumentInput>): Promise<Document> {
  const resp = await apiClient.patch<Document>(`/purchase/orders/${id}`, input)
  return resp.data
}

export async function confirmPurchaseOrder(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/purchase/orders/${id}/confirm`)
  return resp.data
}

export async function cancelPurchaseOrder(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/purchase/orders/${id}/cancel`)
  return resp.data
}

export async function deletePurchaseOrder(id: number): Promise<void> {
  await apiClient.delete(`/purchase/orders/${id}`)
}

export async function createBillFromOrder(orderId: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/purchase/orders/${orderId}/create-bill`)
  return resp.data
}

export async function listVendorBills(params: ListParams): Promise<Page<Document>> {
  const resp = await apiClient.get<Page<Document>>('/purchase/bills', { params })
  return resp.data
}

export async function getVendorBill(id: number): Promise<Document> {
  const resp = await apiClient.get<Document>(`/purchase/bills/${id}`)
  return resp.data
}

export async function createVendorBill(input: DocumentInput): Promise<Document> {
  const resp = await apiClient.post<Document>('/purchase/bills', input)
  return resp.data
}

export async function updateVendorBill(id: number, input: Partial<DocumentInput>): Promise<Document> {
  const resp = await apiClient.patch<Document>(`/purchase/bills/${id}`, input)
  return resp.data
}

export async function postVendorBill(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/purchase/bills/${id}/post`)
  return resp.data
}

export async function cancelVendorBill(id: number): Promise<Document> {
  const resp = await apiClient.post<Document>(`/purchase/bills/${id}/cancel`)
  return resp.data
}

export async function sendVendorBillEmail(id: number, toEmail?: string): Promise<{ message: string }> {
  const resp = await apiClient.post<{ message: string }>(`/purchase/bills/${id}/send`, { to_email: toEmail })
  return resp.data
}

export async function deleteVendorBill(id: number): Promise<void> {
  await apiClient.delete(`/purchase/bills/${id}`)
}
