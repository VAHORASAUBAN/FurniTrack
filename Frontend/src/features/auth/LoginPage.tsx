import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { login } from '../../api/endpoints/auth'
import { getApiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import { AuthBrandPanel } from './AuthBrandPanel'

const schema = z.object({
  login_id: z.string().min(1, 'Login ID is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const justSignedUp = Boolean((location.state as { justSignedUp?: boolean } | null)?.justSignedUp)
  const setSession = useAuthStore((s) => s.setSession)
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showForgotNote, setShowForgotNote] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      const resp = await login(values)
      setSession(resp.access_token, resp.refresh_token, resp.user)
      navigate(resp.user.role === 'PORTAL' ? '/portal' : '/', { replace: true })
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
        quote="“A ledger that doesn't balance isn't finished — it's just wrong somewhere you haven't looked yet.”"
        caption="Every posted entry, checked twice: once by the engine, once by the books."
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brass)] to-[var(--color-accent)] font-display text-sm font-bold text-white">
              UF
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Welcome back</h1>
          <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">Sign in to continue to the ledger.</p>

          {justSignedUp && (
            <div className="mt-5 rounded-md bg-[var(--color-success-bg)] px-3 py-2 text-sm text-[var(--color-success)]">
              Account created — sign in below.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Login ID</label>
              <input
                {...register('login_id')}
                autoFocus
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.login_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.login_id.message}</p>}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--color-ink)]">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotNote((v) => !v)}
                  className="text-xs font-medium text-[var(--color-ink-3)] hover:text-[var(--color-accent)]"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                {...register('password')}
                className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
              />
              {errors.password && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.password.message}</p>}
              {showForgotNote && (
                <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">
                  Password reset isn't available yet — contact your Admin to reset it.
                </p>
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
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-ink-3)]">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-[var(--color-accent)] hover:underline">
              Create an account
            </Link>
          </p>

          <p className="mt-8 rounded-md border border-dashed border-[var(--color-rule-2)] px-3 py-2 text-center text-xs text-[var(--color-ink-3)]">
            Seeded admin: <code className="font-mono text-[var(--color-ink-2)]">admin</code> /{' '}
            <code className="font-mono text-[var(--color-ink-2)]">Admin@12345</code>
          </p>
        </div>
      </div>
    </div>
  )
}
