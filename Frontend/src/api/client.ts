import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export const apiClient = axios.create({ baseURL: API_BASE_URL })

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Design doc §7.1 / §9.3: a single in-flight refresh shared across
// concurrent 401s, so five parallel requests failing at once trigger one
// refresh call, not five.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccessToken, clear } = useAuthStore.getState()
  if (!refreshToken) return null

  try {
    const resp = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
    const { access_token, refresh_token } = resp.data as { access_token: string; refresh_token: string }
    setAccessToken(access_token, refresh_token)
    return access_token
  } catch {
    clear()
    return null
  }
}

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined
    const status = error.response?.status
    const isAuthEndpoint = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh')

    if (status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null
        })
      }
      const newToken = await refreshPromise
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`
        return apiClient(config)
      }
      // refresh itself failed — hard sign-out
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

/** Shape of the error envelope every 4xx/5xx uses (design doc §5.1). */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: Array<{ field?: string; message?: string }>
    request_id: string
  }
}

export function getApiErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<ApiErrorBody>
  return axiosErr.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export function getApiErrorCode(err: unknown): string | null {
  const axiosErr = err as AxiosError<ApiErrorBody>
  return axiosErr.response?.data?.error?.code ?? null
}
