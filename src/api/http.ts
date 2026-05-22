import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResult } from '@/types/api'

const TOKEN_KEY = 'travel_access_token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const result = response.data as ApiResult<unknown>
    if (typeof result?.code !== 'number') {
      return response.data
    }
    if (result.code === 0) {
      return result.data
    }
    ElMessage.error(result.message || '请求失败')
    return Promise.reject(new Error(result.message || '请求失败'))
  },
  (error: AxiosError<{ message?: string }>) => {
    const message = error.response?.data?.message || error.message || '网络请求失败'
    if (error.response?.status === 401) {
      tokenStorage.clear()
      if (location.pathname !== '/login') {
        location.assign('/login')
      }
    }
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

export function request<T>(config: AxiosRequestConfig) {
  return http.request<ApiResult<T>, T>(config)
}
