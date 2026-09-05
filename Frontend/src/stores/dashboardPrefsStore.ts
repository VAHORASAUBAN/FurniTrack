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
function loadHidden(): DashboardWidget[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((w): w is DashboardWidget => ALL_WIDGETS.includes(w as DashboardWidget))
  } catch {
    return []
  }
}

function persistHidden(hidden: DashboardWidget[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden))
  } catch {
    // private-browsing / storage-blocked — just loses persistence across reloads
  }
}

interface DashboardPrefsState {
  /** Plain array, not a Set - kept as the actual piece of state a
   * component selects (`useDashboardPrefsStore((s) => s.hidden)`), so a
   * toggle's `set()` call produces a new array reference the selector can
   * see change. A stable-reference helper method (closing over `get()`
   * instead of taking `hidden` as an argument) looks correct but never
   * triggers a re-render, since zustand only re-renders a component when
   * the exact value it selected changes - the "hidden hook state" bug that
   * broke this the first time. */
  hidden: DashboardWidget[]
  toggle: (widget: DashboardWidget) => void
  resetToDefault: () => void
}

export const useDashboardPrefsStore = create<DashboardPrefsState>((set) => ({
  hidden: loadHidden(),
  toggle: (widget) =>
    set((state) => {
      const next = state.hidden.includes(widget)
        ? state.hidden.filter((w) => w !== widget)
        : [...state.hidden, widget]
      persistHidden(next)
      return { hidden: next }
    }),
  resetToDefault: () => {
    persistHidden([])
    set({ hidden: [] })
  },
}))
