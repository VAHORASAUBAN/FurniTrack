/** Left-hand brand panel shared by Login and Sign Up — the split-screen
 * gives the auth flow a real first impression instead of a bare centred
 * card. Hidden below `lg` so mobile just gets the form. */
export function AuthBrandPanel({ quote, caption }: { quote: string; caption: string }) {
  return (
    <div className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-[var(--color-sidebar)] px-12 py-12 lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 12%, rgba(169,118,47,0.20), transparent 45%), radial-gradient(circle at 82% 88%, rgba(40,94,72,0.35), transparent 50%)',
        }}
      />

      <div className="relative flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brass)] to-[var(--color-accent)] font-display text-sm font-bold text-white">
          UF
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-semibold tracking-tight text-[var(--color-sidebar-ink)]">
            Urban Furniture
          </span>
          <span className="mt-0.5 text-[10.5px] uppercase tracking-wider text-[var(--color-sidebar-ink-2)]">
            Ledger &amp; Accounts
          </span>
        </div>
      </div>

      <div className="relative flex flex-col gap-8">
        <BalanceGlyph />
        <div>
          <p className="font-display text-[26px] font-medium leading-snug tracking-tight text-[var(--color-sidebar-ink)]">
            {quote}
          </p>
          <p className="mt-4 text-sm text-[var(--color-sidebar-ink-2)]">{caption}</p>
        </div>
      </div>

      <div className="relative flex items-center gap-6 text-[11px] uppercase tracking-wider text-[var(--color-sidebar-ink-2)]">
        <span>Double-entry</span>
        <span className="h-1 w-1 rounded-full bg-[var(--color-sidebar-ink-2)]" />
        <span>Role-scoped</span>
        <span className="h-1 w-1 rounded-full bg-[var(--color-sidebar-ink-2)]" />
        <span>Always balanced</span>
      </div>
    </div>
  )
}

/** Hand-authored motif: a ledger scale — Debit and Credit columns rising to
 * meet a level beam, standing in for the one invariant the whole system is
 * built to protect. */
function BalanceGlyph() {
  return (
    <figure>
      <svg viewBox="0 0 280 150" role="img" aria-label="A balance scale showing debit and credit columns level with each other" className="h-auto w-56">
        <defs>
          <linearGradient id="barGreen" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#285e48" />
            <stop offset="100%" stopColor="#57a884" />
          </linearGradient>
          <linearGradient id="barBrass" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#8c611f" />
            <stop offset="100%" stopColor="#d6a655" />
          </linearGradient>
        </defs>

        <line x1="20" y1="128" x2="260" y2="128" stroke="#8f8371" strokeWidth="1" opacity="0.5" />

        <line x1="140" y1="18" x2="140" y2="128" stroke="#8f8371" strokeWidth="1.5" opacity="0.6" />
        <line x1="66" y1="34" x2="214" y2="34" stroke="#ede4d3" strokeWidth="2" />
        <circle cx="140" cy="34" r="3.5" fill="#ede4d3" />

        <line x1="66" y1="34" x2="66" y2="66" stroke="#8f8371" strokeWidth="1" opacity="0.7" />
        <line x1="214" y1="34" x2="214" y2="66" stroke="#8f8371" strokeWidth="1" opacity="0.7" />

        <g>
          <rect x="40" y="80" width="16" height="48" rx="2" fill="url(#barGreen)" />
          <rect x="60" y="66" width="16" height="62" rx="2" fill="url(#barGreen)" />
          <rect x="80" y="92" width="16" height="36" rx="2" fill="url(#barGreen)" />
        </g>

        <g>
          <rect x="184" y="92" width="16" height="36" rx="2" fill="url(#barBrass)" />
          <rect x="204" y="66" width="16" height="62" rx="2" fill="url(#barBrass)" />
          <rect x="224" y="80" width="16" height="48" rx="2" fill="url(#barBrass)" />
        </g>

        <text x="68" y="144" fontSize="11" fill="#b5a893" fontFamily="'IBM Plex Mono', monospace" letterSpacing="1.5">
          DEBIT
        </text>
        <text x="196" y="144" fontSize="11" fill="#b5a893" fontFamily="'IBM Plex Mono', monospace" letterSpacing="1.5">
          CREDIT
        </text>
      </svg>
      <figcaption className="sr-only">A balance scale illustration with matching debit and credit columns</figcaption>
    </figure>
  )
}
