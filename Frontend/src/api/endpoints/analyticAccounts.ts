import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { AnalyticAccount, AnalyticAccountInput, AnalyticType } from '../../types/analyticAccount'
import type { Many2OneOption } from '../../components/shared/Many2OneSelect'

export async function listAnalyticAccounts(
  params: ListParams & { analytic_type?: AnalyticType }
): Promise<Page<AnalyticAccount>> {
  const resp = await apiClient.get<Page<AnalyticAccount>>('/analytic-accounts', { params })
  return resp.data
}

export async function getAnalyticAccount(id: number): Promise<AnalyticAccount> {
  const resp = await apiClient.get<AnalyticAccount>(`/analytic-accounts/${id}`)
  return resp.data
}

export async function createAnalyticAccount(input: AnalyticAccountInput): Promise<AnalyticAccount> {
  const resp = await apiClient.post<AnalyticAccount>('/analytic-accounts', input)
  return resp.data
}

export async function updateAnalyticAccount(id: number, input: Partial<AnalyticAccountInput>): Promise<AnalyticAccount> {
  const resp = await apiClient.patch<AnalyticAccount>(`/analytic-accounts/${id}`, input)
  return resp.data
}

export async function archiveAnalyticAccount(id: number): Promise<AnalyticAccount> {
  const resp = await apiClient.post<AnalyticAccount>(`/analytic-accounts/${id}/archive`)
  return resp.data
}

export async function unarchiveAnalyticAccount(id: number): Promise<AnalyticAccount> {
  const resp = await apiClient.post<AnalyticAccount>(`/analytic-accounts/${id}/unarchive`)
  return resp.data
}

export async function analyticAccountOptions(search: string): Promise<Many2OneOption[]> {
  const page = await listAnalyticAccounts({ search, page_size: 25 })
  return page.items.map((a) => ({ id: a.id, label: a.name }))
}
