import { useNavigate } from 'react-router-dom'
import { listUsers } from '../../api/endpoints/users'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { USER_ROLE_LABELS, type AppUser } from '../../types/user'

export function UserListPage() {
  const navigate = useNavigate()

  return (
    <ListView<AppUser>
      title="Users"
      queryKey="users"
      fetcher={listUsers}
      rowKey={(u) => u.id}
      onNew={() => navigate('/settings/users/new')}
      onRowClick={(u) => navigate(`/settings/users/${u.id}`)}
      searchPlaceholder="Search by name, login ID, or email…"
      columns={[
        { header: 'Name', accessor: (u) => <span className="font-medium">{u.name}</span> },
        { header: 'Login ID', accessor: (u) => <span className="font-mono text-xs">{u.login_id}</span> },
        { header: 'Email', accessor: (u) => u.email },
        { header: 'Role', accessor: (u) => USER_ROLE_LABELS[u.role] },
        { header: 'Status', accessor: (u) => <StatusPill status={u.is_active ? 'ACTIVE' : 'ARCHIVED'} /> },
      ]}
    />
  )
}
