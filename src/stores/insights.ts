import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  ApiError,
  RecipeAiSummary,
  RecipeNutritionSummary,
  WeeklyNutritionSummary,
} from '@/types'
import { apiClient } from '@/services/api/client'

export const useInsightsStore = defineStore('insights', () => {
  const recipeNutritionById = ref<Record<string, RecipeNutritionSummary>>({})
  const recipeNutritionLoading = ref<Record<string, boolean>>({})
  const recipeNutritionErrors = ref<Record<string, string | null>>({})

  const recipeSummaryById = ref<Record<string, RecipeAiSummary>>({})
  const recipeSummaryLoading = ref<Record<string, boolean>>({})
  const recipeSummaryErrors = ref<Record<string, string | null>>({})

  const weekNutritionByStart = ref<Record<string, WeeklyNutritionSummary>>({})
  const weekNutritionLoading = ref<Record<string, boolean>>({})
  const weekNutritionErrors = ref<Record<string, string | null>>({})
  const periodNutritionByKey = ref<Record<string, WeeklyNutritionSummary>>({})
  const periodNutritionLoading = ref<Record<string, boolean>>({})
  const periodNutritionErrors = ref<Record<string, string | null>>({})

  function setLoading(target: typeof recipeNutritionLoading.value, key: string, value: boolean) {
    target[key] = value
  }

  async function loadRecipeNutrition(recipeId: string, force = false) {
    if (!force && recipeNutritionById.value[recipeId]) {
      return recipeNutritionById.value[recipeId]
    }

    setLoading(recipeNutritionLoading.value, recipeId, true)
    recipeNutritionErrors.value[recipeId] = null

    try {
      const { data } = await apiClient<RecipeNutritionSummary>(`/recipes/${recipeId}/nutrition`)
      recipeNutritionById.value[recipeId] = data
      return data
    } catch (error: unknown) {
      recipeNutritionErrors.value[recipeId] = getErrorMessage(error, 'Failed to load nutrition estimate')
      throw new Error(recipeNutritionErrors.value[recipeId] || 'Failed to load nutrition estimate')
    } finally {
      setLoading(recipeNutritionLoading.value, recipeId, false)
    }
  }

  async function loadRecipeSummary(recipeId: string, force = false) {
    if (!force && recipeSummaryById.value[recipeId]) {
      return recipeSummaryById.value[recipeId]
    }

    setLoading(recipeSummaryLoading.value, recipeId, true)
    recipeSummaryErrors.value[recipeId] = null

    try {
      const { data } = await apiClient<RecipeAiSummary>(`/recipes/${recipeId}/summary`, {
        method: 'POST',
      })
      recipeSummaryById.value[recipeId] = data
      return data
    } catch (error: unknown) {
      recipeSummaryErrors.value[recipeId] = getErrorMessage(error, 'Failed to generate AI summary')
      throw new Error(recipeSummaryErrors.value[recipeId] || 'Failed to generate AI summary')
    } finally {
      setLoading(recipeSummaryLoading.value, recipeId, false)
    }
  }

  async function loadWeekNutrition(weekStart: string, force = false) {
    if (!force && weekNutritionByStart.value[weekStart]) {
      return weekNutritionByStart.value[weekStart]
    }

    if (force) {
      delete weekNutritionByStart.value[weekStart]
    }

    setLoading(weekNutritionLoading.value, weekStart, true)
    weekNutritionErrors.value[weekStart] = null

    try {
      const { data } = await apiClient<WeeklyNutritionSummary>(`/planner/nutrition?weekStart=${encodeURIComponent(weekStart)}`)
      weekNutritionByStart.value[weekStart] = data
      return data
    } catch (error: unknown) {
      delete weekNutritionByStart.value[weekStart]
      weekNutritionErrors.value[weekStart] = getErrorMessage(error, 'Failed to load weekly nutrition')
      throw new Error(weekNutritionErrors.value[weekStart] || 'Failed to load weekly nutrition')
    } finally {
      setLoading(weekNutritionLoading.value, weekStart, false)
    }
  }

  async function loadPeriodNutrition(
    period: 'day' | 'week' | 'month',
    value: string,
    force = false
  ) {
    const key = `${period}:${value}`
    if (!force && periodNutritionByKey.value[key]) {
      return periodNutritionByKey.value[key]
    }

    if (force) {
      delete periodNutritionByKey.value[key]
    }

    setLoading(periodNutritionLoading.value, key, true)
    periodNutritionErrors.value[key] = null

    const params = new URLSearchParams({ period })
    if (period === 'day') {
      params.set('date', value)
    } else if (period === 'month') {
      params.set('month', value)
    } else {
      params.set('weekStart', value)
    }

    try {
      const { data } = await apiClient<WeeklyNutritionSummary>(`/planner/nutrition?${params.toString()}`)
      periodNutritionByKey.value[key] = data

      if (period === 'week') {
        weekNutritionByStart.value[value] = data
      }

      return data
    } catch (error: unknown) {
      delete periodNutritionByKey.value[key]
      periodNutritionErrors.value[key] = getErrorMessage(error, 'Failed to load nutrition report')
      throw new Error(periodNutritionErrors.value[key] || 'Failed to load nutrition report')
    } finally {
      setLoading(periodNutritionLoading.value, key, false)
    }
  }

  return {
    recipeNutritionById,
    recipeNutritionLoading,
    recipeNutritionErrors,
    recipeSummaryById,
    recipeSummaryLoading,
    recipeSummaryErrors,
    weekNutritionByStart,
    weekNutritionLoading,
    weekNutritionErrors,
    periodNutritionByKey,
    periodNutritionLoading,
    periodNutritionErrors,
    loadRecipeNutrition,
    loadRecipeSummary,
    loadWeekNutrition,
    loadPeriodNutrition,
  }
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
