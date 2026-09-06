import { Navigate, Outlet } from 'react-router-dom'
import type { UserRole } from '../stores/authStore'
import { useAuthStore } from '../stores/authStore'

/** Route guard — design doc §7.2/§7.3: redirects an unauthenticated user to
 * /login, and a PORTAL user hitting an Admin/Accountant screen (or vice
 * versa) straight to their own home, so the two apps never share a screen.
 *
 * Also forces a stop at /change-password while must_change_password is set
 * (a portal user's one-time password, per contact_service) — every
 * protected route passes through here, so this is the one place that needs
 * the check rather than guarding each page individually. /change-password
 * itself sits outside this guard's routes entirely, so there's no loop. */
export function RequireRole({ allow }: { allow: UserRole[] }) {
  const user = useAuthStore((s) => s.user)
  const accessToken = useAuthStore((s) => s.accessToken)

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />
  }
  if (!allow.includes(user.role)) {
    return <Navigate to={user.role === 'PORTAL' ? '/portal' : '/'} replace />
  }
  if (user.must_change_password) {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}
