import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { JournalEntry, JournalEntryInput } from '../../types/journalEntry'

export async function listJournalEntries(params: ListParams): Promise<Page<JournalEntry>> {
  const resp = await apiClient.get<Page<JournalEntry>>('/journal-entries', { params })
  return resp.data
}

export async function getJournalEntry(id: number): Promise<JournalEntry> {
  const resp = await apiClient.get<JournalEntry>(`/journal-entries/${id}`)
  return resp.data
}

export async function createJournalEntry(input: JournalEntryInput): Promise<JournalEntry> {
  const resp = await apiClient.post<JournalEntry>('/journal-entries', input)
  return resp.data
}

export async function updateJournalEntry(id: number, input: Partial<JournalEntryInput>): Promise<JournalEntry> {
  const resp = await apiClient.patch<JournalEntry>(`/journal-entries/${id}`, input)
  return resp.data
}

export async function postJournalEntry(id: number): Promise<JournalEntry> {
  const resp = await apiClient.post<JournalEntry>(`/journal-entries/${id}/post`)
  return resp.data
}

export async function cancelJournalEntry(id: number): Promise<JournalEntry> {
  const resp = await apiClient.post<JournalEntry>(`/journal-entries/${id}/cancel`)
  return resp.data
}

export async function resetJournalEntryToDraft(id: number): Promise<JournalEntry> {
  const resp = await apiClient.post<JournalEntry>(`/journal-entries/${id}/reset-to-draft`)
  return resp.data
}

export async function deleteJournalEntry(id: number): Promise<void> {
  await apiClient.delete(`/journal-entries/${id}`)
}
