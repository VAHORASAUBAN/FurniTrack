import { apiClient } from '../client'
import type { Page, ListParams } from '../../types/api'
import type { Contact, ContactCreateResponse, ContactInput } from '../../types/contact'

export async function listContacts(params: ListParams): Promise<Page<Contact>> {
  const resp = await apiClient.get<Page<Contact>>('/contacts', { params })
  return resp.data
}

export async function getContact(id: number): Promise<Contact> {
  const resp = await apiClient.get<Contact>(`/contacts/${id}`)
  return resp.data
}

export async function createContact(input: ContactInput): Promise<ContactCreateResponse> {
  const resp = await apiClient.post<ContactCreateResponse>('/contacts', input)
  return resp.data
}

export async function updateContact(id: number, input: Partial<ContactInput>): Promise<Contact> {
  const resp = await apiClient.patch<Contact>(`/contacts/${id}`, input)
  return resp.data
}

export async function archiveContact(id: number): Promise<Contact> {
  const resp = await apiClient.post<Contact>(`/contacts/${id}/archive`)
  return resp.data
}

export async function unarchiveContact(id: number): Promise<Contact> {
  const resp = await apiClient.post<Contact>(`/contacts/${id}/unarchive`)
  return resp.data
}
