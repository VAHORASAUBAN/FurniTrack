import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'

/** A password input with a show/hide toggle. Wraps whatever base className
 * the caller passes (the app has two slightly different input styles - the
 * auth pages' and the form pages') and reserves room for the eye icon via
 * an inline style rather than an appended Tailwind class, since two
 * conflicting padding utilities in one class string aren't guaranteed to
 * resolve in declaration order. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, style, ...props }, ref) {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={className}
          style={{ ...style, paddingRight: '2.25rem' }}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)] hover:text-[var(--color-ink)]"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    )
  }
)
