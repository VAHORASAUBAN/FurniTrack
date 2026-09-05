export type DocType = 'PURCHASE_ORDER' | 'VENDOR_BILL' | 'SALES_ORDER' | 'CUSTOMER_INVOICE'
export type DocStatus = 'DRAFT' | 'CONFIRMED' | 'POSTED' | 'CANCELLED'
export type PaymentAllocationStatus = 'DRAFT' | 'CANCELLED' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'

export interface DocumentLine {
  id: number
  line_no: number
  product_id: number | null
  account_id: number
  analytic_account_id: number | null
  description: string | null
  quantity: string
  unit_price: string
  tax_rate: string
  tax_amount: string
  subtotal: string
  total: string
}

export interface DocumentBalance {
  amount_paid: string
  paid_via_cash: string
  paid_via_bank: string
  amount_due: string
  payment_status: PaymentAllocationStatus
}

export interface Document {
  id: number
  doc_type: DocType
  doc_number: string
  partner_id: number
  journal_id: number | null
  source_document_id: number | null
  doc_date: string
  due_date: string | null
  reference: string | null
  status: DocStatus
  untaxed_amount: string
  tax_amount: string
  total_amount: string
  notes: string | null
  created_at: string
  updated_at: string
  lines: DocumentLine[]
  balance: DocumentBalance | null
}

export interface DocumentLineInput {
  product_id?: number | null
  account_id?: number | null
  analytic_account_id?: number | null
  description?: string | null
  quantity: string
  unit_price: string
  tax_rate: string
}

export interface DocumentInput {
  partner_id: number
  doc_date: string
  due_date?: string | null
  reference?: string | null
  notes?: string | null
  lines: DocumentLineInput[]
}
