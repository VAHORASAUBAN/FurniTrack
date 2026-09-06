import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { analyticAccountOptions } from '../../api/endpoints/analyticAccounts'
import { getApiErrorMessage } from '../../api/client'
import {
  cancelBudget,
  confirmBudget,
  createBudget,
  deleteBudget,
  getBudget,
  reviseBudget,
  updateBudget,
} from '../../api/endpoints/budgets'
import { contactOptions } from '../../api/endpoints/contacts'
import { FormShell } from '../../components/shared/FormShell'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { MoneyInput } from '../../components/shared/MoneyInput'
import { useGoBack } from '../../hooks/useGoBack'
import { formatMoney } from '../../lib/money'
import { useAuthStore } from '../../stores/authStore'
import { BudgetDrillDownModal } from './BudgetDrillDownModal'

const lineSchema = z.object({
  analytic_account_id: z.number().min(1, 'Select an analytic account'),
  analytic_type: z.enum(['INCOME', 'EXPENSE']),
  planned_amount: z.string().regex(/^\d*\.?\d*$/, 'Invalid'),
})

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  start_date: z.string().min(1, 'Required'),
  end_date: z.string().min(1, 'Required'),
  responsible_contact_id: z.number().nullable().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line is required'),
})
type FormValues = z.infer<typeof schema>

const emptyLine = { analytic_account_id: 0, analytic_type: 'EXPENSE' as const, planned_amount: '0' }

export function BudgetFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const budgetId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/budgets')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)
  const [drillDownLineIndex, setDrillDownLineIndex] = useState<number | null>(null)

  const { data: budget, isLoading } = useQuery({
    queryKey: ['budgets', budgetId],
    queryFn: () => getBudget(budgetId as number),
    enabled: !isNew,
  })

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: budget
      ? {
          name: budget.name,
          start_date: budget.start_date,
          end_date: budget.end_date,
          responsible_contact_id: budget.responsible_contact_id,
          lines: budget.lines.map((l) => ({
            analytic_account_id: l.analytic_account_id,
            analytic_type: l.analytic_type,
            planned_amount: l.planned_amount,
          })),
        }
      : undefined,
    defaultValues: { lines: [{ ...emptyLine }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['budgets'] })
    queryClient.invalidateQueries({ queryKey: ['budgets', budgetId] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => (isNew ? createBudget(values) : updateBudget(budgetId as number, values)),
    onSuccess: (b) => {
      invalidate()
      if (isNew) navigate(`/budgets/${b.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmBudget(budgetId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelBudget(budgetId as number),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const reviseMutation = useMutation({
    mutationFn: () => reviseBudget(budgetId as number),
    onSuccess: (revised) => {
      invalidate()
      navigate(`/budgets/${revised.id}`)
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteBudget(budgetId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
      navigate('/budgets')
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSave(values: FormValues) {
    setServerError(null)
    saveMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const status = budget?.status
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
    actions.push({ label: 'Clear', onClick: () => reset(), variant: 'secondary' as const })
  }
  if (!isNew && status === 'DRAFT') {
    actions.push({
      label: 'Confirm', onClick: () => confirmMutation.mutate(), variant: 'primary' as const,
      disabled: confirmMutation.isPending,
    })
    actions.push({
      label: deleteMutation.isPending ? 'Deleting…' : 'Delete',
      onClick: () => deleteMutation.mutate(),
      variant: 'danger' as const,
      disabled: deleteMutation.isPending,
    })
  }
  if (!isNew && status === 'CONFIRMED') {
    actions.push({
      label: reviseMutation.isPending ? 'Revising…' : 'Revise',
      onClick: () => reviseMutation.mutate(),
      variant: 'secondary' as const,
      disabled: reviseMutation.isPending,
    })
  }
  if (!isNew && status !== 'CANCELLED' && canManage) {
    actions.push({
      label: cancelMutation.isPending ? 'Cancelling…' : 'Cancel', onClick: () => cancelMutation.mutate(),
      variant: 'danger' as const, disabled: cancelMutation.isPending,
    })
  }

  return (
    <FormShell
      title={isNew ? 'New Budget' : budget?.name ?? 'Budget'}
      status={status}
      updatedAt={budget?.updated_at}
      onBack={goBack}
      actions={actions}
    >
      {budget?.revises_budget_id && (
        <button
          onClick={() => navigate(`/budgets/${budget.revises_budget_id}`)}
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          ← View original Budget
        </button>
      )}

      <div className="grid grid-cols-4 gap-x-6 gap-y-4 mb-6">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Budget Name</label>
          <input disabled={!isEditable} {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Start Date</label>
          <input type="date" disabled={!isEditable} {...register('start_date')} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">End Date</label>
          <input type="date" disabled={!isEditable} {...register('end_date')} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Responsible</label>
          <Controller
            name="responsible_contact_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="contacts"
                fetchOptions={contactOptions}
                placeholder="Select a responsible contact…"
              />
            )}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--color-rule)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
              <th className="px-3 py-2 min-w-[160px]">Analytic Account</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Planned</th>
              {!isNew && <th className="px-3 py-2 text-right">Achieved</th>}
              {!isNew && <th className="px-3 py-2 min-w-[140px]">Progress</th>}
              {!isNew && <th className="px-3 py-2 text-right">Remaining</th>}
              {isEditable && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const existingLine = budget?.lines[index]
              const pct = existingLine ? Math.min(100, Math.max(0, Number.parseFloat(existingLine.achieved_pct))) : 0
              return (
                <tr key={field.id} className="border-b border-[var(--color-rule)] last:border-0">
                  <td className="px-3 py-2">
                    <Controller
                      name={`lines.${index}.analytic_account_id`}
                      control={control}
                      render={({ field: f }) => (
                        <Many2OneSelect
                          value={f.value}
                          onChange={f.onChange}
                          queryKey="analytic-accounts"
                          fetchOptions={analyticAccountOptions}
                          placeholder="Select…"
                        />
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select disabled={!isEditable} {...register(`lines.${index}.analytic_type`)} className={inputClass}>
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 w-32">
                    <MoneyInput disabled={!isEditable} {...register(`lines.${index}.planned_amount`)} />
                  </td>
                  {!isNew && (
                    <td className="px-3 py-2 text-right font-mono text-[var(--color-ink-2)]">
                      {existingLine ? (
                        <button
                          type="button"
                          onClick={() => setDrillDownLineIndex(index)}
                          className="underline decoration-dotted underline-offset-2 hover:text-[var(--color-accent)]"
                          title="See the posted documents behind this figure"
                        >
                          {formatMoney(existingLine.achieved_amount)}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  {!isNew && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-rule)]">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-accent)]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-[var(--color-ink-3)]">
                          {existingLine ? `${existingLine.achieved_pct}%` : '—'}
                        </span>
                      </div>
                    </td>
                  )}
                  {!isNew && (
                    <td className="px-3 py-2 text-right font-mono text-[var(--color-ink-2)]">
                      {existingLine ? formatMoney(existingLine.remaining) : '—'}
                    </td>
                  )}
                  {isEditable && (
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => remove(index)} className="text-[var(--color-ink-3)] hover:text-[var(--color-danger)]" aria-label="Remove line">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isEditable && (
        <button
          type="button"
          onClick={() => append({ ...emptyLine })}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
        >
          <Plus size={15} /> Add line
        </button>
      )}
      {errors.lines?.message && <p className="mt-2 text-xs text-[var(--color-danger)]">{errors.lines.message}</p>}

      {serverError && (
        <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}

      {budget && drillDownLineIndex !== null && budget.lines[drillDownLineIndex] && (
        <BudgetDrillDownModal
          analyticId={budget.lines[drillDownLineIndex].analytic_account_id}
          analyticName={budget.lines[drillDownLineIndex].analytic_name}
          dateFrom={budget.start_date}
          dateTo={budget.end_date}
          onClose={() => setDrillDownLineIndex(null)}
        />
      )}
    </FormShell>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] disabled:bg-[var(--color-paper)] disabled:text-[var(--color-ink-3)]'
