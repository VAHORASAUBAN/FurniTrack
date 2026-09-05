import { useNavigate } from 'react-router-dom'
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
          accessor: (c) => (
            <div className="flex items-center gap-2.5">
              {c.profile_image_url ? (
                <img src={c.profile_image_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent-bg)] text-xs font-semibold text-[var(--color-accent)]">
                  {c.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-medium">{c.name}</span>
            </div>
          ),
        },
        { header: 'Type', accessor: (c) => TYPE_LABELS[c.contact_type] },
        { header: 'Email', accessor: (c) => c.email ?? '—' },
        { header: 'Phone', accessor: (c) => c.mobile ?? '—' },
        { header: 'City', accessor: (c) => c.city ?? '—' },
        { header: 'Status', accessor: (c) => <StatusPill status={c.is_active ? 'ACTIVE' : 'ARCHIVED'} /> },
      ]}
    />
  )
}
