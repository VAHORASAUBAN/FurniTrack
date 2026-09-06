import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, type DefaultValues } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { contactOptions, getContact } from '../../api/endpoints/contacts'
import {
  cancelVendorBill,
  createVendorBill,
  deleteVendorBill,
  getVendorBill,
  postVendorBill,
  sendVendorBillEmail,
  updateVendorBill,
} from '../../api/endpoints/purchase'
import { FormShell } from '../../components/shared/FormShell'
import { emptyDocumentLine, LineItemGrid } from '../../components/shared/LineItemGrid'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { PayDialog } from '../../components/shared/PayDialog'
import { SendEmailDialog } from '../../components/shared/SendEmailDialog'
import { useGoBack } from '../../hooks/useGoBack'
import { formatMoney } from '../../lib/money'
import { openPdf } from '../../lib/pdf'
import { useAuthStore } from '../../stores/authStore'

const lineSchema = z.object({
  product_id: z.number().nullable().optional(),
  account_id: z.number().nullable().optional(),
  analytic_account_id: z.number().nullable().optional(),
  description: z.string().optional(),
  quantity: z.string().regex(/^\d*\.?\d*$/, 'Invalid'),
  unit_price: z.string().regex(/^\d*\.?\d*$/, 'Invalid'),
  tax_rate: z.string().regex(/^\d*\.?\d*$/, 'Invalid'),
})

const schema = z.object({
  partner_id: z.number().min(1, 'Select a vendor'),
  doc_date: z.string().min(1, 'Required'),
  due_date: z.string().optional(),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line is required'),
})
type FormValues = z.infer<typeof schema>

export function VendorBillFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const billId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/purchase/bills')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  const { data: bill, isLoading } = useQuery({
    queryKey: ['vendor-bills', billId],
    queryFn: () => getVendorBill(billId as number),
    enabled: !isNew,
  })

  const { data: vendorContact } = useQuery({
    queryKey: ['contacts', bill?.partner_id],
    queryFn: () => getContact(bill!.partner_id),
    enabled: Boolean(bill?.partner_id) && showSend,
  })

  // Hoisted so the Clear button can pass this same object to reset()
  // explicitly - react-hook-form's `values` option (below) silently
  // overwrites its internal defaultValues with the loaded record once
  // `bill` resolves, so a bare reset() on an edit page just reapplies
  // the currently-loaded record instead of blanking the form. Passing
  // this object explicitly also forces the `lines` useFieldArray to
  // resync, which a bare reset() does not reliably do either.
  const blankValues: DefaultValues<FormValues> = {
    doc_date: new Date().toISOString().slice(0, 10),
    lines: [{ ...emptyDocumentLine }],
  }

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: bill
      ? {
          partner_id: bill.partner_id,
          doc_date: bill.doc_date,
          due_date: bill.due_date ?? '',
          reference: bill.reference ?? '',
          lines: bill.lines.map((l) => ({
            product_id: l.product_id, account_id: l.account_id, analytic_account_id: l.analytic_account_id,
            description: l.description ?? '', quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
          })),
        }
      : undefined,
    defaultValues: blankValues,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
    queryClient.invalidateQueries({ queryKey: ['vendor-bills', billId] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (isNew ? createVendorBill(values) : updateVendorBill(billId as number, values)),
    onSuccess: (b) => {
      invalidate()
      if (isNew) navigate(`/purchase/bills/${b.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const postMutation = useMutation({
    mutationFn: () => postVendorBill(billId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelVendorBill(billId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteVendorBill(billId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] })
      navigate('/purchase/bills')
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSave(values: FormValues) {
    setServerError(null)
    saveMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const status = bill?.status
  const isEditable = isNew || status === 'DRAFT'
  const canManage = role === 'ADMIN'

  const actions = []
  if (isEditable) {
    actions.push({
      label: saveMutation.isPending ? 'Saving…' : 'Save',
      onClick: handleSubmit(onSave),
      variant: 'secondary' as const,
      disabled: saveMutation.isPending,
    })
    actions.push({ label: 'Clear', onClick: () => reset(blankValues), variant: 'secondary' as const })
  }
  if (!isNew && status === 'DRAFT') {
    actions.push({
      label: postMutation.isPending ? 'Posting…' : 'Post',
      onClick: () => postMutation.mutate(),
      variant: 'primary' as const,
      disabled: postMutation.isPending,
    })
    actions.push({
      label: deleteMutation.isPending ? 'Deleting…' : 'Delete',
      onClick: () => deleteMutation.mutate(),
      variant: 'danger' as const,
      disabled: deleteMutation.isPending,
    })
  }
  if (!isNew) {
    actions.push({
      label: 'Print', onClick: () => openPdf(`/purchase/bills/${billId}/pdf`), variant: 'secondary' as const,
    })
  }
  if (!isNew && status === 'POSTED') {
    actions.push({ label: 'Send', onClick: () => setShowSend(true), variant: 'secondary' as const })
  }
  if (!isNew && status === 'POSTED' && bill?.balance?.payment_status !== 'PAID') {
    actions.push({ label: 'Pay', onClick: () => setShowPay(true), variant: 'primary' as const })
  }
  if (!isNew && status === 'POSTED' && canManage) {
    actions.push({
      label: cancelMutation.isPending ? 'Cancelling…' : 'Cancel',
      onClick: () => cancelMutation.mutate(),
      variant: 'danger' as const,
      disabled: cancelMutation.isPending,
    })
  }

  return (
    <FormShell
      title={isNew ? 'New Vendor Bill' : bill?.doc_number ?? 'Vendor Bill'}
      status={bill?.balance?.payment_status === 'PAID' ? 'PAID' : status}
      updatedAt={bill?.updated_at}
      onBack={goBack}
      actions={actions}
    >
      {bill?.source_document_id && (
        <button
          onClick={() => navigate(`/purchase/orders/${bill.source_document_id}`)}
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          ← View source Purchase Order
        </button>
      )}

      <div className="grid grid-cols-4 gap-x-6 gap-y-4 mb-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Vendor Name</label>
          <Controller
            name="partner_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="contacts"
                fetchOptions={contactOptions}
                placeholder="Select a vendor…"
              />
            )}
          />
          {errors.partner_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.partner_id.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Bill Date</label>
          <input type="date" disabled={!isEditable} {...register('doc_date')} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Due Date</label>
          <input type="date" disabled={!isEditable} {...register('due_date')} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Bill Reference</label>
          <input disabled={!isEditable} {...register('reference')} className={inputClass} placeholder="e.g. ABC-26-001" />
        </div>
      </div>

      <LineItemGrid control={control} setValue={setValue} name="lines" isPurchase disabled={!isEditable} />
      {errors.lines?.message && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.lines.message}</p>}

      {bill?.balance && (
        <div className="mt-5 flex justify-end">
          <div className="w-72 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Total</span>
              <span className="font-mono">{formatMoney(bill.total_amount)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Paid via Cash</span>
              <span className="font-mono">{formatMoney(bill.balance.paid_via_cash)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Paid via Bank</span>
              <span className="font-mono">{formatMoney(bill.balance.paid_via_bank)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-[var(--color-rule-2)] pt-1.5 font-semibold">
              <span>Amount Due</span>
              <span className="font-mono">{formatMoney(bill.balance.amount_due)}</span>
            </div>
          </div>
        </div>
      )}

      {serverError && (
        <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
      {sentMessage && (
        <div className="mt-4 rounded-md bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">
          {sentMessage}
        </div>
      )}

      {showSend && (
        <SendEmailDialog
          defaultEmail={vendorContact?.email ?? null}
          sendFn={(email) => sendVendorBillEmail(billId as number, email)}
          onClose={() => setShowSend(false)}
          onSent={(message) => {
            setShowSend(false)
            setSentMessage(message)
          }}
        />
      )}

      {showPay && bill && (
        <PayDialog
          documentId={bill.id}
          partnerId={bill.partner_id}
          paymentType="SEND"
          onClose={() => setShowPay(false)}
          onPaid={() => {
            setShowPay(false)
            invalidate()
          }}
        />
      )}
    </FormShell>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-paper)] disabled:text-[var(--color-ink-3)]'
