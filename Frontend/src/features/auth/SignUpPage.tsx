import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { getApiErrorMessage } from '../../api/client'
import { signup } from '../../api/endpoints/auth'

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">Urban Furniture</div>
          <div className="text-sm text-[var(--color-ink-2)]">Create your Accountant account</div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Login ID</label>
            <input
              {...register('login_id')}
              autoFocus
              placeholder="6-12 characters"
              className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {errors.login_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.login_id.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Email ID</label>
            <input
              type="email"
              {...register('email')}
              className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Re-Enter Password</label>
            <input
              type="password"
              {...register('password_confirm')}
              className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {errors.password_confirm && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password_confirm.message}</p>
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
            className="mt-2 rounded-md bg-[var(--color-accent)] py-2 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--color-ink-3)]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
