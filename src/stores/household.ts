import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Household,
  HouseholdMember,
  InviteToken,
  CreateHouseholdDTO,
  JoinHouseholdDTO,
  HouseholdPreferences,
  ApiError,
} from '@/types'
import { apiClient } from '@/services/api/client'
import { useAuthStore } from '@/stores/auth'

interface HouseholdBundle {
  household: Household | null
  members: HouseholdMember[]
  invite: InviteToken | null
  preferences: HouseholdPreferences | null
}

export const useHouseholdStore = defineStore('household', () => {
  const auth = useAuthStore()
  const household = ref<Household | null>(null)
  const members = ref<HouseholdMember[]>([])
  const invite = ref<InviteToken | null>(null)
  const preferences = ref<HouseholdPreferences | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let loadPromise: Promise<void> | null = null

  const hasHousehold = computed(() => !!household.value)
  const memberCount = computed(() => members.value.length)
  const isAdmin = computed(() => {
    const userId = localStorage.getItem('user_id') || 'u1'
    return members.value.find(m => m.userId === userId)?.role === 'admin'
  })

  function applyBundle(bundle: HouseholdBundle) {
    household.value = bundle.household
    members.value = bundle.members
    invite.value = bundle.invite
    preferences.value = bundle.preferences

    if (bundle.household?.id) {
      localStorage.setItem('household_id', bundle.household.id)
    } else {
      localStorage.removeItem('household_id')
    }

    if (auth.user) {
      auth.user.currentHouseholdId = bundle.household?.id
    }
  }

  async function loadHousehold() {
    if (loadPromise) return loadPromise

    loading.value = true
    error.value = null
    loadPromise = apiClient<HouseholdBundle>('/household')
      .then(({ data }) => { applyBundle(data) })
      .catch((e: unknown) => { error.value = getErrorMessage(e, 'Failed to load household') })
      .finally(() => { loading.value = false; loadPromise = null })

    return loadPromise
  }

  async function createHousehold(dto: CreateHouseholdDTO) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<HouseholdBundle>('/household', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      applyBundle(data)
      return data.household
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to create household')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function joinHousehold(dto: JoinHouseholdDTO) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<HouseholdBundle>('/household/join', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      applyBundle(data)
      return data.household
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to join household')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function updateMemberRole(memberId: string, role: 'admin' | 'member') {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<HouseholdBundle>(`/household/members/${memberId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      applyBundle(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update member role')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function updateHousehold(dto: { name?: string; color?: string }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<HouseholdBundle>('/household', {
        method: 'PATCH',
        body: JSON.stringify(dto),
      })
      applyBundle(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update household')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function kickMember(memberId: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await apiClient<HouseholdBundle>(`/household/members/${memberId}`, {
        method: 'DELETE',
      })
      applyBundle(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to remove member')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function deleteHousehold() {
    loading.value = true
    error.value = null
    try {
      await apiClient<boolean>('/household', {
        method: 'DELETE',
      })
      applyBundle({ household: null, members: [], invite: null, preferences: null })
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to delete household')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function regenerateInvite() {
    loading.value = true
    try {
      const { data } = await apiClient<InviteToken>('/household/invite/regenerate', {
        method: 'POST',
      })
      invite.value = data
      error.value = null
    } finally {
      loading.value = false
    }
  }

  async function leaveHousehold() {
    loading.value = true
    try {
      await apiClient<boolean>('/household/leave', {
        method: 'POST',
      })
      applyBundle({ household: null, members: [], invite: null, preferences: null })
      error.value = null
    } finally {
      loading.value = false
    }
  }

  async function updatePreferences(preferenceUpdate: Pick<HouseholdPreferences, 'dietaryPreferences' | 'mealPeriods'>) {
    loading.value = true
    error.value = null

    try {
      const { data } = await apiClient<HouseholdPreferences>('/household/preferences', {
        method: 'PATCH',
        body: JSON.stringify(preferenceUpdate),
      })

      preferences.value = data
      return data
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update dietary preferences')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  return {
    household,
    members,
    invite,
    preferences,
    loading,
    error,
    hasHousehold,
    memberCount,
    isAdmin,
    loadHousehold,
    createHousehold,
    joinHousehold,
    updateHousehold,
    updateMemberRole,
    kickMember,
    deleteHousehold,
    regenerateInvite,
    leaveHousehold,
    updatePreferences,
  }
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
