import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
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
      try {
        const resp = await apiClient.post('/auth/refresh', { refresh_token: refreshToken })
        const { access_token, refresh_token } = resp.data as { access_token: string; refresh_token: string }
        if (cancelled) return
        useAuthStore.getState().setAccessToken(access_token, refresh_token)

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
