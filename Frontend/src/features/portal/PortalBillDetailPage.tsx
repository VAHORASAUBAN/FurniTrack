import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getMyBill } from '../../api/endpoints/portal'
import { FormShell } from '../../components/shared/FormShell'
import { useGoBack } from '../../hooks/useGoBack'
import { formatMoney } from '../../lib/money'
import { openPdf } from '../../lib/pdf'

/** Read-only mirror of PortalInvoiceDetailPage — a vendor sees what they're
 * owed and its payment status, but doesn't settle it themselves. */
export function PortalBillDetailPage() {
  const { id } = useParams<{ id: string }>()
  const billId = Number(id)
  const goBack = useGoBack('/portal/bills')

  const { data: bill, isLoading } = useQuery({
    queryKey: ['my-bills', billId],
    queryFn: () => getMyBill(billId),
  })

  if (isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>
  if (!bill) return null

  const isPaid = bill.balance?.payment_status === 'PAID'

  return (
    <FormShell
      title={bill.doc_number}
      status={isPaid ? 'PAID' : bill.status}
      onBack={goBack}
      actions={[{ label: 'Print', onClick: () => openPdf(`/portal/bills/${billId}/pdf`), variant: 'secondary' }]}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6 text-sm">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Bill Date</div>
          <div>{bill.doc_date}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Due Date</div>
          <div>{bill.due_date ?? '—'}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Reference</div>
          <div>{bill.reference ?? '—'}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--color-rule)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit Price</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {bill.lines.map((line) => (
              <tr key={line.id} className="border-b border-[var(--color-rule)] last:border-0">
                <td className="px-3 py-2">{line.description ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{line.quantity}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney(line.unit_price)}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bill.balance && (
        <div className="mt-5 flex justify-end">
          <div className="w-72 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Total</span>
              <span className="font-mono">{formatMoney(bill.total_amount)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Paid</span>
              <span className="font-mono">{formatMoney(bill.balance.amount_paid)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-[var(--color-rule-2)] pt-1.5 font-semibold">
              <span>Amount Due</span>
              <span className="font-mono">{formatMoney(bill.balance.amount_due)}</span>
            </div>
          </div>
        </div>
      )}
    </FormShell>
  )
}
