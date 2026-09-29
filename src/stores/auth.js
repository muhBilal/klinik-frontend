import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { TOKEN_KEY } from '@/lib/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY))
  const user = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  /** Admin selalu lolos, sama seperti middleware `role` di backend. */
  function hasRole(...roles) {
    if (!user.value) return false
    return user.value.role === 'admin' || roles.includes(user.value.role)
  }

  async function login(email, password) {
    const { data } = await api.post('/login', { email, password, device_name: navigator.userAgent.slice(0, 100) })
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
  }

  async function fetchMe() {
    const { data } = await api.get('/me')
    user.value = data
  }

  async function logout() {
    try {
      await api.post('/logout')
    } finally {
      clear()
    }
  }

  function clear() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, user, isLoggedIn, hasRole, login, fetchMe, logout, clear }
})
