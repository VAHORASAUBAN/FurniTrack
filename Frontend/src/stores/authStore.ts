import { create } from 'zustand'

export type UserRole = 'ADMIN' | 'ACCOUNTANT' | 'PORTAL'

export interface CurrentUser {
  id: number
  login_id: string
  email: string
  name: string
  role: UserRole
  contact_id: number | null
  is_active: boolean
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: CurrentUser | null
  setSession: (accessToken: string, refreshToken: string, user: CurrentUser) => void
  setAccessToken: (accessToken: string, refreshToken: string) => void
  clear: () => void
}

// Design doc §9.3 says access token in memory / refresh token in an
// httpOnly cookie. This build keeps the access token in memory (zustand,
// never persisted) but — since the backend's /auth endpoints exchange the
// refresh token in the JSON body rather than setting a cookie — the refresh
// token is persisted to localStorage so a page reload doesn't force a
// re-login. That's a deliberate, noted trade-off for the hackathon: an
// httpOnly cookie is the harder-to-steal option and would be the first
// hardening step post-hackathon.
const REFRESH_KEY = 'uf_refresh_token'

function loadRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

function persistRefreshToken(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token)
    else localStorage.removeItem(REFRESH_KEY)
  } catch {
    // ignore — private-browsing / storage-blocked contexts just lose persistence
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: loadRefreshToken(),
  user: null,
  setSession: (accessToken, refreshToken, user) => {
    persistRefreshToken(refreshToken)
    set({ accessToken, refreshToken, user })
  },
  setAccessToken: (accessToken, refreshToken) => {
    persistRefreshToken(refreshToken)
    set({ accessToken, refreshToken })
  },
  clear: () => {
    persistRefreshToken(null)
    set({ accessToken: null, refreshToken: null, user: null })
  },
}))
