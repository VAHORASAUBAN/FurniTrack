import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { resetPassword } from '../../api/endpoints/auth'
import { getApiErrorMessage } from '../../api/client'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import { AuthBrandPanel } from './AuthBrandPanel'

const schema = z
  .object({
    new_password: z.string().min(8, 'Password must be at least 8 characters'),
    new_password_confirm: z.string(),
  })
  .refine((v) => v.new_password === v.new_password_confirm, {
    message: 'Passwords do not match',
    path: ['new_password_confirm'],
  })
type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    if (!token) return
    setServerError(null)
    setSubmitting(true)
    try {
      await resetPassword({ token, ...values })
      navigate('/login', { replace: true, state: { passwordWasReset: true } })
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
        quote="“One new password, and every open session starts clean.”"
        caption="Resetting your password signs you out everywhere else, too."
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {!token ? (
            <div className="text-center">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                Link missing or incomplete
              </h1>
              <p className="mt-2 text-sm text-[var(--color-ink-3)]">
                This page needs a reset link's token — open the link from your email again, or request a
                new one.
              </p>
              <Link
                to="/forgot-password"
                className="mt-6 inline-block text-sm font-semibold text-[var(--color-accent)] hover:underline"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                Set a new password
              </h1>
              <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">Choose something you haven't used before.</p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">New password</label>
                  <input
                    type="password"
                    {...register('new_password')}
                    autoFocus
                    className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
                  />
                  {errors.new_password && (
                    <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.new_password.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Confirm password</label>
                  <input
                    type="password"
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
