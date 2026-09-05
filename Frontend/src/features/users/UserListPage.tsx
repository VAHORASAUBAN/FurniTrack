import { useNavigate } from 'react-router-dom'
import { listUsers } from '../../api/endpoints/users'
import { ListView } from '../../components/shared/ListView'
import { StatusPill } from '../../components/shared/StatusPill'
import { USER_ROLE_LABELS, type AppUser, type UserRoleValue } from '../../types/user'

export function UserListPage() {
  const navigate = useNavigate()

  return (
    <ListView<AppUser>
      title="Users"
      queryKey="users"
      fetcher={(params) => listUsers({ ...params, role: params.status as UserRoleValue | undefined })}
      rowKey={(u) => u.id}
      onNew={() => navigate('/settings/users/new')}
      onRowClick={(u) => navigate(`/settings/users/${u.id}`)}
      statusFilter={{
        label: 'Role',
        options: Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ value, label })),
      }}
      searchPlaceholder="Search by name, login ID, or email…"
      columns={[
        {
          header: 'Name', sortKey: 'name', csvValue: (u) => u.name,
          accessor: (u) => <span className="font-medium">{u.name}</span>,
        },
        {
          header: 'Login ID', sortKey: 'login_id', csvValue: (u) => u.login_id,
          accessor: (u) => <span className="font-mono text-xs">{u.login_id}</span>,
        },
        { header: 'Email', accessor: (u) => u.email },
        { header: 'Role', sortKey: 'role', accessor: (u) => USER_ROLE_LABELS[u.role] },
        {
          header: 'Status', csvValue: (u) => (u.is_active ? 'Active' : 'Archived'),
          accessor: (u) => <StatusPill status={u.is_active ? 'ACTIVE' : 'ARCHIVED'} />,
        },
      ]}
    />
  )
}
