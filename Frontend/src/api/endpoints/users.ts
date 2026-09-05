import { apiClient } from '../client'
import type { ListParams, Page } from '../../types/api'
import type { AppUser, UserCreateInput, UserRoleValue } from '../../types/user'

export async function listUsers(params: ListParams & { role?: UserRoleValue }): Promise<Page<AppUser>> {
  const resp = await apiClient.get<Page<AppUser>>('/users', { params })
  return resp.data
}

export async function getUser(id: number): Promise<AppUser> {
  const resp = await apiClient.get<AppUser>(`/users/${id}`)
  return resp.data
}

export async function createUser(input: UserCreateInput): Promise<AppUser> {
  const resp = await apiClient.post<AppUser>('/users', input)
  return resp.data
}

export async function archiveUser(id: number): Promise<AppUser> {
  const resp = await apiClient.post<AppUser>(`/users/${id}/archive`)
  return resp.data
}

export async function unarchiveUser(id: number): Promise<AppUser> {
  const resp = await apiClient.post<AppUser>(`/users/${id}/unarchive`)
  return resp.data
}
