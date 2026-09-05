import { useNavigate } from 'react-router-dom'
import { listAnalyticAccounts } from '../../api/endpoints/analyticAccounts'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import type { AnalyticAccount } from '../../types/analyticAccount'

export function AnalyticAccountListPage() {
  const navigate = useNavigate()

  return (
    <ListView<AnalyticAccount>
      title="Analytic Accounts"
      queryKey="analytic-accounts"
      fetcher={listAnalyticAccounts}
      rowKey={(a) => a.id}
      onNew={() => navigate('/analytics/new')}
      onRowClick={(a) => navigate(`/analytics/${a.id}`)}
      columns={[
        {
          header: 'Name', sortKey: 'name', csvValue: (a) => a.name,
          accessor: (a) => <span className="font-medium">{a.name}</span>,
        },
        {
          header: 'Type', sortKey: 'analytic_type',
          accessor: (a) => (a.analytic_type === 'INCOME' ? 'Income' : 'Expense'),
        },
        {
          header: 'Status', csvValue: (a) => (a.is_active ? 'Active' : 'Archived'),
          accessor: (a) => <StatusPill status={a.is_active ? 'ACTIVE' : 'ARCHIVED'} />,
        },
      ]}
    />
  )
}
