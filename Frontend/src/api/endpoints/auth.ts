import { apiClient } from '../client'
import type { CurrentUser } from '../../stores/authStore'

export interface LoginInput {
  login_id: string
  password: string
}

export interface SignupInput {
  login_id: string
  email: string
  password: string
  password_confirm: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: CurrentUser
}

export async function login(input: LoginInput): Promise<TokenResponse> {
  const resp = await apiClient.post<TokenResponse>('/auth/login', input)
  return resp.data
}

export async function signup(input: SignupInput): Promise<CurrentUser> {
  const resp = await apiClient.post<CurrentUser>('/auth/signup', input)
  return resp.data
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refresh_token: refreshToken })
}

export async function getMe(): Promise<CurrentUser> {
  const resp = await apiClient.get<CurrentUser>('/auth/me')
  return resp.data
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const resp = await apiClient.post<{ message: string }>('/auth/forgot-password', { email })
  return resp.data
}

export async function resetPassword(input: {
  token: string
  new_password: string
  new_password_confirm: string
}): Promise<void> {
  await apiClient.post('/auth/reset-password', input)
}

export async function changePassword(input: {
  current_password: string
  new_password: string
  new_password_confirm: string
}): Promise<void> {
  await apiClient.post('/auth/change-password', input)
}
