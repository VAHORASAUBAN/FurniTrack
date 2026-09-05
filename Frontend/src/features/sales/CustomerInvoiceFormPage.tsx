import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { contactOptions, getContact } from '../../api/endpoints/contacts'
import {
  cancelCustomerInvoice,
  createCustomerInvoice,
  getCustomerInvoice,
  postCustomerInvoice,
  sendCustomerInvoiceEmail,
  updateCustomerInvoice,
} from '../../api/endpoints/sales'
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
  partner_id: z.number().min(1, 'Select a customer'),
  doc_date: z.string().min(1, 'Required'),
  due_date: z.string().optional(),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line is required'),
})
type FormValues = z.infer<typeof schema>

export function CustomerInvoiceFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const invoiceId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/sales/invoices')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['customer-invoices', invoiceId],
    queryFn: () => getCustomerInvoice(invoiceId as number),
    enabled: !isNew,
  })

  const { data: customerContact } = useQuery({
    queryKey: ['contacts', invoice?.partner_id],
    queryFn: () => getContact(invoice!.partner_id),
    enabled: Boolean(invoice?.partner_id) && showSend,
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: invoice
      ? {
          partner_id: invoice.partner_id,
          doc_date: invoice.doc_date,
          due_date: invoice.due_date ?? '',
          reference: invoice.reference ?? '',
          lines: invoice.lines.map((l) => ({
            product_id: l.product_id, account_id: l.account_id, analytic_account_id: l.analytic_account_id,
            description: l.description ?? '', quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
          })),
        }
      : undefined,
    defaultValues: {
      doc_date: new Date().toISOString().slice(0, 10),
      lines: [{ ...emptyDocumentLine }],
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-invoices'] })
    queryClient.invalidateQueries({ queryKey: ['customer-invoices', invoiceId] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) =>
      isNew ? createCustomerInvoice(values) : updateCustomerInvoice(invoiceId as number, values),
    onSuccess: (i) => {
      invalidate()
      if (isNew) navigate(`/sales/invoices/${i.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const postMutation = useMutation({
    mutationFn: () => postCustomerInvoice(invoiceId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelCustomerInvoice(invoiceId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSave(values: FormValues) {
    setServerError(null)
    saveMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const status = invoice?.status
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
  }
  if (!isNew && status === 'DRAFT') {
    actions.push({
      label: postMutation.isPending ? 'Posting…' : 'Post',
      onClick: () => postMutation.mutate(),
      variant: 'primary' as const,
      disabled: postMutation.isPending,
    })
  }
  if (!isNew) {
    actions.push({
      label: 'Print', onClick: () => openPdf(`/sales/invoices/${invoiceId}/pdf`), variant: 'secondary' as const,
    })
  }
  if (!isNew && status === 'POSTED') {
    actions.push({ label: 'Send', onClick: () => setShowSend(true), variant: 'secondary' as const })
  }
  if (!isNew && status === 'POSTED' && invoice?.balance?.payment_status !== 'PAID') {
    actions.push({ label: 'Receive', onClick: () => setShowPay(true), variant: 'primary' as const })
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
      title={isNew ? 'New Customer Invoice' : invoice?.doc_number ?? 'Customer Invoice'}
      status={invoice?.balance?.payment_status === 'PAID' ? 'PAID' : status}
      onBack={goBack}
      actions={actions}
    >
      {invoice?.source_document_id && (
        <button
          onClick={() => navigate(`/sales/orders/${invoice.source_document_id}`)}
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          ← View source Sales Order
        </button>
      )}

      <div className="grid grid-cols-4 gap-x-6 gap-y-4 mb-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Customer Name</label>
          <Controller
            name="partner_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="contacts"
                fetchOptions={contactOptions}
                placeholder="Select a customer…"
              />
            )}
          />
          {errors.partner_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.partner_id.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Invoice Date</label>
          <input type="date" disabled={!isEditable} {...register('doc_date')} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Due Date</label>
          <input type="date" disabled={!isEditable} {...register('due_date')} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Invoice Reference</label>
          <input disabled={!isEditable} {...register('reference')} className={inputClass} placeholder="e.g. ABC-26-001" />
        </div>
      </div>

      <LineItemGrid control={control} setValue={setValue} name="lines" isPurchase={false} disabled={!isEditable} />
      {errors.lines?.message && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.lines.message}</p>}

      {invoice?.balance && (
        <div className="mt-5 flex justify-end">
          <div className="w-72 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Total</span>
              <span className="font-mono">{formatMoney(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Paid via Cash</span>
              <span className="font-mono">{formatMoney(invoice.balance.paid_via_cash)}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[var(--color-ink-2)]">Paid via Bank</span>
              <span className="font-mono">{formatMoney(invoice.balance.paid_via_bank)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-[var(--color-rule-2)] pt-1.5 font-semibold">
              <span>Amount Due</span>
              <span className="font-mono">{formatMoney(invoice.balance.amount_due)}</span>
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
          defaultEmail={customerContact?.email ?? null}
          sendFn={(email) => sendCustomerInvoiceEmail(invoiceId as number, email)}
          onClose={() => setShowSend(false)}
          onSent={(message) => {
            setShowSend(false)
            setSentMessage(message)
          }}
        />
      )}

      {showPay && invoice && (
        <PayDialog
          documentId={invoice.id}
          partnerId={invoice.partner_id}
          paymentType="RECEIVE"
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
