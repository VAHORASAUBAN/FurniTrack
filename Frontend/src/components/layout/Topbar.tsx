import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { logout as logoutApi } from '../../api/endpoints/auth'
import { useAuthStore } from '../../stores/authStore'

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--color-rule)] bg-[var(--color-surface)] px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-[var(--color-ink)]">{user.name}</span>
            <span className="rounded-full bg-[var(--color-rule)] px-2 py-0.5 text-xs text-[var(--color-ink-2)]">
              {user.role}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-[var(--color-ink-2)] hover:text-[var(--color-danger)]"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </header>
  )
}
