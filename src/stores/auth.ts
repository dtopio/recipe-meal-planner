import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session, LoginDTO, RegisterDTO } from '@/types'
import { delay } from '@/services/api/client'
import { mockCurrentUser } from '@/services/mock/data'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('session_token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const displayName = computed(() => user.value?.displayName || 'User')
  const initials = computed(() => {
    const name = user.value?.displayName || ''
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  })

  async function login(dto: LoginDTO) {
    loading.value = true
    error.value = null
    try {
      await delay(600)
      // Mock validation
      if (!dto.email || !dto.password) {
        throw new Error('Email and password are required')
      }
      if (dto.password.length < 6) {
        throw new Error('Invalid email or password')
      }
      // Mock success
      const session: Session = {
        accessToken: 'mock-token-' + Date.now(),
        refreshToken: 'mock-refresh-' + Date.now(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: mockCurrentUser,
      }
      token.value = session.accessToken
      user.value = session.user
      localStorage.setItem('session_token', session.accessToken)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Login failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function register(dto: RegisterDTO) {
    loading.value = true
    error.value = null
    try {
      await delay(800)
      if (!dto.email || !dto.password || !dto.displayName) {
        throw new Error('All fields are required')
      }
      if (dto.password.length < 8) {
        throw new Error('Password must be at least 8 characters')
      }
      const newUser: User = {
        id: 'u-' + Date.now(),
        email: dto.email,
        displayName: dto.displayName,
        createdAt: new Date().toISOString(),
      }
      const session: Session = {
        accessToken: 'mock-token-' + Date.now(),
        refreshToken: 'mock-refresh-' + Date.now(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        user: newUser,
      }
      token.value = session.accessToken
      user.value = session.user
      localStorage.setItem('session_token', session.accessToken)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Registration failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadUser() {
    if (!token.value) return
    loading.value = true
    try {
      await delay(200)
      user.value = mockCurrentUser
    } catch {
      logout()
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('session_token')
    localStorage.removeItem('household_id')
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    displayName,
    initials,
    login,
    register,
    loadUser,
    logout,
  }
})
