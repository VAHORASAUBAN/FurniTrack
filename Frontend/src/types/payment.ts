export type PaymentType = 'RECEIVE' | 'SEND'
export type PaymentMethod = 'BANK' | 'CASH'
export type PaymentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED'

export interface PaymentAllocation {
  id: number
  document_id: number
  amount_allocated: string
}

export interface Payment {
  id: number
  payment_number: string
  payment_type: PaymentType
  method: PaymentMethod
  partner_id: number
  journal_id: number
  payment_date: string
  amount: string
  note: string | null
  status: PaymentStatus
  created_at: string
  allocations: PaymentAllocation[]
}

export interface PaymentInput {
  payment_type: PaymentType
  method: PaymentMethod
  partner_id: number
  journal_id: number
  payment_date: string
  amount: string
  note?: string | null
  allocations: { document_id: number; amount_allocated: string }[]
}

export interface DocumentOutstanding {
  total_amount: string
  amount_paid: string
  amount_due: string
  payment_status: string
}
