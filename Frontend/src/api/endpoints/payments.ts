import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { DocumentOutstanding, Payment, PaymentInput, PaymentType } from '../../types/payment'

export async function listPayments(params: ListParams & { payment_type?: PaymentType }): Promise<Page<Payment>> {
  const resp = await apiClient.get<Page<Payment>>('/payments', { params })
  return resp.data
}

export async function getPayment(id: number): Promise<Payment> {
  const resp = await apiClient.get<Payment>(`/payments/${id}`)
  return resp.data
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  const resp = await apiClient.post<Payment>('/payments', input)
  return resp.data
}

export async function cancelPayment(id: number): Promise<Payment> {
  const resp = await apiClient.post<Payment>(`/payments/${id}/cancel`)
  return resp.data
}

export async function getDocumentOutstanding(documentId: number): Promise<DocumentOutstanding> {
  const resp = await apiClient.get<DocumentOutstanding>(`/payments/documents/${documentId}/outstanding`)
  return resp.data
}
