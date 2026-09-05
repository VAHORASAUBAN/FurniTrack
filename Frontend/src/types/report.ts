export interface AccountBalance {
  id: number
  code: string
  name: string
  balance: string
}

export interface BalanceSheet {
  as_of: string
  assets: AccountBalance[]
  liabilities: AccountBalance[]
  equity: AccountBalance[]
  net_income: string
  total_assets: string
  total_liabilities: string
  total_equity: string
  is_balanced: boolean
  difference: string
}

export interface ProfitLossLine {
  id: number
  code: string
  name: string
  amount: string
}

export interface ProfitLoss {
  date_from: string
  date_to: string
  income: ProfitLossLine[]
  expenses: ProfitLossLine[]
  other_expenses: ProfitLossLine[]
  total_income: string
  total_expenses: string
  total_other_expense: string
  net_profit: string
}

export type DrillDownDocType = 'PURCHASE_ORDER' | 'VENDOR_BILL' | 'SALES_ORDER' | 'CUSTOMER_INVOICE'

export interface BudgetDrillDownItem {
  id: number
  doc_type: DrillDownDocType
  doc_number: string
  doc_date: string
  partner_name: string
  total_amount: string
}
