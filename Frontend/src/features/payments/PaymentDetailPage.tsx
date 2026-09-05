import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../../api/client'
import { cancelPayment, getPayment } from '../../api/endpoints/payments'
import { FormShell } from '../../components/shared/FormShell'
import { StatusPill } from '../../components/shared/StatusPill'
import { useGoBack } from '../../hooks/useGoBack'
import { documentPath, DOC_TYPE_LABEL } from '../../lib/documentRoutes'
import { formatMoney } from '../../lib/money'
import { useAuthStore } from '../../stores/authStore'
import { useState } from 'react'

interface PaymentDetailPageProps {
  backPath: string
}

/** Read-only - a payment has no draft stage to edit (design doc §5.6: it
 * posts in the same call that creates it), so the only action here is
 * Admin's Cancel (reversal), same danger-action confirm step as everywhere
 * else via FormShell. */
export function PaymentDetailPage({ backPath }: PaymentDetailPageProps) {
  const { id } = useParams<{ id: string }>()
  const paymentId = Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack(backPath)
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payments', paymentId],
    queryFn: () => getPayment(paymentId),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', paymentId] })
      setServerError(null)
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  if (isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>
  if (!payment) return null

  const actions = []
  if (role === 'ADMIN' && payment.status === 'POSTED') {
    actions.push({
      label: cancelMutation.isPending ? 'Cancelling…' : 'Cancel',
      onClick: () => cancelMutation.mutate(),
      variant: 'danger' as const,
      disabled: cancelMutation.isPending,
    })
  }

  return (
    <FormShell title={payment.payment_number} status={payment.status} onBack={goBack} actions={actions}>
      <div className="grid grid-cols-4 gap-x-6 gap-y-4">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Partner</div>
          <div className="text-sm">{payment.partner_name}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Date</div>
          <div className="text-sm">{payment.payment_date}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Method</div>
          <div className="text-sm">{payment.method === 'BANK' ? 'Bank' : 'Cash'}</div>
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Amount</div>
          <div className="font-mono text-sm">{formatMoney(payment.amount)}</div>
        </div>
        {payment.note && (
          <div className="col-span-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Note</div>
            <div className="text-sm">{payment.note}</div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Applied To</h3>
        <div className="overflow-x-auto rounded-md border border-[var(--color-rule)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Amount Allocated</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((alloc) => (
                <tr
                  key={alloc.id}
                  onClick={() => navigate(documentPath(alloc.doc_type, alloc.document_id))}
                  className="cursor-pointer border-b border-[var(--color-rule)] last:border-0 hover:bg-[var(--color-accent-bg)]/50"
                >
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-accent)]">{alloc.doc_number}</td>
                  <td className="px-3 py-2 text-[var(--color-ink-2)]">{DOC_TYPE_LABEL[alloc.doc_type]}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(alloc.amount_allocated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payment.status === 'CANCELLED' && (
        <div className="mt-4 flex items-center gap-2">
          <StatusPill status="CANCELLED" />
          <span className="text-xs text-[var(--color-ink-3)]">
            This payment was reversed — the settled document(s) above are outstanding again.
          </span>
        </div>
      )}

      {serverError && (
        <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
    </FormShell>
  )
}
