import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ToastContainer } from './components/shared/ToastContainer'
import { AccountFormPage } from './features/accounts/AccountFormPage'
import { AccountListPage } from './features/accounts/AccountListPage'
import { AnalyticAccountFormPage } from './features/analytics/AnalyticAccountFormPage'
import { AnalyticAccountListPage } from './features/analytics/AnalyticAccountListPage'
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage'
import { LoginPage } from './features/auth/LoginPage'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignUpPage } from './features/auth/SignUpPage'
import { BudgetFormPage } from './features/budgets/BudgetFormPage'
import { BudgetListPage } from './features/budgets/BudgetListPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { PaymentDetailPage } from './features/payments/PaymentDetailPage'
import { PaymentListPage } from './features/payments/PaymentListPage'
import { PortalInvoiceDetailPage } from './features/portal/PortalInvoiceDetailPage'
import { PortalInvoiceListPage } from './features/portal/PortalInvoiceListPage'
import { ContactFormPage } from './features/contacts/ContactFormPage'
import { ContactListPage } from './features/contacts/ContactListPage'
import { JournalEntryFormPage } from './features/journalEntries/JournalEntryFormPage'
import { JournalEntryListPage } from './features/journalEntries/JournalEntryListPage'
import { JournalFormPage } from './features/journals/JournalFormPage'
import { JournalListPage } from './features/journals/JournalListPage'
import { ProductFormPage } from './features/products/ProductFormPage'
import { ProductListPage } from './features/products/ProductListPage'
import { PurchaseOrderFormPage } from './features/purchase/PurchaseOrderFormPage'
import { PurchaseOrderListPage } from './features/purchase/PurchaseOrderListPage'
import { BalanceSheetPage } from './features/reports/BalanceSheetPage'
import { BudgetReportPage } from './features/reports/BudgetReportPage'
import { ProfitLossPage } from './features/reports/ProfitLossPage'
import { VendorBillFormPage } from './features/purchase/VendorBillFormPage'
import { VendorBillListPage } from './features/purchase/VendorBillListPage'
import { CustomerInvoiceFormPage } from './features/sales/CustomerInvoiceFormPage'
import { CustomerInvoiceListPage } from './features/sales/CustomerInvoiceListPage'
import { SalesOrderFormPage } from './features/sales/SalesOrderFormPage'
import { SalesOrderListPage } from './features/sales/SalesOrderListPage'
import { UserFormPage } from './features/users/UserFormPage'
import { UserListPage } from './features/users/UserListPage'
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
      <ToastContainer />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<RequireRole allow={[...STAFF]} />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />

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

            <Route path="/budgets" element={<BudgetListPage />} />
            <Route path="/budgets/:id" element={<BudgetFormPage />} />

            <Route path="/purchase/orders" element={<PurchaseOrderListPage />} />
            <Route path="/purchase/orders/:id" element={<PurchaseOrderFormPage />} />
            <Route path="/purchase/bills" element={<VendorBillListPage />} />
            <Route path="/purchase/bills/:id" element={<VendorBillFormPage />} />
            <Route
              path="/purchase/payments"
              element={<PaymentListPage paymentType="SEND" title="Payments" basePath="/purchase/payments" />}
            />
            <Route path="/purchase/payments/:id" element={<PaymentDetailPage backPath="/purchase/payments" />} />

            <Route path="/sales/orders" element={<SalesOrderListPage />} />
            <Route path="/sales/orders/:id" element={<SalesOrderFormPage />} />
            <Route path="/sales/invoices" element={<CustomerInvoiceListPage />} />
            <Route path="/sales/invoices/:id" element={<CustomerInvoiceFormPage />} />
            <Route
              path="/sales/receipts"
              element={<PaymentListPage paymentType="RECEIVE" title="Receipts" basePath="/sales/receipts" />}
            />
            <Route path="/sales/receipts/:id" element={<PaymentDetailPage backPath="/sales/receipts" />} />

            <Route path="/reports/balance-sheet" element={<BalanceSheetPage />} />
            <Route path="/reports/profit-loss" element={<ProfitLossPage />} />
            <Route path="/reports/budget" element={<BudgetReportPage />} />

            <Route element={<RequireRole allow={['ADMIN']} />}>
              <Route path="/settings/users" element={<UserListPage />} />
              <Route path="/settings/users/:id" element={<UserFormPage />} />
            </Route>
          </Route>
        </Route>

        <Route element={<RequireRole allow={['PORTAL']} />}>
          <Route element={<AppShell />}>
            <Route path="/portal" element={<Navigate to="/portal/invoices" replace />} />
            <Route path="/portal/invoices" element={<PortalInvoiceListPage />} />
            <Route path="/portal/invoices/:id" element={<PortalInvoiceDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
