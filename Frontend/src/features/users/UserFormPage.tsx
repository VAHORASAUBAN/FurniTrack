import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { contactOptions } from '../../api/endpoints/contacts'
import { archiveUser, createUser, getUser, unarchiveUser } from '../../api/endpoints/users'
import { FormShell } from '../../components/shared/FormShell'
import { Many2OneSelect } from '../../components/shared/Many2OneSelect'
import { USER_ROLE_LABELS } from '../../types/user'

// Wireframe's stated Create User rules: login_id 6-12 chars, unique
// (server-checked), email uniqueness (server-checked), Re-Enter Password
// must match.
const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    login_id: z.string().min(6, 'Login ID must be 6-12 characters').max(12, 'Login ID must be 6-12 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirm: z.string(),
    role: z.enum(['ADMIN', 'ACCOUNTANT', 'PORTAL']),
    contact_id: z.number().nullable().optional(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: 'Passwords do not match',
    path: ['password_confirm'],
  })
  .refine((v) => v.role !== 'PORTAL' || v.contact_id != null, {
    message: 'Select the Contact this portal user belongs to',
    path: ['contact_id'],
  })
type FormValues = z.infer<typeof schema>

export function UserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = id === 'new'
  const userId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const { data: existingUser, isLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => getUser(userId as number),
    enabled: !isNew,
  })

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'ACCOUNTANT' },
  })
  const role = useWatch({ control, name: 'role' })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
    queryClient.invalidateQueries({ queryKey: ['users', userId] })
  }

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (u) => {
      invalidate()
      navigate(`/settings/users/${u.id}`, { replace: true })
    },
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  const archiveMutation = useMutation({
    mutationFn: () => (existingUser?.is_active ? archiveUser(userId as number) : unarchiveUser(userId as number)),
    onSuccess: invalidate,
    onError: (err) => setServerError(getApiErrorMessage(err)),
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    createMutation.mutate(values)
  }

  if (!isNew && isLoading) return <div className="py-12 text-center text-[var(--color-ink-3)]">Loading…</div>

  // No PATCH /users/{id} exists (design scope: create + archive/unarchive
  // only, matching the wireframe's Create User form) — an existing user is
  // read-only here.
  if (!isNew && existingUser) {
    return (
      <FormShell
        title={existingUser.name}
        status={existingUser.is_active ? 'ACTIVE' : 'ARCHIVED'}
        onBack={() => navigate('/settings/users')}
        actions={[
          {
            label: existingUser.is_active ? 'Archive' : 'Unarchive',
            onClick: () => archiveMutation.mutate(),
            variant: existingUser.is_active ? 'danger' : 'secondary',
            disabled: archiveMutation.isPending,
          },
        ]}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Login ID</div>
            <div className="font-mono text-sm">{existingUser.login_id}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Email</div>
            <div className="text-sm">{existingUser.email}</div>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Role</div>
            <div className="text-sm">{USER_ROLE_LABELS[existingUser.role]}</div>
          </div>
          {existingUser.contact_id && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-3)]">Linked Contact</div>
              <div className="text-sm">#{existingUser.contact_id}</div>
            </div>
          )}
        </div>
        {serverError && (
          <div className="mt-4 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
      </FormShell>
    )
  }

  return (
    <FormShell
      title="Create User"
      onBack={() => navigate('/settings/users')}
      actions={[
        {
          label: createMutation.isPending ? 'Creating…' : 'Create',
          onClick: handleSubmit(onSubmit),
          variant: 'primary',
          disabled: createMutation.isPending,
        },
      ]}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Role</label>
          <select {...register('role')} className={inputClass}>
            <option value="ADMIN">{USER_ROLE_LABELS.ADMIN}</option>
            <option value="ACCOUNTANT">{USER_ROLE_LABELS.ACCOUNTANT}</option>
            <option value="PORTAL">{USER_ROLE_LABELS.PORTAL}</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Login ID</label>
          <input {...register('login_id')} placeholder="6-12 characters" className={inputClass} />
          {errors.login_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.login_id.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">E-mail ID</label>
          <input type="email" {...register('email')} className={inputClass} />
          {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Password</label>
          <input type="password" {...register('password')} className={inputClass} />
          {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Re-Enter Password</label>
          <input type="password" {...register('password_confirm')} className={inputClass} />
          {errors.password_confirm && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password_confirm.message}</p>
          )}
        </div>

        {role === 'PORTAL' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Linked Contact</label>
            <Controller
              name="contact_id"
              control={control}
              render={({ field }) => (
                <Many2OneSelect
                  value={field.value}
                  onChange={field.onChange}
                  queryKey="contacts"
                  fetchOptions={contactOptions}
                  placeholder="Select the contact this login belongs to…"
                />
              )}
            />
            {errors.contact_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.contact_id.message}</p>}
          </div>
        )}
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
