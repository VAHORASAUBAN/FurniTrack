import { apiClient } from '../client'
import type { Notification } from '../../types/notification'

export async function listNotifications(limit = 30): Promise<Notification[]> {
  const resp = await apiClient.get<Notification[]>('/notifications', { params: { limit } })
  return resp.data
}
