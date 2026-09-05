import { useNavigate } from 'react-router-dom'
import { listAccounts } from '../../api/endpoints/accounts'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { ACCOUNT_TYPE_LABELS, type ChartOfAccount } from '../../types/account'

export function AccountListPage() {
  const navigate = useNavigate()

  return (
    <ListView<ChartOfAccount>
      title="Chart of Accounts"
      queryKey="accounts"
      fetcher={listAccounts}
      rowKey={(a) => a.id}
      onNew={() => navigate('/accounts/new')}
      onRowClick={(a) => navigate(`/accounts/${a.id}`)}
      searchPlaceholder="Search by code or name…"
      columns={[
        {
          header: 'Code', sortKey: 'code', csvValue: (a) => a.code,
          accessor: (a) => <span className="font-mono text-xs">{a.code}</span>,
        },
        {
          header: 'Name', sortKey: 'name', csvValue: (a) => a.name,
          accessor: (a) => <span className="font-medium">{a.name}</span>,
        },
        { header: 'Type', sortKey: 'account_type', accessor: (a) => ACCOUNT_TYPE_LABELS[a.account_type] },
        {
          header: 'Flags',
          csvValue: (a) => [a.is_receivable && 'Receivable', a.is_payable && 'Payable'].filter(Boolean).join('; '),
          accessor: (a) => (
            <div className="flex gap-1.5">
              {a.is_receivable && (
                <span className="rounded-full bg-[var(--color-accent-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                  Receivable
                </span>
              )}
              {a.is_payable && (
                <span className="rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
                  Payable
                </span>
              )}
            </div>
          ),
        },
        {
          header: 'Status', csvValue: (a) => (a.is_active ? 'Active' : 'Archived'),
          accessor: (a) => <StatusPill status={a.is_active ? 'ACTIVE' : 'ARCHIVED'} />,
        },
      ]}
    />
  )
}
