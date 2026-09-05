import { create } from 'zustand'

const STORAGE_KEY = 'uf_sidebar_collapsed'

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // private-browsing / storage-blocked — just loses persistence across reloads
  }
}

interface SidebarState {
  isCollapsed: boolean
  toggle: () => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: loadCollapsed(),
  toggle: () =>
    set((state) => {
      const next = !state.isCollapsed
      persistCollapsed(next)
      return { isCollapsed: next }
    }),
}))
