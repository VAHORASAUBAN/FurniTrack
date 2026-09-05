import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { accountOptions } from '../../api/endpoints/accounts'
import { getApiErrorMessage } from '../../api/client'
import {
  archiveJournal,
  createJournal,
  getJournal,
  unarchiveJournal,
  updateJournal,
} from '../../api/endpoints/journals'
import { FormShell } from '../../components/shared/FormShell'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { useGoBack } from '../../hooks/useGoBack'
import { useAuthStore } from '../../stores/authStore'
import { JOURNAL_TYPE_LABELS } from '../../types/journal'

const JOURNAL_TYPES = Object.keys(JOURNAL_TYPE_LABELS) as (keyof typeof JOURNAL_TYPE_LABELS)[]

const schema = z.object({
  code: z.string().min(1, 'Code is required').max(16),
  name: z.string().min(1, 'Name is required').max(128),
  journal_type: z.enum(['SALES', 'PURCHASE', 'BANK', 'CASH', 'MISC']),
  default_account_id: z.number().nullable().optional(),
})
type FormValues = z.infer<typeof schema>

export function JournalFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const journalId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/journals')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: journal, isLoading } = useQuery({
    queryKey: ['journals', journalId],
    queryFn: () => getJournal(journalId as number),
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
    values: journal
      ? {
          code: journal.code,
          name: journal.name,
          journal_type: journal.journal_type,
          default_account_id: journal.default_account_id,
        }
      : undefined,
    defaultValues: { journal_type: 'MISC' },
  })

  const createMutation = useMutation({
    mutationFn: createJournal,
    onSuccess: (j) => {
      queryClient.invalidateQueries({ queryKey: ['journals'] })
      navigate(`/journals/${j.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<FormValues>) => updateJournal(journalId as number, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals'] })
      queryClient.invalidateQueries({ queryKey: ['journals', journalId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: () => (journal?.is_active ? archiveJournal(journalId as number) : unarchiveJournal(journalId as number)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journals'] })
      queryClient.invalidateQueries({ queryKey: ['journals', journalId] })
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
      title={isNew ? 'New Journal' : journal?.name ?? 'Journal'}
      status={!isNew && journal ? (journal.is_active ? 'ACTIVE' : 'ARCHIVED') : undefined}
      onBack={goBack}
      actions={[
        ...(canArchive
          ? [
              {
                label: journal?.is_active ? 'Archive' : 'Unarchive',
                onClick: () => archiveMutation.mutate(),
                variant: (journal?.is_active ? 'danger' : 'secondary') as 'danger' | 'secondary',
              },
            ]
          : []),
        {
          label: createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save',
          onClick: handleSubmit(onSubmit),
          variant: 'primary',
          disabled: createMutation.isPending || updateMutation.isPending,
        },
        { label: 'Clear', onClick: () => reset(), variant: 'secondary' },
      ]}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Journal Code</label>
          <input {...register('code')} className={inputClass} />
          {errors.code && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.code.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Journal Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Type</label>
          <select {...register('journal_type')} className={inputClass}>
            {JOURNAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {JOURNAL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Default Account</label>
          <Controller
            name="default_account_id"
            control={control}
            render={({ field }) => (
              <Many2OneSelect
                value={field.value}
                onChange={field.onChange}
                queryKey="accounts"
                fetchOptions={accountOptions}
                placeholder="Select an account…"
              />
            )}
          />
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
  'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'
