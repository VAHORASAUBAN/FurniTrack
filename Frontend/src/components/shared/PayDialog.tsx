import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../api/client'
import { journalOptions } from '../../api/endpoints/journals'
import { createPayment } from '../../api/endpoints/payments'
import { getDocumentOutstanding } from '../../api/endpoints/payments'
import type { PaymentType } from '../../types/payment'
import { Many2OneSelect } from './Many2OneSelect'
import { MoneyInput } from './MoneyInput'

interface PayDialogProps {
  documentId: number
  partnerId: number
  paymentType: PaymentType
  onClose: () => void
  onPaid: () => void
}

/** Design doc §5.6 / wireframe's Pay dialog — a single Confirm action that
 * creates and posts the payment in one call, autofilling the amount due
 * from `v_document_balance` (design doc §2.4) rather than asking the user
 * to type it. */
export function PayDialog({ documentId, partnerId, paymentType, onClose, onPaid }: PayDialogProps) {
  const queryClient = useQueryClient()
  const [journalId, setJournalId] = useState<number | null>(null)
  const [method, setMethod] = useState<'BANK' | 'CASH'>('BANK')
  const [amount, setAmount] = useState('0.00')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: outstanding } = useQuery({
    queryKey: ['document-outstanding', documentId],
    queryFn: () => getDocumentOutstanding(documentId),
  })

  useEffect(() => {
    if (outstanding) setAmount(outstanding.amount_due)
  }, [outstanding])

  const payMutation = useMutation({
    mutationFn: () =>
      createPayment({
        payment_type: paymentType,
        method,
        partner_id: partnerId,
        journal_id: journalId as number,
        payment_date: paymentDate,
        amount,
        allocations: [{ document_id: documentId, amount_allocated: amount }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-outstanding', documentId] })
      onPaid()
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--color-rule)] bg-[var(--color-surface)] p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
          {paymentType === 'SEND' ? 'Pay Bill' : 'Receive Payment'}
        </h2>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Amount</label>
            <MoneyInput value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-[var(--color-ink-3)]">
              Amount due: {outstanding?.amount_due ?? '…'}
            </p>
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

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Payment Via</label>
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
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Journal</label>
            <Many2OneSelect
              value={journalId}
              onChange={setJournalId}
              queryKey="journals"
              fetchOptions={journalOptions}
              placeholder="Select journal…"
            />
          </div>
        </div>

        {serverError && (
          <div className="mb-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-rule-2)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setServerError(null)
              payMutation.mutate()
            }}
            disabled={payMutation.isPending || !journalId}
            className="rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
          >
            {payMutation.isPending ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
