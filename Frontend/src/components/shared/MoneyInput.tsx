import { forwardRef, type InputHTMLAttributes } from 'react'

/** Design doc §7.4 — 2-decimal money input that emits a string, never a
 * number, so the value that reaches react-hook-form (and from there the
 * API) is always the exact digits the user typed — no float coercion at
 * any point on the client side. */
export const MoneyInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function MoneyInput({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        className={
          className ??
          'w-full rounded-md border border-[var(--color-rule-2)] px-3 py-2 text-right font-mono text-sm outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]'
        }
        {...props}
      />
    )
  }
)
