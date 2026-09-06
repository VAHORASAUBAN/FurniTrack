import { KeyRound, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../../api/endpoints/auth'
import { useAuthStore } from '../../stores/authStore'
import { NotificationBell } from '../shared/NotificationBell'
import { ThemeToggle } from '../shared/ThemeToggle'

const ROLE_STYLES: Record<string, string> = {
  ADMIN: 'bg-[var(--color-brass-bg)] text-[var(--color-brass)]',
  ACCOUNTANT: 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]',
  PORTAL: 'bg-[var(--color-rule)] text-[var(--color-ink-2)]',
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export function Topbar() {
  const { user, refreshToken, clear } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    if (refreshToken) {
      try {
        await logoutApi(refreshToken)
      } catch {
        // proceed with local sign-out regardless
      }
    }
    clear()
    navigate('/login')
  }

  return (
    <header className="print:hidden flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-rule)] bg-[var(--color-surface)]/80 px-7 backdrop-blur-sm">
      <div className="text-[13px] text-[var(--color-ink-3)]">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </div>
      <div className="flex items-center gap-4">
        {user?.role !== 'PORTAL' && <NotificationBell />}
        <ThemeToggle />
        <button
          onClick={() => navigate('/change-password')}
          aria-label="Change password"
          title="Change password"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
        >
          <KeyRound size={16} />
        </button>
        <span className="h-6 w-px bg-[var(--color-rule)]" />
        {user && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] font-display text-[12px] font-semibold text-white">
              {initials(user.name)}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-medium text-[var(--color-ink)]">{user.name}</span>
              <span
                className={`mt-0.5 inline-flex w-fit items-center rounded-full px-1.5 py-[1px] text-[10px] font-semibold tracking-wide ${ROLE_STYLES[user.role] ?? ''}`}
              >
                {user.role}
              </span>
            </div>
          </div>
        )}
        <span className="h-6 w-px bg-[var(--color-rule)]" />
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </header>
  )
}
