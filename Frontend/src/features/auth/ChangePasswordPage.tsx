import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { changePassword } from '../../api/endpoints/auth'
import { PasswordInput } from '../../components/shared/PasswordInput'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import { useAuthStore } from '../../stores/authStore'
import { toast } from '../../stores/toastStore'
import { AuthBrandPanel } from './AuthBrandPanel'

const schema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    new_password_confirm: z.string(),
  })
  .refine((v) => v.new_password === v.new_password_confirm, {
    message: 'Passwords do not match',
    path: ['new_password_confirm'],
  })
type FormValues = z.infer<typeof schema>

/** Reachable two ways: voluntarily (Topbar's key icon, any role) and by
 * force — RequireRole redirects here whenever must_change_password is set,
 * which is how a portal user's one-time password (contact_service) leads to
 * a real, self-chosen credential. Sits outside every RequireRole-guarded
 * route so it renders even while that flag is still true. */
export function ChangePasswordPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (!user) {
    return <Navigate to="/login" replace />
  }
  const homePath = user.role === 'PORTAL' ? '/portal' : '/'

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      await changePassword(values)
      useAuthStore.setState((s) => (s.user ? { user: { ...s.user, must_change_password: false } } : {}))
      toast.success('Password changed.')
      navigate(homePath, { replace: true })
    } catch (err) {
      setServerError(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen bg-[var(--color-paper)]">
      <div className="absolute right-5 top-5 z-10">
        <ThemeToggle />
      </div>
      <AuthBrandPanel
        quote="“A password handed to you once should never be the one you keep.”"
        caption="Changing your password signs you out everywhere else, too."
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Change your password
          </h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">
            {user.must_change_password
              ? "You're signed in with a one-time password — set your own before continuing."
              : 'Choose something you haven\'t used before.'}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Current password</label>
              <PasswordInput
                {...register('current_password')}
                autoFocus
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.current_password && (
                <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.current_password.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">New password</label>
              <PasswordInput
                {...register('new_password')}
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.new_password && (
                <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.new_password.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Confirm new password</label>
              <PasswordInput
                {...register('new_password_confirm')}
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.new_password_confirm && (
                <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.new_password_confirm.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-md bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>

          {!user.must_change_password && (
            <p className="mt-6 text-center text-sm text-[var(--color-ink-3)]">
              <Link to={homePath} className="font-semibold text-[var(--color-accent)] hover:underline">
                Cancel and go back
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
