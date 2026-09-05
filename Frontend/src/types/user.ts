export type UserRoleValue = 'ADMIN' | 'ACCOUNTANT' | 'PORTAL'

export interface AppUser {
  id: number
  login_id: string
  email: string
  name: string
  role: UserRoleValue
  contact_id: number | null
  is_active: boolean
}

export interface UserCreateInput {
  name: string
  login_id: string
  email: string
  password: string
  password_confirm: string
  role: UserRoleValue
  contact_id?: number | null
}

export const USER_ROLE_LABELS: Record<UserRoleValue, string> = {
  ADMIN: 'Administrator',
  ACCOUNTANT: 'Accountant',
  PORTAL: 'User (Portal)',
}
