import { useNavigate } from 'react-router-dom'
import { listJournals } from '../../api/endpoints/journals'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { JOURNAL_TYPE_LABELS, type Journal } from '../../types/journal'

export function JournalListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Journal>
      title="Journals"
      queryKey="journals"
      fetcher={listJournals}
      rowKey={(j) => j.id}
      onNew={() => navigate('/journals/new')}
      onRowClick={(j) => navigate(`/journals/${j.id}`)}
      columns={[
        {
          header: 'Code', sortKey: 'code', csvValue: (j) => j.code,
          accessor: (j) => <span className="font-mono text-xs">{j.code}</span>,
        },
        {
          header: 'Name', sortKey: 'name', csvValue: (j) => j.name,
          accessor: (j) => <span className="font-medium">{j.name}</span>,
        },
        { header: 'Type', sortKey: 'journal_type', accessor: (j) => JOURNAL_TYPE_LABELS[j.journal_type] },
        {
          header: 'Status', csvValue: (j) => (j.is_active ? 'Active' : 'Archived'),
          accessor: (j) => <StatusPill status={j.is_active ? 'ACTIVE' : 'ARCHIVED'} />,
        },
      ]}
    />
  )
}
