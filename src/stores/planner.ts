import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AiPlannerDraft, AiPlannerMode, MealSlot, MealType, PlannerBatchActionSummary, Recipe, WeekPlan, ApiError } from '@/types'
import { apiClient } from '@/services/api/client'
import { getStartOfWeekDateKey, getTodayDateKey } from '@/utils/date'

export const usePlannerStore = defineStore('planner', () => {
  const slots = ref<MealSlot[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const updatingSlotIds = ref<Record<string, boolean>>({})
  const currentWeekStart = ref(getStartOfWeekDateKey())
  const aiDraft = ref<AiPlannerDraft | null>(null)
  const aiDraftLoading = ref(false)
  const aiDraftError = ref<string | null>(null)
  let loadPromise: Promise<void> | null = null

  const weekDates = computed(() => {
    const start = new Date(currentWeekStart.value + 'T00:00:00')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  })

  const slotsByDate = computed(() => {
    const map = new Map<string, MealSlot[]>()
    for (const date of weekDates.value) {
      map.set(date, slots.value.filter(s => s.date === date))
    }
    return map
  })

  function getSlots(date: string, mealType: MealType): MealSlot[] {
    return slots.value.filter(s => s.date === date && s.mealType === mealType)
  }

  function getSlot(date: string, mealType: MealType): MealSlot | undefined {
    return getSlots(date, mealType)[0]
  }

  function upsertSlot(slot: MealSlot) {
    const index = slots.value.findIndex(candidate => candidate.id === slot.id)
    if (index === -1) {
      slots.value.push(slot)
    } else {
      slots.value[index] = slot
    }
  }

  function removeSlot(slotId: string) {
    slots.value = slots.value.filter(slot => slot.id !== slotId)
  }

  async function loadWeekPlan(weekStart = currentWeekStart.value) {
    if (loadPromise && weekStart === currentWeekStart.value) return loadPromise

    loading.value = true
    error.value = null
    loadPromise = apiClient<WeekPlan>(`/planner?weekStart=${encodeURIComponent(weekStart)}`)
      .then(({ data }) => { currentWeekStart.value = data.weekStart; slots.value = data.slots })
      .catch((e: unknown) => { error.value = getErrorMessage(e, 'Failed to load meal plan') })
      .finally(() => { loading.value = false; loadPromise = null })

    return loadPromise
  }

  async function assignMeal(date: string, mealType: MealType, recipe: Recipe, servings?: number) {
    const { data } = await apiClient<MealSlot>('/planner/slot', {
      method: 'PUT',
      body: JSON.stringify({
        date,
        mealType,
        recipeId: recipe.id,
        ...(servings ? { servings } : {}),
      }),
    })

    upsertSlot(data)
    return data
  }

  async function removeMeal(slotId: string) {
    await apiClient<boolean>(`/planner/slot/${slotId}`, {
      method: 'DELETE',
    })

    removeSlot(slotId)
  }

  async function updateMealServings(slotId: string, servings: number) {
    updatingSlotIds.value[slotId] = true

    try {
      const { data } = await apiClient<MealSlot>(`/planner/slot/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ servings }),
      })

      upsertSlot(data)
      return data
    } finally {
      updatingSlotIds.value[slotId] = false
    }
  }

  async function setMealRecurring(slotId: string, repeatWeekly: boolean) {
    updatingSlotIds.value[slotId] = true

    try {
      const { data } = await apiClient<MealSlot>(`/planner/slot/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify({ repeatWeekly }),
      })

      upsertSlot(data)
      return data
    } finally {
      updatingSlotIds.value[slotId] = false
    }
  }

  async function copyLastWeek(weekStart = currentWeekStart.value) {
    const { data } = await apiClient<PlannerBatchActionSummary>('/planner/copy-last-week', {
      method: 'POST',
      body: JSON.stringify({ weekStart }),
    })

    currentWeekStart.value = data.weekStart
    slots.value = data.slots
    return data
  }

  async function applyRecurringMeals(weekStart = currentWeekStart.value) {
    const { data } = await apiClient<PlannerBatchActionSummary>('/planner/apply-recurring', {
      method: 'POST',
      body: JSON.stringify({ weekStart }),
    })

    currentWeekStart.value = data.weekStart
    slots.value = data.slots
    return data
  }

  async function generateAiDraft(mode: AiPlannerMode, weekStart = currentWeekStart.value) {
    aiDraftLoading.value = true
    aiDraftError.value = null

    try {
      const { data } = await apiClient<AiPlannerDraft>('/planner/ai-draft', {
        method: 'POST',
        body: JSON.stringify({ mode, weekStart }),
      })

      aiDraft.value = data
      return data
    } catch (e: unknown) {
      aiDraftError.value = getErrorMessage(e, 'Failed to generate AI planner draft')
      throw new Error(aiDraftError.value)
    } finally {
      aiDraftLoading.value = false
    }
  }

  function clearAiDraft() {
    aiDraft.value = null
    aiDraftError.value = null
  }

  async function navigateWeek(direction: 'prev' | 'next') {
    const start = new Date(currentWeekStart.value + 'T00:00:00')
    start.setDate(start.getDate() + (direction === 'next' ? 7 : -7))
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    await loadWeekPlan(key)
  }

  const assignedMealCount = computed(() =>
    slots.value.filter(s => s.recipeId).length
  )

  const todaysMeals = computed(() => {
    const today = getTodayDateKey()
    return slots.value.filter(s => s.date === today && s.recipeId)
  })

  return {
    slots,
    loading,
    error,
    updatingSlotIds,
    currentWeekStart,
    aiDraft,
    aiDraftLoading,
    aiDraftError,
    weekDates,
    slotsByDate,
    getSlots,
    assignedMealCount,
    todaysMeals,
    getSlot,
    loadWeekPlan,
    assignMeal,
    removeMeal,
    updateMealServings,
    setMealRecurring,
    copyLastWeek,
    applyRecurringMeals,
    generateAiDraft,
    clearAiDraft,
    navigateWeek,
  }
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
