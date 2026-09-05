import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { accountOptions } from '../../api/endpoints/accounts'
import { analyticAccountOptions } from '../../api/endpoints/analyticAccounts'
import { getApiErrorMessage } from '../../api/client'
import { contactOptions } from '../../api/endpoints/contacts'
import {
  cancelJournalEntry,
  createJournalEntry,
  deleteJournalEntry,
  getJournalEntry,
  postJournalEntry,
  resetJournalEntryToDraft,
  updateJournalEntry,
} from '../../api/endpoints/journalEntries'
import { journalOptions } from '../../api/endpoints/journals'
import { FormShell } from '../../components/shared/FormShell'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { MoneyInput } from '../../components/shared/MoneyInput'
import { useGoBack } from '../../hooks/useGoBack'
import { formatMoney } from '../../lib/money'
import { openPdf } from '../../lib/pdf'
import { useAuthStore } from '../../stores/authStore'

const moneyString = z.string().regex(/^\d*(\.\d{1,2})?$/, 'Enter a valid amount')

const lineSchema = z.object({
  account_id: z.number().min(1, 'Select an account'),
  partner_id: z.number().nullable().optional(),
  analytic_account_id: z.number().nullable().optional(),
  label: z.string().optional(),
  debit: moneyString,
  credit: moneyString,
})

const schema = z.object({
  journal_id: z.number().min(1, 'Select a journal'),
  entry_date: z.string().min(1, 'Required'),
  reference: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line is required'),
})
type FormValues = z.infer<typeof schema>

const emptyLine = { account_id: 0, partner_id: null, analytic_account_id: null, label: '', debit: '0', credit: '0' }

function toNum(v: string | undefined): number {
  const n = Number.parseFloat(v || '0')
  return Number.isNaN(n) ? 0 : n
}

export function JournalEntryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const entryId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/journal-entries')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entries', entryId],
    queryFn: () => getJournalEntry(entryId as number),
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
    values: entry
      ? {
          journal_id: entry.journal_id,
          entry_date: entry.entry_date,
          reference: entry.reference ?? '',
          narration: entry.narration ?? '',
          lines: entry.lines.map((l) => ({
            account_id: l.account_id,
            partner_id: l.partner_id,
            analytic_account_id: l.analytic_account_id,
            label: l.label ?? '',
            debit: l.debit,
            credit: l.credit,
          })),
        }
      : undefined,
    defaultValues: {
      entry_date: new Date().toISOString().slice(0, 10),
      lines: [{ ...emptyLine }, { ...emptyLine }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const watchedLines = useWatch({ control, name: 'lines' }) ?? []

  const totalDebit = watchedLines.reduce((sum, l) => sum + toNum(l?.debit), 0)
  const totalCredit = watchedLines.reduce((sum, l) => sum + toNum(l?.credit), 0)
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100
  const isBalanced = difference === 0

  const status = entry?.status
  const isEditable = isNew || status === 'DRAFT'
  const canManage = role === 'ADMIN'

  function clearAndGo(updated: { id: number }) {
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
    queryClient.invalidateQueries({ queryKey: ['journal-entries', updated.id] })
  }

  const createMutation = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: (je) => {
      clearAndGo(je)
      navigate(`/journal-entries/${je.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<FormValues>) => updateJournalEntry(entryId as number, values),
    onSuccess: (je) => {
      clearAndGo(je)
      setServerError(null)
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const postMutation = useMutation({
    mutationFn: () => postJournalEntry(entryId as number),
    onSuccess: (je) => {
      clearAndGo(je)
      setServerError(null)
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelJournalEntry(entryId as number),
    onSuccess: (je) => {
      clearAndGo(je)
      navigate(`/journal-entries/${je.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const resetMutation = useMutation({
    mutationFn: () => resetJournalEntryToDraft(entryId as number),
    onSuccess: (je) => {
      clearAndGo(je)
      setServerError(null)
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteJournalEntry(entryId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      navigate('/journal-entries')
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSave(values: FormValues) {
    setServerError(null)
    isNew ? createMutation.mutate(values) : updateMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  const actions = []
  if (isEditable) {
    actions.push({
      label: updateMutation.isPending || createMutation.isPending ? 'Saving…' : 'Save',
      onClick: handleSubmit(onSave),
      variant: 'secondary' as const,
      disabled: updateMutation.isPending || createMutation.isPending,
    })
    actions.push({ label: 'Clear', onClick: () => reset(), variant: 'secondary' as const })
  }
  if (!isNew) {
    actions.push({ label: 'Print', onClick: () => openPdf(`/journal-entries/${entryId}/pdf`), variant: 'secondary' as const })
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
  if (!isNew && status === 'POSTED' && canManage) {
    actions.push({
      label: 'Reset to Draft',
      onClick: () => resetMutation.mutate(),
      variant: 'secondary' as const,
      disabled: resetMutation.isPending,
    })
    actions.push({
      label: cancelMutation.isPending ? 'Cancelling…' : 'Cancel (Reverse)',
      onClick: () => cancelMutation.mutate(),
      variant: 'danger' as const,
      disabled: cancelMutation.isPending,
    })
  }

  return (
    <FormShell
      title={isNew ? 'New Journal Entry' : entry?.entry_number ?? 'Journal Entry'}
      status={status}
      onBack={goBack}
      actions={actions}
    >
      <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Journal</label>
          <Controller
            name="journal_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="journals"
                fetchOptions={journalOptions}
                placeholder="Select a journal…"
              />
            )}
          />
          {errors.journal_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.journal_id.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Accounting Date</label>
          <input type="date" disabled={!isEditable} {...register('entry_date')} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Reference</label>
          <input disabled={!isEditable} {...register('reference')} className={inputClass} placeholder="Optional" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--color-rule)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-rule)] bg-[var(--color-paper)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-3)]">
              <th className="px-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Partner</th>
              <th className="px-3 py-2">Analytic</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Credit</th>
              {isEditable && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id} className="border-b border-[var(--color-rule)] last:border-0">
                <td className="px-3 py-2 text-[var(--color-ink-3)]">{index + 1}</td>
                <td className="px-3 py-2 min-w-[180px]">
                  <Controller
                    name={`lines.${index}.account_id`}
                    control={control}
                    render={({ field }) => (
                      <Many2OneSelect
                        value={field.value || null}
                        onChange={field.onChange}
                        queryKey="accounts"
                        fetchOptions={accountOptions}
                        placeholder="Account…"
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <Controller
                    name={`lines.${index}.partner_id`}
                    control={control}
                    render={({ field }) => (
                      <Many2OneSelect
                        value={field.value}
                        onChange={field.onChange}
                        queryKey="contacts"
                        fetchOptions={contactOptions}
                        placeholder="—"
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2 min-w-[160px]">
                  <Controller
                    name={`lines.${index}.analytic_account_id`}
                    control={control}
                    render={({ field }) => (
                      <Many2OneSelect
                        value={field.value}
                        onChange={field.onChange}
                        queryKey="analytic-accounts"
                        fetchOptions={analyticAccountOptions}
                        placeholder="—"
                      />
                    )}
                  />
                </td>
                <td className="px-3 py-2 min-w-[140px]">
                  <input disabled={!isEditable} {...register(`lines.${index}.label`)} className={inputClass} />
                </td>
                <td className="px-3 py-2 w-32">
                  <MoneyInput disabled={!isEditable} {...register(`lines.${index}.debit`)} />
                </td>
                <td className="px-3 py-2 w-32">
                  <MoneyInput disabled={!isEditable} {...register(`lines.${index}.credit`)} />
                </td>
                {isEditable && (
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-[var(--color-ink-3)] hover:text-[var(--color-danger)]"
                      aria-label="Remove line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
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

      <div className="mt-5 flex justify-end">
        <div className="w-72 rounded-md border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 text-sm">
          <div className="flex justify-between py-0.5">
            <span className="text-[var(--color-ink-2)]">Total Debit</span>
            <span className="font-mono">{formatMoney(totalDebit.toFixed(2))}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-[var(--color-ink-2)]">Total Credit</span>
            <span className="font-mono">{formatMoney(totalCredit.toFixed(2))}</span>
          </div>
          <div
            className={`mt-1 flex justify-between border-t border-[var(--color-rule-2)] pt-1.5 font-semibold ${
              isBalanced ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
            }`}
          >
            <span>{isBalanced ? 'Balanced' : 'Difference'}</span>
            <span className="font-mono">{isBalanced ? '✓' : formatMoney(Math.abs(difference).toFixed(2))}</span>
          </div>
        </div>
      </div>

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
