import { create } from 'zustand'

export type DashboardWidget =
  | 'kpi_receivable'
  | 'kpi_payable'
  | 'kpi_sales_orders'
  | 'kpi_purchase_orders'
  | 'kpi_budget_achieved'
  | 'customer_invoices_breakdown'
  | 'vendor_bills_breakdown'
  | 'recent_activity'

export const WIDGET_LABELS: Record<DashboardWidget, string> = {
  kpi_receivable: 'Receivable',
  kpi_payable: 'Payable',
  kpi_sales_orders: 'Sales Orders',
  kpi_purchase_orders: 'Purchase Orders',
  kpi_budget_achieved: 'Budget Achieved',
  customer_invoices_breakdown: 'Customer Invoices breakdown',
  vendor_bills_breakdown: 'Vendor Bills breakdown',
  recent_activity: 'Recent Activity',
}

const ALL_WIDGETS = Object.keys(WIDGET_LABELS) as DashboardWidget[]
const STORAGE_KEY = 'uf_dashboard_widgets'

// Same shape as themeStore.ts: every widget defaults visible, a hidden one
// is remembered by key rather than by "which are shown" so a future new
// widget defaults to visible for people who already have a saved prefs
// blob, instead of silently vanishing until they notice and re-enable it.
function loadHidden(): Set<DashboardWidget> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((w): w is DashboardWidget => ALL_WIDGETS.includes(w as DashboardWidget)))
  } catch {
    return new Set()
  }
}

function persistHidden(hidden: Set<DashboardWidget>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]))
  } catch {
    // private-browsing / storage-blocked — just loses persistence across reloads
  }
}

interface DashboardPrefsState {
  hidden: Set<DashboardWidget>
  isVisible: (widget: DashboardWidget) => boolean
  toggle: (widget: DashboardWidget) => void
  resetToDefault: () => void
}

export const useDashboardPrefsStore = create<DashboardPrefsState>((set, get) => ({
  hidden: loadHidden(),
  isVisible: (widget) => !get().hidden.has(widget),
  toggle: (widget) =>
    set((state) => {
      const next = new Set(state.hidden)
      if (next.has(widget)) next.delete(widget)
      else next.add(widget)
      persistHidden(next)
      return { hidden: next }
    }),
  resetToDefault: () => {
    persistHidden(new Set())
    set({ hidden: new Set() })
  },
}))
