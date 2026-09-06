export type DocumentType = 'PURCHASE_ORDER' | 'VENDOR_BILL' | 'SALES_ORDER' | 'CUSTOMER_INVOICE'

export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  PURCHASE_ORDER: 'Purchase Order',
  VENDOR_BILL: 'Vendor Bill',
  SALES_ORDER: 'Sales Order',
  CUSTOMER_INVOICE: 'Customer Invoice',
}

export const DOC_TYPE_ROUTE: Record<DocumentType, string> = {
  PURCHASE_ORDER: '/purchase/orders',
  VENDOR_BILL: '/purchase/bills',
  SALES_ORDER: '/sales/orders',
  CUSTOMER_INVOICE: '/sales/invoices',
}

export function documentPath(docType: DocumentType, id: number): string {
  return `${DOC_TYPE_ROUTE[docType]}/${id}`
}
