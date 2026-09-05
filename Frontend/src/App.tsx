import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ComingSoon } from './components/shared/ComingSoon'
import { AccountFormPage } from './features/accounts/AccountFormPage'
import { AccountListPage } from './features/accounts/AccountListPage'
import { AnalyticAccountFormPage } from './features/analytics/AnalyticAccountFormPage'
import { AnalyticAccountListPage } from './features/analytics/AnalyticAccountListPage'
import { LoginPage } from './features/auth/LoginPage'
import { ContactFormPage } from './features/contacts/ContactFormPage'
import { ContactListPage } from './features/contacts/ContactListPage'
import { JournalEntryFormPage } from './features/journalEntries/JournalEntryFormPage'
import { JournalEntryListPage } from './features/journalEntries/JournalEntryListPage'
import { JournalFormPage } from './features/journals/JournalFormPage'
import { JournalListPage } from './features/journals/JournalListPage'
import { ProductFormPage } from './features/products/ProductFormPage'
import { ProductListPage } from './features/products/ProductListPage'
import { useSessionBootstrap } from './hooks/useSessionBootstrap'
import { RequireRole } from './router/RequireRole'

const STAFF = ['ADMIN', 'ACCOUNTANT'] as const

function App() {
  const ready = useSessionBootstrap()

  if (!ready) {
    return <div className="flex h-screen items-center justify-center bg-[var(--color-paper)]" />
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireRole allow={[...STAFF]} />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<ComingSoon title="Dashboard" />} />

            <Route path="/contacts" element={<ContactListPage />} />
            <Route path="/contacts/:id" element={<ContactFormPage />} />

            <Route path="/products" element={<ProductListPage />} />
            <Route path="/products/:id" element={<ProductFormPage />} />

            <Route path="/accounts" element={<AccountListPage />} />
            <Route path="/accounts/:id" element={<AccountFormPage />} />

            <Route path="/journals" element={<JournalListPage />} />
            <Route path="/journals/:id" element={<JournalFormPage />} />

            <Route path="/journal-entries" element={<JournalEntryListPage />} />
            <Route path="/journal-entries/:id" element={<JournalEntryFormPage />} />

            <Route path="/analytics" element={<AnalyticAccountListPage />} />
            <Route path="/analytics/:id" element={<AnalyticAccountFormPage />} />

            <Route path="/budgets" element={<ComingSoon title="Budgets" />} />

            <Route path="/purchase/orders" element={<ComingSoon title="Purchase Orders" />} />
            <Route path="/purchase/bills" element={<ComingSoon title="Vendor Bills" />} />
            <Route path="/purchase/payments" element={<ComingSoon title="Payments" />} />

            <Route path="/sales/orders" element={<ComingSoon title="Sales Orders" />} />
            <Route path="/sales/invoices" element={<ComingSoon title="Customer Invoices" />} />
            <Route path="/sales/receipts" element={<ComingSoon title="Receipts" />} />

            <Route path="/reports/balance-sheet" element={<ComingSoon title="Balance Sheet" />} />
            <Route path="/reports/profit-loss" element={<ComingSoon title="Profit & Loss" />} />
            <Route path="/reports/budget" element={<ComingSoon title="Budget Report" />} />
          </Route>
        </Route>

        <Route element={<RequireRole allow={['PORTAL']} />}>
          <Route path="/portal" element={<ComingSoon title="Portal Dashboard" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
