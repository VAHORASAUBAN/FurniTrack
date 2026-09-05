import { useNavigate } from 'react-router-dom'
import { API_ORIGIN } from '../../api/client'
import { listContacts } from '../../api/endpoints/contacts'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import type { Contact } from '../../types/contact'

const TYPE_LABELS: Record<Contact['contact_type'], string> = {
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
  BOTH: 'Customer & Vendor',
}

export function ContactListPage() {
  const navigate = useNavigate()

  return (
    <ListView<Contact>
      title="Contacts"
      queryKey="contacts"
      fetcher={listContacts}
      rowKey={(c) => c.id}
      onNew={() => navigate('/contacts/new')}
      onRowClick={(c) => navigate(`/contacts/${c.id}`)}
      searchPlaceholder="Search by name, email, or phone…"
      columns={[
        {
          header: 'Name',
          sortKey: 'name',
          csvValue: (c) => c.name,
          accessor: (c) => (
            <div className="flex items-center gap-2.5">
              {c.profile_image_url ? (
                <img src={`${API_ORIGIN}${c.profile_image_url}`} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-bg)] text-xs font-semibold text-[var(--color-accent)]">
                  {c.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-medium">{c.name}</span>
            </div>
          ),
        },
        { header: 'Type', sortKey: 'contact_type', accessor: (c) => TYPE_LABELS[c.contact_type] },
        { header: 'Email', accessor: (c) => c.email ?? '—' },
        { header: 'Phone', accessor: (c) => c.mobile ?? '—' },
        { header: 'City', accessor: (c) => c.city ?? '—' },
        {
          header: 'Status',
          csvValue: (c) => (c.is_active ? 'Active' : 'Archived'),
          accessor: (c) => <StatusPill status={c.is_active ? 'ACTIVE' : 'ARCHIVED'} />,
        },
      ]}
      kanban={{
        groupBy: (c) => c.contact_type,
        columns: [
          { key: 'CUSTOMER', label: 'Customer' },
          { key: 'VENDOR', label: 'Vendor' },
          { key: 'BOTH', label: 'Customer & Vendor' },
        ],
        renderCard: (c) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {c.profile_image_url ? (
                <img src={`${API_ORIGIN}${c.profile_image_url}`} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent-bg)] text-[10px] font-semibold text-[var(--color-accent)]">
                  {c.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-[var(--color-ink)]">{c.name}</span>
            </div>
            <div className="text-xs text-[var(--color-ink-3)]">{c.email ?? c.mobile ?? '—'}</div>
            {c.city && <div className="text-xs text-[var(--color-ink-3)]">{c.city}</div>}
            {!c.is_active && <StatusPill status="ARCHIVED" />}
          </div>
        ),
      }}
    />
  )
}
