export type BudgetStatus = 'DRAFT' | 'CONFIRMED' | 'REVISED' | 'CANCELLED'
export type AnalyticType = 'INCOME' | 'EXPENSE'

export interface BudgetLine {
  id: number
  analytic_account_id: number
  analytic_name: string
  analytic_type: AnalyticType
  planned_amount: string
  achieved_amount: string
  achieved_pct: string
  remaining: string
}

export interface Budget {
  id: number
  name: string
  start_date: string
  end_date: string
  responsible_contact_id: number | null
  status: BudgetStatus
  revises_budget_id: number | null
  is_active: boolean
  updated_at: string
  lines: BudgetLine[]
}

export interface BudgetLineInput {
  analytic_account_id: number
  analytic_type: AnalyticType
  planned_amount: string
}

export interface BudgetInput {
  name: string
  start_date: string
  end_date: string
  responsible_contact_id?: number | null
  lines: BudgetLineInput[]
}
