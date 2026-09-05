import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../../api/client'
import { getMyInvoice, payMyInvoice } from '../../api/endpoints/portal'
import { FormShell } from '../../components/shared/FormShell'
import { MoneyInput } from '../../components/shared/MoneyInput'
import { useGoBack } from '../../hooks/useGoBack'
import { formatMoney } from '../../lib/money'
import { openPdf } from '../../lib/pdf'

/** The wireframe's "can directly pay his dues from portal" — a single
 * Confirm action, same shape as the staff PayDialog but hitting the
 * portal-scoped pay endpoint (never /payments, which 403s for this role)
 * and with no journal picker: the engine resolves Bank/Cash from company
 * settings, since a portal user has no reason to know what a journal is. */
export function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const invoiceId = Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/portal/invoices')
  const queryClient = useQueryClient()
  const [method, setMethod] = useState<'BANK' | 'CASH'>('BANK')
  const [amount, setAmount] = useState('0.00')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['my-invoices', invoiceId],
    queryFn: () => getMyInvoice(invoiceId),
  })

  useEffect(() => {
    if (invoice?.balance) setAmount(invoice.balance.amount_due)
  }, [invoice?.balance?.amount_due])

  const payMutation = useMutation({
    mutationFn: () => payMyInvoice(invoiceId, { method, amount, payment_date: paymentDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['my-invoices', invoiceId] })
      setServerError(null)
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  if (isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>
  if (!invoice) return null

  const isPaid = invoice.balance?.payment_status === 'PAID'

  return (
    <FormShell
      title={invoice.doc_number}
      status={isPaid ? 'PAID' : invoice.status}
      onBack={goBack}
      actions={[
        { label: 'Print', onClick: () => openPdf(`/portal/invoices/${invoiceId}/pdf`), variant: 'secondary' },
      ]}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6 text-sm">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Invoice Date</div>
          <div>{invoice.doc_date}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Due Date</div>
          <div>{invoice.due_date ?? '—'}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Reference</div>
          <div>{invoice.reference ?? '—'}</div>
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
            {invoice.lines.map((line) => (
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

      {invoice.balance && (
        <div className="mt-5 flex justify-end">
          <div className="w-72 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Total</span>
              <span className="font-mono">{formatMoney(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Paid</span>
              <span className="font-mono">{formatMoney(invoice.balance.amount_paid)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-[var(--color-rule-2)] pt-1.5 font-semibold">
              <span>Amount Due</span>
              <span className="font-mono">{formatMoney(invoice.balance.amount_due)}</span>
            </div>
          </div>
        </div>
      )}

      {!isPaid && invoice.status === 'POSTED' && (
        <div className="mt-6 rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-ink)]">Pay this invoice</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Amount</label>
              <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Pay Via</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'BANK' | 'CASH')}
                className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
              >
                <option value="BANK">Bank</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
              />
            </div>
          </div>

          {serverError && (
            <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {serverError}
            </div>
          )}

          <button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending}
            className="mt-4 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
          >
            {payMutation.isPending ? 'Confirming…' : 'Confirm Payment'}
          </button>
        </div>
      )}
    </FormShell>
  )
}
