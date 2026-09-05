export type JournalType = 'SALES' | 'PURCHASE' | 'BANK' | 'CASH' | 'MISC'

export interface Journal {
  id: number
  code: string
  name: string
  journal_type: JournalType
  default_account_id: number | null
  is_active: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface JournalInput {
  code: string
  name: string
  journal_type: JournalType
  default_account_id?: number | null
}

export const JOURNAL_TYPE_LABELS: Record<JournalType, string> = {
  SALES: 'Sales',
  PURCHASE: 'Purchase',
  BANK: 'Bank',
  CASH: 'Cash',
  MISC: 'Miscellaneous',
}
