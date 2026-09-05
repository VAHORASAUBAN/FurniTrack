import { useNavigate } from 'react-router-dom'
import { listBudgets } from '../../api/endpoints/budgets'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { Budget } from '../../types/budget'

export function BudgetListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Budget>
      title="Budgets"
      queryKey="budgets"
      fetcher={listBudgets}
      rowKey={(b) => b.id}
      onNew={() => navigate('/budgets/new')}
      onRowClick={(b) => navigate(`/budgets/${b.id}`)}
      searchPlaceholder="Search by budget name…"
      columns={[
        { header: 'Name', accessor: (b) => <span className="font-medium">{b.name}</span> },
        { header: 'Period', accessor: (b) => `${b.start_date} → ${b.end_date}` },
        {
          header: 'Planned',
          accessor: (b) => formatMoney(b.lines.reduce((sum, l) => sum + Number.parseFloat(l.planned_amount), 0).toFixed(2)),
          className: 'text-right font-mono',
        },
        {
          header: 'Achieved',
          accessor: (b) => formatMoney(b.lines.reduce((sum, l) => sum + Number.parseFloat(l.achieved_amount), 0).toFixed(2)),
          className: 'text-right font-mono',
        },
        { header: 'Status', accessor: (b) => <StatusPill status={b.status} /> },
      ]}
    />
  )
}
