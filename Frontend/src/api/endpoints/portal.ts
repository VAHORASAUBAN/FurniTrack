import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { Document } from '../../types/document'
import type { Payment, PaymentMethod } from '../../types/payment'

export async function listMyInvoices(params: ListParams): Promise<Page<Document>> {
  const resp = await apiClient.get<Page<Document>>('/portal/invoices', { params })
  return resp.data
}

export async function getMyInvoice(id: number): Promise<Document> {
  const resp = await apiClient.get<Document>(`/portal/invoices/${id}`)
  return resp.data
}

export interface PortalPayInput {
  method: PaymentMethod
  amount: string
  payment_date: string
}

export async function payMyInvoice(id: number, input: PortalPayInput): Promise<Payment> {
  const resp = await apiClient.post<Payment>(`/portal/invoices/${id}/pay`, input)
  return resp.data
}

// A vendor's side of the portal — read-only, no pay endpoint (a vendor
// doesn't settle their own bill; the staff side does that).
export async function listMyBills(params: ListParams): Promise<Page<Document>> {
  const resp = await apiClient.get<Page<Document>>('/portal/bills', { params })
  return resp.data
}

export async function getMyBill(id: number): Promise<Document> {
  const resp = await apiClient.get<Document>(`/portal/bills/${id}`)
  return resp.data
}
