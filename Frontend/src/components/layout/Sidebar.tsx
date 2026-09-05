import {
  BarChart3,
  BookText,
  Boxes,
  FileStack,
  Landmark,
  LayoutDashboard,
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

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'PORTAL') return null // portal users get their own minimal shell

  const groups = role === 'ADMIN' ? [...GROUPS, SETTINGS_GROUP] : GROUPS

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-[var(--color-rule)] bg-[var(--color-surface)] px-4 py-5 overflow-y-auto">
      <div className="px-2 text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
        Urban Furniture
      </div>

      <NavLink
        to="/"
        end
        className={({ isActive }) =>
          `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium ${
            isActive ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]' : 'text-[var(--color-ink-2)] hover:bg-[var(--color-paper)]'
          }`
        }
      >
        <LayoutDashboard size={17} /> Dashboard
      </NavLink>

      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <div className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-3)]">
            {group.label}
          </div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium ${
                  isActive ? 'bg-[var(--color-accent-bg)] text-[var(--color-accent)]' : 'text-[var(--color-ink-2)] hover:bg-[var(--color-paper)]'
                }`
              }
            >
              <item.icon size={17} /> {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  )
}
