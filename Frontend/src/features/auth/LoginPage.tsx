import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { login } from '../../api/endpoints/auth'
import { getApiErrorMessage } from '../../api/client'
import { useAuthStore } from '../../stores/authStore'

const schema = z.object({
  login_id: z.string().min(1, 'Login ID is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-rule)] bg-[var(--color-surface)] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">Urban Furniture</div>
          <div className="text-sm text-[var(--color-ink-2)]">Accounting System</div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Login ID</label>
            <input
              {...register('login_id')}
              autoFocus
              className="w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
            {errors.login_id && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.login_id.message}</p>}
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-[var(--color-ink-3)]">
          Seeded admin: <code>admin</code> / <code>Admin@12345</code>
        </p>
      </div>
    </div>
  )
}
