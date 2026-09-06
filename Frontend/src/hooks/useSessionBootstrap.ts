import { useEffect, useState } from 'react'
import { ensureFreshAccessToken } from '../api/client'
import { getMe } from '../api/endpoints/auth'
import { useAuthStore } from '../stores/authStore'

/**
 * The auth store only persists the refresh token (design decision in
 * authStore.ts — access token stays in-memory only), so on a hard page
 * reload `user`/`accessToken` are null even when a valid refresh token
 * exists in localStorage. Without this, RequireRole would bounce a
 * perfectly valid session to /login on every reload. Runs once on app
 * mount: if a refresh token exists but the session wasn't rehydrated yet,
 * exchange it for a fresh access token, fetch /auth/me, then let routing
 * proceed — the app shows nothing (not even a redirect) until this settles.
 *
 * Goes through the shared ensureFreshAccessToken() rather than posting to
 * /auth/refresh directly - React 18 StrictMode double-invokes this effect
 * in dev, and two independent refresh calls with the same stored token used
 * to race the backend's reuse-detection (whichever call lost got treated as
 * a leak and revoked the WHOLE token family, including the winner's brand
 * new token), signing the user straight back out on the very next reload.
 * Sharing one in-flight promise means the second invocation just awaits the
 * first's result instead of firing a second request.
 */
export function useSessionBootstrap(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const { accessToken, refreshToken, user } = useAuthStore.getState()
      if (accessToken && user) {
        setReady(true)
        return
      }
      if (!refreshToken) {
        setReady(true)
        return
      }
      const newAccessToken = await ensureFreshAccessToken()
      if (cancelled) return
      if (!newAccessToken) {
        // ensureFreshAccessToken() already cleared the session on failure.
        setReady(true)
        return
      }
      try {
        const me = await getMe()
        if (cancelled) return
        useAuthStore.setState({ user: me })
      } catch {
        if (!cancelled) useAuthStore.getState().clear()
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
