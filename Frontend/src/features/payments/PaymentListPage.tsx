import { useNavigate } from 'react-router-dom'
import { listPayments } from '../../api/endpoints/payments'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Payment, PaymentType } from '../../types/payment'

interface PaymentListPageProps {
  paymentType: PaymentType
  title: string
  basePath: string
}

/** One list backs both "Purchase > Payments" (SEND) and "Sales > Receipts"
 * (RECEIVE) - same resource, same shape, just filtered by direction, same
 * pattern as Purchase/Sales sharing DocumentForm via a docType prop. */
export function PaymentListPage({ paymentType, title, basePath }: PaymentListPageProps) {
  const navigate = useNavigate()

  return (
    <ListView<Payment>
      title={title}
      queryKey={`payments-${paymentType}`}
      fetcher={(params) => listPayments({ ...params, payment_type: paymentType })}
      rowKey={(p) => p.id}
      onRowClick={(p) => navigate(`${basePath}/${p.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by payment number or note…"
      columns={[
        { header: 'Payment No.', accessor: (p) => <span className="font-mono text-xs">{p.payment_number}</span> },
        { header: 'Partner', accessor: (p) => p.partner_name },
        { header: 'Date', accessor: (p) => p.payment_date },
        { header: 'Method', accessor: (p) => (p.method === 'BANK' ? 'Bank' : 'Cash') },
        { header: 'Amount', accessor: (p) => formatMoney(p.amount), className: 'text-right font-mono' },
        { header: 'Status', accessor: (p) => <StatusPill status={p.status} /> },
      ]}
    />
  )
}
