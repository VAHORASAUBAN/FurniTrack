import type { DocumentType } from '../lib/documentRoutes'

export interface DocTypeCounts {
  draft: number
  confirmed: number
  cancelled: number
}

export interface PostedDocSummary {
  draft_count: number
  posted_count: number
  unpaid_count: number
  partially_paid_count: number
  paid_count: number
  total_amount_due: string
}

export interface DashboardBudgetSummary {
  active_count: number
  total_planned: string
  total_achieved: string
}

export interface RecentDocument {
  id: number
  doc_type: DocumentType
  doc_number: string
  doc_date: string
  status: string
  partner_name: string
  total_amount: string
  updated_at: string
}

export interface DashboardSummary {
  sales_orders: DocTypeCounts
  purchase_orders: DocTypeCounts
  customer_invoices: PostedDocSummary
  vendor_bills: PostedDocSummary
  budgets: DashboardBudgetSummary
  recent_documents: RecentDocument[]
}
