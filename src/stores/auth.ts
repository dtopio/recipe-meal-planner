import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, Session, LoginDTO, RegisterDTO, ApiError, HealthTargets } from '@/types'
import { apiClient } from '@/services/api/client'

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

  function syncLocalIdentity(currentUser: User | null) {
    if (!currentUser) {
      localStorage.removeItem('user_id')
      localStorage.removeItem('household_id')
      return
    }

    localStorage.setItem('user_id', currentUser.id)

    if (currentUser.currentHouseholdId) {
      localStorage.setItem('household_id', currentUser.currentHouseholdId)
    } else {
      localStorage.removeItem('household_id')
    }
  }

  function storeSession(session: Session) {
    token.value = session.accessToken
    user.value = session.user
    localStorage.setItem('session_token', session.accessToken)
    syncLocalIdentity(session.user)
  }

  async function login(dto: LoginDTO) {
    loading.value = true
    error.value = null
    try {
      const { data: session } = await apiClient<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: dto.email.trim(),
          password: dto.password,
        }),
      })

      storeSession(session)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Login failed')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function register(dto: RegisterDTO) {
    loading.value = true
    error.value = null
    try {
      const { data: session } = await apiClient<Session>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: dto.displayName.trim(),
          email: dto.email.trim(),
          password: dto.password,
        }),
      })

      storeSession(session)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Registration failed')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function loadUser() {
    if (!token.value) return
    loading.value = true
    try {
      const { data } = await apiClient<User>('/auth/me')
      user.value = data
      syncLocalIdentity(data)
    } catch {
      logout()
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(displayName: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<User>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName.trim() }),
      })

      user.value = data
      syncLocalIdentity(data)
      return data
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update profile')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function updateHealthTargets(healthTargets: HealthTargets) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<User>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ healthTargets }),
      })

      user.value = data
      syncLocalIdentity(data)
      return data
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update health targets')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    loading.value = true
    error.value = null
    try {
      await apiClient<boolean>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to change password')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function deleteAccount(password: string) {
    loading.value = true
    error.value = null
    try {
      await apiClient<boolean>('/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      logout()
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to delete account')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('session_token')
    localStorage.removeItem('household_id')
    localStorage.removeItem('user_id')
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
    updateProfile,
    updateHealthTargets,
    changePassword,
    deleteAccount,
    logout,
  }
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
