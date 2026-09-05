import {
  BarChart3,
  BookText,
  Boxes,
  FileStack,
  Landmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ScrollText,
  ShoppingCart,
  Tags,
  Target,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useSidebarStore } from '../../stores/sidebarStore'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ size?: number }>
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Mirrors the wireframe's top-level grouping: Sales | Purchase | Account | Report.
const GROUPS: NavGroup[] = [
  {
    label: 'Sales',
    items: [
      { to: '/sales/orders', label: 'Sales Orders', icon: ShoppingCart },
      { to: '/sales/invoices', label: 'Customer Invoices', icon: ReceiptText },
      { to: '/sales/receipts', label: 'Receipts', icon: Wallet },
    ],
  },
  {
    label: 'Purchase',
    items: [
      { to: '/purchase/orders', label: 'Purchase Orders', icon: FileStack },
      { to: '/purchase/bills', label: 'Vendor Bills', icon: ScrollText },
      { to: '/purchase/payments', label: 'Payments', icon: Wallet },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/contacts', label: 'Contacts', icon: Users },
      { to: '/products', label: 'Products', icon: Boxes },
      { to: '/accounts', label: 'Chart of Accounts', icon: Landmark },
      { to: '/journals', label: 'Journals', icon: BookText },
      { to: '/journal-entries', label: 'Journal Entries', icon: FileStack },
      { to: '/analytics', label: 'Analytic Accounts', icon: Tags },
      { to: '/budgets', label: 'Budgets', icon: Target },
    ],
  },
  {
    label: 'Report',
    items: [
      { to: '/reports/balance-sheet', label: 'Balance Sheet', icon: BarChart3 },
      { to: '/reports/profit-loss', label: 'Profit & Loss', icon: BarChart3 },
      { to: '/reports/budget', label: 'Budget Report', icon: BarChart3 },
    ],
  },
]

// Admin-only — matches the wireframe's "Create User" screen; kept out of
// GROUPS so an Accountant never sees a link to a page RequireRole would
// bounce them straight back out of.
const SETTINGS_GROUP: NavGroup = {
  label: 'Settings',
  items: [{ to: '/settings/users', label: 'Users', icon: UserCog }],
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors ${
    isActive
      ? 'bg-white/[0.07] text-[var(--color-sidebar-ink)]'
      : 'text-[var(--color-sidebar-ink-2)] hover:bg-white/[0.04] hover:text-[var(--color-sidebar-ink)]'
  }`

function NavIcon({ Icon, active }: { Icon: React.ComponentType<{ size?: number }>; active: boolean }) {
  return (
    <span className={active ? 'text-[var(--color-brass)]' : 'text-[var(--color-sidebar-ink-2)] group-hover:text-[var(--color-brass)]'}>
      <Icon size={16} />
    </span>
  )
}

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role)
  const isCollapsed = useSidebarStore((s) => s.isCollapsed)
  const toggle = useSidebarStore((s) => s.toggle)
  if (role === 'PORTAL') return null // portal users get their own minimal shell

  const groups = role === 'ADMIN' ? [...GROUPS, SETTINGS_GROUP] : GROUPS

  return (
    <aside
      className={`print:hidden relative flex shrink-0 flex-col gap-5 overflow-y-auto overflow-x-hidden bg-[var(--color-sidebar)] py-5 transition-[width] duration-200 ${
        isCollapsed ? 'w-16 px-2' : 'w-64 px-3.5'
      }`}
    >
      <div className={`flex items-center gap-2.5 px-1.5 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--color-brass)] to-[var(--color-accent)] text-[13px] font-bold text-white font-display shadow-[var(--shadow-sm)]">
          UF
        </div>
        {!isCollapsed && (
          <div className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-semibold tracking-tight text-[var(--color-sidebar-ink)]">
              Urban Furniture
            </span>
            <span className="mt-0.5 text-[10.5px] uppercase tracking-wider text-[var(--color-sidebar-ink-2)]">
              Ledger &amp; Accounts
            </span>
          </div>
        )}
      </div>

      <NavLink to="/" end className={navClass} title={isCollapsed ? 'Dashboard' : undefined}>
        {({ isActive }) => (
          <>
            <NavIcon Icon={LayoutDashboard} active={isActive} />
            {!isCollapsed && 'Dashboard'}
            {isActive && <span className="absolute -left-3.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-brass)]" />}
          </>
        )}
      </NavLink>

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {!isCollapsed && (
            <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-sidebar-ink-2)]/80">
              {group.label}
            </div>
          )}
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass} title={isCollapsed ? item.label : undefined}>
              {({ isActive }) => (
                <>
                  <NavIcon Icon={item.icon} active={isActive} />
                  {!isCollapsed && item.label}
                  {isActive && (
                    <span className="absolute -left-3.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--color-brass)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}

      <button
        type="button"
        onClick={toggle}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`mt-auto flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-[var(--color-sidebar-ink-2)] transition-colors hover:bg-white/[0.04] hover:text-[var(--color-sidebar-ink)] ${
          isCollapsed ? 'justify-center' : ''
        }`}
      >
        {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        {!isCollapsed && 'Collapse'}
      </button>
    </aside>
  )
}
