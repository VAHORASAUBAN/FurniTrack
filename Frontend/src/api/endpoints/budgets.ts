import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { Budget, BudgetInput } from '../../types/budget'

export async function listBudgets(params: ListParams): Promise<Page<Budget>> {
  const resp = await apiClient.get<Page<Budget>>('/budgets', { params })
  return resp.data
}

export async function getBudget(id: number): Promise<Budget> {
  const resp = await apiClient.get<Budget>(`/budgets/${id}`)
  return resp.data
}

export async function createBudget(input: BudgetInput): Promise<Budget> {
  const resp = await apiClient.post<Budget>('/budgets', input)
  return resp.data
}

export async function updateBudget(id: number, input: Partial<BudgetInput>): Promise<Budget> {
  const resp = await apiClient.patch<Budget>(`/budgets/${id}`, input)
  return resp.data
}

export async function confirmBudget(id: number): Promise<Budget> {
  const resp = await apiClient.post<Budget>(`/budgets/${id}/confirm`)
  return resp.data
}

export async function cancelBudget(id: number): Promise<Budget> {
  const resp = await apiClient.post<Budget>(`/budgets/${id}/cancel`)
  return resp.data
}
