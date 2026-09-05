import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'uf_theme_mode'

function loadMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // private-browsing / storage-blocked — fall through to the default
  }
  return 'system'
}

function persistMode(mode: ThemeMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore — just loses persistence across reloads
  }
}

// index.css defines the full light palette on bare :root, redefines it
// under prefers-color-scheme:dark (guarded by :not([data-theme="light"])
// so an explicit light choice always wins over the OS), and again under
// :root[data-theme="dark"] so the toggle wins in both directions. 'system'
// means "no stamp at all" — the media query alone decides.
function applyMode(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const initialMode = loadMode()
applyMode(initialMode)

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initialMode,
  setMode: (mode) => {
    persistMode(mode)
    applyMode(mode)
    set({ mode })
  },
}))
