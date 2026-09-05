import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'
import { toast } from '../stores/toastStore'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
// Uploaded images come back as a bare `/static/...` path (app/main.py's
// StaticFiles mount) - resolve it against the backend's own origin, not
// the Vite dev server's, since that's who actually serves the file.
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

export const apiClient = axios.create({ baseURL: API_BASE_URL })

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

// Per-action labels for the URL's last path segment, so "every action
// performed" gets a toast without hand-adding one at every call site
// (13+ list pages, ~10 form pages, payments, budgets...). Keyed by the verb
// each router actually uses (see purchase.py/sales.py/payments.py/
// journal_entries.py/budgets.py's /post,/confirm,/cancel,/archive,... routes).
const ACTION_LABELS: Record<string, string> = {
  post: 'Posted successfully',
  confirm: 'Confirmed',
  cancel: 'Cancelled — reversal entry created',
  archive: 'Archived',
  unarchive: 'Restored',
  'reset-draft': 'Reset to draft',
  'create-bill': 'Vendor bill created from purchase order',
  'create-invoice': 'Invoice created from sales order',
  revise: 'Budget revised',
  pay: 'Payment submitted',
  image: 'Image uploaded',
  login: 'Welcome back',
  logout: 'Logged out',
}

function describeMutationSuccess(method: string, url: string, data: unknown): string | null {
  const path = url.replace(/^\/+/, '').split('?')[0]
  if (path.startsWith('auth/')) {
    if (path === 'auth/signup') return 'Account created — you can now log in'
    return path === 'auth/logout' ? ACTION_LABELS.logout : null // login/refresh/forgot/reset keep their own inline UX
  }

  if (data && typeof data === 'object' && 'message' in (data as Record<string, unknown>)) {
    const msg = (data as Record<string, unknown>).message
    if (typeof msg === 'string') return msg
  }

  const last = path.split('/').filter(Boolean).pop() ?? ''
  if (ACTION_LABELS[last]) return ACTION_LABELS[last]

  if (method === 'delete') return 'Deleted'
  if (method === 'patch' || method === 'put') return 'Changes saved'
  if (method === 'post') return 'Created successfully'
  return null
}

apiClient.interceptors.response.use((response) => {
  const method = response.config.method?.toLowerCase() ?? ''
  if (MUTATING_METHODS.has(method)) {
    const message = describeMutationSuccess(method, response.config.url ?? '', response.data)
    if (message) toast.success(message)
  }
  return response
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
      toast.error('Session expired — please log in again')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // Scoped to mutations, same as the success toast above: a failed
    // background GET (react-query retry/refetch) would otherwise spam
    // toasts on a flaky connection, and list/detail pages already render
    // their own inline "Could not load data" state for reads.
    const method = config?.method?.toLowerCase() ?? ''
    if (!isAuthEndpoint && MUTATING_METHODS.has(method)) {
      toast.error(getApiErrorMessage(error))
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
