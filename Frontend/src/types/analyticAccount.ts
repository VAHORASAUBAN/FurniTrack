export type AnalyticType = 'INCOME' | 'EXPENSE'

export interface AnalyticAccount {
  id: number
  name: string
  analytic_type: AnalyticType
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface AnalyticAccountInput {
  name: string
  analytic_type: AnalyticType
}
