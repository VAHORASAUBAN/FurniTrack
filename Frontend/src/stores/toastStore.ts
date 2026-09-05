import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastEntry {
  id: number
  variant: ToastVariant
  message: string
}

interface ToastState {
  toasts: ToastEntry[]
  push: (variant: ToastVariant, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

/** Design doc §7.1 puts client state in zustand — this is the same pattern
 * as authStore, just for the toast stack. A plain `toast.success(...)`
 * object (below) is what most call sites use, since react-query mutation
 * callbacks and the axios interceptor aren't components and can't call a
 * hook. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (variant, message) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, variant, message }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4500)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
  info: (message: string) => useToastStore.getState().push('info', message),
}
