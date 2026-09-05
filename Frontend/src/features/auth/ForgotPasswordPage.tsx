import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { forgotPassword } from '../../api/endpoints/auth'
import { getApiErrorMessage } from '../../api/client'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import { AuthBrandPanel } from './AuthBrandPanel'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
})
type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setServerError(null)
    setSubmitting(true)
    try {
      await forgotPassword(values.email)
      setSent(true)
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
        quote="“Losing a password shouldn't mean losing the books.”"
        caption="A reset link is one-time use and expires in 30 minutes."
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)]">
                <MailCheck size={22} />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                Check your inbox
              </h1>
              <p className="mt-2 text-sm text-[var(--color-ink-3)]">
                If that email is registered, we've sent instructions to reset your password. The link
                expires in 30 minutes.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-semibold text-[var(--color-accent)] hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                Forgot your password?
              </h1>
              <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">
                Enter the email on your account and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[var(--color-ink)]">Email</label>
                  <input
                    type="email"
                    {...register('email')}
                    autoFocus
                    className="w-full rounded-md border border-[var(--color-rule-2)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none transition-shadow focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-bg)]"
                  />
                  {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email.message}</p>}
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
                  {submitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[var(--color-ink-3)]">
                <Link to="/login" className="font-semibold text-[var(--color-accent)] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
