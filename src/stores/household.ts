import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Household, HouseholdMember, InviteToken, CreateHouseholdDTO, JoinHouseholdDTO } from '@/types'
import { delay, generateId } from '@/services/api/client'
import { mockHousehold, mockMembers, mockInvite } from '@/services/mock/data'

export const useHouseholdStore = defineStore('household', () => {
  const household = ref<Household | null>(null)
  const members = ref<HouseholdMember[]>([])
  const invite = ref<InviteToken | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const hasHousehold = computed(() => !!household.value)
  const memberCount = computed(() => members.value.length)
  const isAdmin = computed(() => {
    const userId = localStorage.getItem('user_id') || 'u1'
    return members.value.find(m => m.userId === userId)?.role === 'admin'
  })

  async function loadHousehold() {
    loading.value = true
    error.value = null
    try {
      await delay(300)
      household.value = mockHousehold
      members.value = mockMembers
      invite.value = mockInvite
      localStorage.setItem('household_id', mockHousehold.id)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load household'
    } finally {
      loading.value = false
    }
  }

  async function createHousehold(dto: CreateHouseholdDTO) {
    loading.value = true
    error.value = null
    try {
      await delay(600)
      const newHousehold: Household = {
        id: generateId(),
        name: dto.name,
        color: dto.color,
        createdAt: new Date().toISOString(),
        memberCount: 1,
      }
      household.value = newHousehold
      members.value = [{
        id: generateId(),
        userId: 'u1',
        householdId: newHousehold.id,
        displayName: 'Sarah Chen',
        role: 'admin',
        joinedAt: new Date().toISOString(),
      }]
      invite.value = {
        code: `${dto.name.replace(/\s/g, '-').toUpperCase().slice(0, 8)}-${generateId().slice(0, 4).toUpperCase()}`,
        householdId: newHousehold.id,
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        createdBy: 'u1',
      }
      localStorage.setItem('household_id', newHousehold.id)
      return newHousehold
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to create household'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function joinHousehold(dto: JoinHouseholdDTO) {
    loading.value = true
    error.value = null
    try {
      await delay(800)
      if (dto.inviteCode.length < 4) {
        throw new Error('Invalid invite code')
      }
      // Mock: just load the existing household
      household.value = mockHousehold
      members.value = mockMembers
      invite.value = mockInvite
      localStorage.setItem('household_id', mockHousehold.id)
      return mockHousehold
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to join household'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function regenerateInvite() {
    loading.value = true
    try {
      await delay(400)
      invite.value = {
        code: `INVITE-${generateId().slice(0, 6).toUpperCase()}`,
        householdId: household.value?.id || '',
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        createdBy: 'u1',
      }
    } finally {
      loading.value = false
    }
  }

  function leaveHousehold() {
    household.value = null
    members.value = []
    invite.value = null
    localStorage.removeItem('household_id')
  }

  return {
    household,
    members,
    invite,
    loading,
    error,
    hasHousehold,
    memberCount,
    isAdmin,
    loadHousehold,
    createHousehold,
    joinHousehold,
    regenerateInvite,
    leaveHousehold,
  }
})
