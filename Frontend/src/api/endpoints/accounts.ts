import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { AccountInput, AccountType, ChartOfAccount } from '../../types/account'
import type { Many2OneOption } from '../../components/shared/Many2OneSelect'

export async function listAccounts(params: ListParams & { account_type?: AccountType }): Promise<Page<ChartOfAccount>> {
  const resp = await apiClient.get<Page<ChartOfAccount>>('/accounts', { params })
  return resp.data
}

export async function getAccount(id: number): Promise<ChartOfAccount> {
  const resp = await apiClient.get<ChartOfAccount>(`/accounts/${id}`)
  return resp.data
}

export async function createAccount(input: AccountInput): Promise<ChartOfAccount> {
  const resp = await apiClient.post<ChartOfAccount>('/accounts', input)
  return resp.data
}

export async function updateAccount(id: number, input: Partial<AccountInput>): Promise<ChartOfAccount> {
  const resp = await apiClient.patch<ChartOfAccount>(`/accounts/${id}`, input)
  return resp.data
}

export async function archiveAccount(id: number): Promise<ChartOfAccount> {
  const resp = await apiClient.post<ChartOfAccount>(`/accounts/${id}/archive`)
  return resp.data
}

export async function unarchiveAccount(id: number): Promise<ChartOfAccount> {
  const resp = await apiClient.post<ChartOfAccount>(`/accounts/${id}/unarchive`)
  return resp.data
}

export async function accountOptions(search: string): Promise<Many2OneOption[]> {
  const page = await listAccounts({ search, page_size: 25 })
  return page.items.map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` }))
}
