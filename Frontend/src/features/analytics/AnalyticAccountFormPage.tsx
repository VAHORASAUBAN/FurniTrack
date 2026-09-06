import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, type DefaultValues } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import {
  archiveAnalyticAccount,
  createAnalyticAccount,
  getAnalyticAccount,
  unarchiveAnalyticAccount,
  updateAnalyticAccount,
} from '../../api/endpoints/analyticAccounts'
import { FormShell } from '../../components/shared/FormShell'
import { useGoBack } from '../../hooks/useGoBack'
import { useAuthStore } from '../../stores/authStore'
import { BudgetDrillDownModal } from '../budgets/BudgetDrillDownModal'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(128),
  analytic_type: z.enum(['INCOME', 'EXPENSE']),
})
type FormValues = z.infer<typeof schema>

export function AnalyticAccountFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const analyticId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/analytics')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState(false)

  const { data: analytic, isLoading } = useQuery({
    queryKey: ['analytic-accounts', analyticId],
    queryFn: () => getAnalyticAccount(analyticId as number),
    enabled: !isNew,
  })

  // Hoisted so the Clear button can pass this same object to reset()
  // explicitly - react-hook-form's `values` option (below) silently
  // overwrites its internal defaultValues with the loaded record once
  // `analytic` resolves, so a bare reset() on an edit page just reapplies
  // the currently-loaded record instead of blanking the form.
  const blankValues: DefaultValues<FormValues> = { analytic_type: 'EXPENSE' }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: analytic ? { name: analytic.name, analytic_type: analytic.analytic_type } : undefined,
    defaultValues: blankValues,
  })

  const createMutation = useMutation({
    mutationFn: createAnalyticAccount,
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ['analytic-accounts'] })
      navigate(`/analytics/${a.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<FormValues>) => updateAnalyticAccount(analyticId as number, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytic-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytic-accounts', analyticId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: () =>
      analytic?.is_active ? archiveAnalyticAccount(analyticId as number) : unarchiveAnalyticAccount(analyticId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytic-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['analytic-accounts', analyticId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    isNew ? createMutation.mutate(values) : updateMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const canArchive = role === 'ADMIN' && !isNew

  return (
    <FormShell
      title={isNew ? 'New Analytic Account' : analytic?.name ?? 'Analytic Account'}
      status={!isNew && analytic ? (analytic.is_active ? 'ACTIVE' : 'ARCHIVED') : undefined}
      onBack={goBack}
      actions={[
        ...(!isNew
          ? [{ label: 'View Transactions', onClick: () => setShowTransactions(true), variant: 'secondary' as const }]
          : []),
        ...(canArchive
          ? [
              {
                label: analytic?.is_active ? 'Archive' : 'Unarchive',
                onClick: () => archiveMutation.mutate(),
                variant: (analytic?.is_active ? 'danger' : 'secondary') as 'danger' | 'secondary',
              },
            ]
          : []),
        {
          label: createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save',
          onClick: handleSubmit(onSubmit),
          variant: 'primary',
          disabled: createMutation.isPending || updateMutation.isPending,
        },
        { label: 'Clear', onClick: () => reset(blankValues), variant: 'secondary' },
      ]}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Analytic Account Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Type</label>
          <select {...register('analytic_type')} className={inputClass}>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
          </select>
        </div>
      </div>

      {showTransactions && analytic && (
        <BudgetDrillDownModal
          analyticId={analytic.id}
          analyticName={analytic.name}
          onClose={() => setShowTransactions(false)}
        />
      )}

      {serverError && (
        <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
    </FormShell>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'
