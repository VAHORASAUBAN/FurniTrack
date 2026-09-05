import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { signup } from '../../api/endpoints/auth'
import { PasswordInput } from '../../components/shared/PasswordInput'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import { AuthBrandPanel } from './AuthBrandPanel'

// Matches the wireframe's stated Sign Up rules exactly: login_id 6-12
// chars, email uniqueness is checked server-side (409 on conflict).
const schema = z
  .object({
    login_id: z.string().min(6, 'Login ID must be 6-12 characters').max(12, 'Login ID must be 6-12 characters'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirm: z.string(),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: 'Passwords do not match',
    path: ['password_confirm'],
  })
type FormValues = z.infer<typeof schema>

export function SignUpPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      await signup(values)
      navigate('/login', { replace: true, state: { justSignedUp: true } })
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
        quote="“Master data done right once means every invoice after it just works.”"
        caption="Accountant access — create contacts, products and documents from day one."
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brass)] to-[var(--color-accent)] font-display text-sm font-bold text-white">
              UF
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Create your account</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">Sets you up with Accountant access.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Login ID</label>
              <input
                {...register('login_id')}
                autoFocus
                placeholder="6-12 characters"
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.login_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.login_id.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Email ID</label>
              <input
                type="email"
                {...register('email')}
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Password</label>
                <PasswordInput
                  {...register('password')}
                  className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
                />
                {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password.message}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Re-Enter</label>
                <PasswordInput
                  {...register('password_confirm')}
                  className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
                />
                {errors.password_confirm && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password_confirm.message}</p>
                )}
              </div>
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
              {submitting ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-ink-3)]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[var(--color-accent)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
