import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { getApiErrorMessage } from '../../api/client'

interface SendEmailDialogProps {
  defaultEmail: string | null
  sendFn: (email: string | undefined) => Promise<{ message: string }>
  onClose: () => void
  onSent: (message: string) => void
}

/** Shared by the Vendor Bill and Customer Invoice "Send" actions - one
 * dialog, parameterised by which endpoint to call, same pattern as
 * PayDialog being parameterised by paymentType. */
export function SendEmailDialog({ defaultEmail, sendFn, onClose, onSent }: SendEmailDialogProps) {
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [serverError, setServerError] = useState<string | null>(null)

  const sendMutation = useMutation({
    mutationFn: () => sendFn(email || undefined),
    onSuccess: (resp) => onSent(resp.message),
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-display text-lg font-semibold text-[var(--color-ink)]">Send by email</h2>

        <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Recipient</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
        />
        <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">A PDF copy is attached automatically.</p>

        {serverError && (
          <div className="mt-3 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-[var(--color-rule-2)] px-3.5 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setServerError(null)
              sendMutation.mutate()
            }}
            disabled={sendMutation.isPending || !email}
            className="rounded-md bg-[var(--color-accent)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40"
          >
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
