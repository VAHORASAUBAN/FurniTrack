import { Moon, Monitor, Sun } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '../../stores/themeStore'

const OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: 'light', icon: Sun, label: 'Light theme' },
  { mode: 'system', icon: Monitor, label: 'Match system theme' },
  { mode: 'dark', icon: Moon, label: 'Dark theme' },
]

/** Three-way segmented control (Light / System / Dark) backing the theme
 * tokens in index.css. Shown in the app Topbar and on the auth pages, since
 * those sit outside the shell. */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded-full border border-[var(--color-rule-2)] bg-[var(--color-paper-2)] p-0.5"
    >
      {OPTIONS.map(({ mode: optionMode, icon: Icon, label }) => {
        const active = mode === optionMode
        return (
          <button
            key={optionMode}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setMode(optionMode)}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
            }`}
          >
            <Icon size={13} />
          </button>
        )
      })}
    </div>
  )
}
