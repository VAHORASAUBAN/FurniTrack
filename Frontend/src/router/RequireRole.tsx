import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../stores/authStore'
import { useAuthStore } from '../stores/authStore'

/** Route guard — design doc §7.2/§7.3: redirects an unauthenticated user to
 * /login, and a PORTAL user hitting an Admin/Accountant screen (or vice
 * versa) straight to their own home, so the two apps never share a screen. */
export function RequireRole({ allow }: { allow: UserRole[] }) {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />
  }
  if (!allow.includes(user.role)) {
    return <Navigate to={user.role === 'PORTAL' ? '/portal' : '/'} replace />
  }
  return <Outlet />
}
