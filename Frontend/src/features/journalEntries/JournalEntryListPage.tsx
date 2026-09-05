import { useNavigate } from 'react-router-dom'
import { listJournalEntries } from '../../api/endpoints/journalEntries'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { formatMoney } from '../../lib/money'
import type { JournalEntry } from '../../types/journalEntry'

export function JournalEntryListPage() {
  const navigate = useNavigate()

  return (
    <ListView<JournalEntry>
      title="Journal Entries"
      queryKey="journal-entries"
      fetcher={listJournalEntries}
      rowKey={(je) => je.id}
      onNew={() => navigate('/journal-entries/new')}
      onRowClick={(je) => navigate(`/journal-entries/${je.id}`)}
      supportsArchive={false}
      searchPlaceholder="Search by entry number or reference…"
      columns={[
        {
          header: 'Number', sortKey: 'entry_number', csvValue: (je) => je.entry_number,
          accessor: (je) => <span className="font-mono text-xs">{je.entry_number}</span>,
        },
        { header: 'Date', sortKey: 'entry_date', accessor: (je) => je.entry_date },
        { header: 'Reference', accessor: (je) => je.reference ?? '—' },
        {
          header: 'Total',
          accessor: (je) => formatMoney(je.total_debit),
          className: 'text-right font-mono',
        },
        {
          header: 'Status', sortKey: 'status', csvValue: (je) => je.status,
          accessor: (je) => <StatusPill status={je.status} />,
        },
      ]}
    />
  )
}
