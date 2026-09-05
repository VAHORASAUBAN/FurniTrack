export type AccountType = 'ASSET' | 'BANK' | 'CASH' | 'LIABILITY' | 'CAPITAL' | 'INCOME' | 'EXPENSE' | 'OTHER_EXPENSE'

export interface ChartOfAccount {
  id: number
  code: string
  name: string
  account_type: AccountType
  is_receivable: boolean
  is_payable: boolean
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface AccountInput {
  code: string
  name: string
  account_type: AccountType
  is_receivable?: boolean
  is_payable?: boolean
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Asset',
  BANK: 'Bank',
  CASH: 'Cash',
  LIABILITY: 'Liability',
  CAPITAL: 'Capital',
  INCOME: 'Income',
  EXPENSE: 'Expense',
  OTHER_EXPENSE: 'Other Expense',
}
