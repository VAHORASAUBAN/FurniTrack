import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { Journal, JournalInput } from '../../types/journal'

export async function listJournals(params: ListParams): Promise<Page<Journal>> {
  const resp = await apiClient.get<Page<Journal>>('/journals', { params })
  return resp.data
}

export async function getJournal(id: number): Promise<Journal> {
  const resp = await apiClient.get<Journal>(`/journals/${id}`)
  return resp.data
}

export async function createJournal(input: JournalInput): Promise<Journal> {
  const resp = await apiClient.post<Journal>('/journals', input)
  return resp.data
}

export async function updateJournal(id: number, input: Partial<JournalInput>): Promise<Journal> {
  const resp = await apiClient.patch<Journal>(`/journals/${id}`, input)
  return resp.data
}

export async function archiveJournal(id: number): Promise<Journal> {
  const resp = await apiClient.post<Journal>(`/journals/${id}/archive`)
  return resp.data
}

export async function unarchiveJournal(id: number): Promise<Journal> {
  const resp = await apiClient.post<Journal>(`/journals/${id}/unarchive`)
  return resp.data
}
