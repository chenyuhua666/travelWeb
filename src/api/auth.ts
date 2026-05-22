import { request } from './http'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  tokenType: string
  expiresInMinutes: number
}

export function login(payload: LoginPayload) {
  return request<LoginResult>({
    method: 'post',
    url: '/auth/login',
    data: payload,
  })
}
