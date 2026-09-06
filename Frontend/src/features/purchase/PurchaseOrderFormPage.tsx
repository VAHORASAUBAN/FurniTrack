import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, type DefaultValues } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { contactOptions } from '../../api/endpoints/contacts'
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createBillFromOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
} from '../../api/endpoints/purchase'
import { FormShell } from '../../components/shared/FormShell'
import { emptyDocumentLine, LineItemGrid } from '../../components/shared/LineItemGrid'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { useGoBack } from '../../hooks/useGoBack'
import { openPdf } from '../../lib/pdf'

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
  lines: z.array(lineSchema).min(1, 'At least one line is required'),
})
type FormValues = z.infer<typeof schema>

export function PurchaseOrderFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const orderId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/purchase/orders')
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['purchase-orders', orderId],
    queryFn: () => getPurchaseOrder(orderId as number),
    enabled: !isNew,
  })

  // Hoisted so the Clear button can pass this same object to reset()
  // explicitly - react-hook-form's `values` option (below) silently
  // overwrites its internal defaultValues with the loaded record once
  // `order` resolves, so a bare reset() on an edit page just reapplies
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
    values: order
      ? {
          partner_id: order.partner_id,
          doc_date: order.doc_date,
          lines: order.lines.map((l) => ({
            product_id: l.product_id, account_id: l.account_id, analytic_account_id: l.analytic_account_id,
            description: l.description ?? '', quantity: l.quantity, unit_price: l.unit_price, tax_rate: l.tax_rate,
          })),
        }
      : undefined,
    defaultValues: blankValues,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-orders', orderId] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (isNew ? createPurchaseOrder(values) : updatePurchaseOrder(orderId as number, values)),
    onSuccess: (o) => {
      invalidate()
      if (isNew) navigate(`/purchase/orders/${o.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmPurchaseOrder(orderId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseOrder(orderId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const createBillMutation = useMutation({
    mutationFn: () => createBillFromOrder(orderId as number),
    onSuccess: (bill) => navigate(`/purchase/bills/${bill.id}`),
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePurchaseOrder(orderId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      navigate('/purchase/orders')
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSave(values: FormValues) {
    setServerError(null)
    saveMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const status = order?.status
  const isEditable = isNew || status === 'DRAFT'

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
  if (!isNew) {
    actions.push({ label: 'Print', onClick: () => openPdf(`/purchase/orders/${orderId}/pdf`), variant: 'secondary' as const })
  }
  if (!isNew && status === 'DRAFT') {
    actions.push({
      label: deleteMutation.isPending ? 'Deleting…' : 'Delete',
      onClick: () => deleteMutation.mutate(),
      variant: 'danger' as const,
      disabled: deleteMutation.isPending,
    })
  }
  if (!isNew && status === 'DRAFT') {
    actions.push({
      label: 'Confirm',
      onClick: () => confirmMutation.mutate(),
      variant: 'primary' as const,
      disabled: confirmMutation.isPending,
    })
  }
  if (!isNew && status === 'CONFIRMED') {
    actions.push({
      label: createBillMutation.isPending ? 'Creating…' : 'Create Bill',
      onClick: () => createBillMutation.mutate(),
      variant: 'primary' as const,
      disabled: createBillMutation.isPending,
    })
  }
  if (!isNew && (status === 'DRAFT' || status === 'CONFIRMED')) {
    actions.push({
      label: 'Cancel',
      onClick: () => cancelMutation.mutate(),
      variant: 'danger' as const,
      disabled: cancelMutation.isPending,
    })
  }

  return (
    <FormShell
      title={isNew ? 'New Purchase Order' : order?.doc_number ?? 'Purchase Order'}
      status={status}
      updatedAt={order?.updated_at}
      onBack={goBack}
      actions={actions}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6">
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
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">PO Date</label>
          <input type="date" disabled={!isEditable} {...register('doc_date')} className={inputClass} />
        </div>
      </div>

      <LineItemGrid control={control} setValue={setValue} name="lines" isPurchase disabled={!isEditable} />
      {errors.lines?.message && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.lines.message}</p>}

      {serverError && (
        <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
    </FormShell>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-paper)] disabled:text-[var(--color-ink-3)]'
