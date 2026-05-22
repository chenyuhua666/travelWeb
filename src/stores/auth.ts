import { defineStore } from 'pinia'
import { login as loginApi, type LoginPayload } from '@/api/auth'
import { tokenStorage } from '@/api/http'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: tokenStorage.get() || '',
  }),
  actions: {
    async login(payload: LoginPayload) {
      const result = await loginApi(payload)
      this.token = result.token
      tokenStorage.set(result.token)
    },
    logout() {
      this.token = ''
      tokenStorage.clear()
    },
  },
})
