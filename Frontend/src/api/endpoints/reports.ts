import { apiClient } from '../client'
import type { BalanceSheet, BudgetDrillDownItem, ProfitLoss } from '../../types/report'

export async function getBalanceSheet(asOf: string): Promise<BalanceSheet> {
  const resp = await apiClient.get<BalanceSheet>('/reports/balance-sheet', { params: { as_of: asOf } })
  return resp.data
}

export async function getProfitLoss(dateFrom: string, dateTo: string): Promise<ProfitLoss> {
  const resp = await apiClient.get<ProfitLoss>('/reports/profit-loss', {
    params: { date_from: dateFrom, date_to: dateTo },
  })
  return resp.data
}

export async function getBudgetDrillDown(
  analyticId: number,
  dateFrom: string,
  dateTo: string
): Promise<BudgetDrillDownItem[]> {
  const resp = await apiClient.get<BudgetDrillDownItem[]>('/reports/budget/drill-down', {
    params: { analytic_id: analyticId, date_from: dateFrom, date_to: dateTo },
  })
  return resp.data
}
