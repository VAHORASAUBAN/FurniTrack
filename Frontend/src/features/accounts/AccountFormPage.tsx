import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import {
  archiveAccount,
  createAccount,
  getAccount,
  unarchiveAccount,
  updateAccount,
} from '../../api/endpoints/accounts'
import { FormShell } from '../../components/shared/FormShell'
import { useGoBack } from '../../hooks/useGoBack'
import { useAuthStore } from '../../stores/authStore'
import { ACCOUNT_TYPE_LABELS } from '../../types/account'

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as (keyof typeof ACCOUNT_TYPE_LABELS)[]

const schema = z.object({
  code: z.string().min(1, 'Code is required').max(16),
  name: z.string().min(1, 'Name is required').max(128),
  account_type: z.enum(['ASSET', 'BANK', 'CASH', 'LIABILITY', 'CAPITAL', 'INCOME', 'EXPENSE', 'OTHER_EXPENSE']),
  is_receivable: z.boolean().optional(),
  is_payable: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

export function AccountFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const accountId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const goBack = useGoBack('/accounts')
  const queryClient = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: account, isLoading } = useQuery({
    queryKey: ['accounts', accountId],
    queryFn: () => getAccount(accountId as number),
    enabled: !isNew,
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: account
      ? {
          code: account.code,
          name: account.name,
          account_type: account.account_type,
          is_receivable: account.is_receivable,
          is_payable: account.is_payable,
        }
      : undefined,
    defaultValues: { account_type: 'ASSET' },
  })

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: (a) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      navigate(`/accounts/${a.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const updateMutation = useMutation({
    mutationFn: (values: Partial<FormValues>) => updateAccount(accountId as number, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: () => (account?.is_active ? archiveAccount(accountId as number) : unarchiveAccount(accountId as number)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['accounts', accountId] })
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
      title={isNew ? 'New Account' : account?.name ?? 'Account'}
      status={!isNew && account ? (account.is_active ? 'ACTIVE' : 'ARCHIVED') : undefined}
      onBack={goBack}
      actions={[
        ...(canArchive
          ? [
              {
                label: account?.is_active ? 'Archive' : 'Unarchive',
                onClick: () => archiveMutation.mutate(),
                variant: (account?.is_active ? 'danger' : 'secondary') as 'danger' | 'secondary',
              },
            ]
          : []),
        {
          label: createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save',
          onClick: handleSubmit(onSubmit),
          variant: 'primary',
          disabled: createMutation.isPending || updateMutation.isPending,
        },
      ]}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Account Code</label>
          <input {...register('code')} className={inputClass} />
          {errors.code && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.code.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Account Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Type</label>
          <select {...register('account_type')} className={inputClass}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex gap-6">
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] select-none">
          <input type="checkbox" {...register('is_receivable')} className="accent-[var(--color-accent)]" />
          This is the Receivable (Debtors) account
        </label>
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink-2)] select-none">
          <input type="checkbox" {...register('is_payable')} className="accent-[var(--color-accent)]" />
          This is the Payable (Creditors) account
        </label>
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
