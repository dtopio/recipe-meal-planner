import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MealSlot, MealType, Recipe } from '@/types'
import { delay, generateId } from '@/services/api/client'
import { mockMealSlots } from '@/services/mock/data'

export const usePlannerStore = defineStore('planner', () => {
  const slots = ref<MealSlot[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentWeekStart = ref('2026-03-09')

  const weekDates = computed(() => {
    const start = new Date(currentWeekStart.value)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d.toISOString().split('T')[0]
    })
  })

  const slotsByDate = computed(() => {
    const map = new Map<string, MealSlot[]>()
    for (const date of weekDates.value) {
      map.set(date, slots.value.filter(s => s.date === date))
    }
    return map
  })

  function getSlot(date: string, mealType: MealType): MealSlot | undefined {
    return slots.value.find(s => s.date === date && s.mealType === mealType)
  }

  async function loadWeekPlan() {
    loading.value = true
    error.value = null
    try {
      await delay(400)
      slots.value = [...mockMealSlots]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load meal plan'
    } finally {
      loading.value = false
    }
  }

  async function assignMeal(date: string, mealType: MealType, recipe: Recipe) {
    const existing = slots.value.find(s => s.date === date && s.mealType === mealType)
    if (existing) {
      existing.recipeId = recipe.id
      existing.recipe = recipe
    } else {
      slots.value.push({
        id: generateId(),
        date,
        mealType,
        recipeId: recipe.id,
        recipe,
      })
    }
  }

  async function removeMeal(date: string, mealType: MealType) {
    const slot = slots.value.find(s => s.date === date && s.mealType === mealType)
    if (slot) {
      slot.recipeId = undefined
      slot.recipe = undefined
    }
  }

  function navigateWeek(direction: 'prev' | 'next') {
    const start = new Date(currentWeekStart.value)
    start.setDate(start.getDate() + (direction === 'next' ? 7 : -7))
    currentWeekStart.value = start.toISOString().split('T')[0]
    // In real app, would reload data for new week
  }

  /** Count assigned meals this week */
  const assignedMealCount = computed(() =>
    slots.value.filter(s => s.recipeId).length
  )

  /** Get today's meals */
  const todaysMeals = computed(() => {
    const today = '2026-03-11' // Mock "today"
    return slots.value.filter(s => s.date === today && s.recipeId)
  })

  return {
    slots,
    loading,
    error,
    currentWeekStart,
    weekDates,
    slotsByDate,
    assignedMealCount,
    todaysMeals,
    getSlot,
    loadWeekPlan,
    assignMeal,
    removeMeal,
    navigateWeek,
  }
})
