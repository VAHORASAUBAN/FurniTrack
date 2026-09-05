export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'
export type JournalEntrySourceType = 'MANUAL' | 'VENDOR_BILL' | 'CUSTOMER_INVOICE' | 'PAYMENT'

export interface JournalEntryLine {
  id: number
  line_no: number
  account_id: number
  partner_id: number | null
  analytic_account_id: number | null
  label: string | null
  debit: string
  credit: string
}

export interface JournalEntry {
  id: number
  entry_number: string
  journal_id: number
  entry_date: string
  reference: string | null
  narration: string | null
  status: JournalEntryStatus
  source_type: JournalEntrySourceType
  source_document_id: number | null
  source_payment_id: number | null
  total_debit: string
  total_credit: string
  posted_at: string | null
  posted_by: number | null
  lines: JournalEntryLine[]
}

export interface JournalEntryLineInput {
  account_id: number
  partner_id?: number | null
  analytic_account_id?: number | null
  label?: string | null
  debit: string
  credit: string
}

export interface JournalEntryInput {
  journal_id: number
  entry_date: string
  reference?: string | null
  narration?: string | null
  lines: JournalEntryLineInput[]
}
