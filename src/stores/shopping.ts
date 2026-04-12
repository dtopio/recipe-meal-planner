import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ShoppingListItem,
  ShoppingCategory,
  ShoppingPeriod,
  AddShoppingItemDTO,
  ApiError,
  ShoppingGenerationSummary,
  ShoppingAiSummary,
} from '@/types'
import { SHOPPING_CATEGORIES } from '@/types'
import { apiClient } from '@/services/api/client'
import { syncService } from '@/services/sync/socket'
import { getDateKeyFromDateTime, getStartOfWeekDateKey, getTodayDateKey } from '@/utils/date'

export const useShoppingStore = defineStore('shopping', () => {
  const items = ref<ShoppingListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const filterCategory = ref<ShoppingCategory | null>(null)
  const periodFilter = ref<ShoppingPeriod>('all')
  const periodWeekStart = ref(getStartOfWeekDateKey())
  const lastGenerationSummary = ref<ShoppingGenerationSummary | null>(null)
  const aiSummary = ref<ShoppingAiSummary | null>(null)
  const aiSummaryLoading = ref(false)
  const aiSummaryError = ref<string | null>(null)
  let loadPromise: Promise<void> | null = null

  const allItemCount = computed(() => items.value.length)

  const periodItems = computed(() => {
    if (periodFilter.value === 'all') {
      return items.value
    }

    const today = getTodayDateKey()
    const weekStart = periodWeekStart.value
    const weekEndDate = new Date(`${weekStart}T00:00:00`)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEnd = weekEndDate.toISOString().split('T')[0]
    const monthPrefix = today.slice(0, 7)

    return items.value.filter(item => {
      const itemDate = getDateKeyFromDateTime(item.addedAt)

      if (periodFilter.value === 'day') {
        return itemDate === today
      }

      if (periodFilter.value === 'week') {
        return itemDate >= weekStart && itemDate <= weekEnd
      }

      if (periodFilter.value === 'month') {
        return itemDate.startsWith(monthPrefix)
      }

      return true
    })
  })

  const uncheckedItems = computed(() => periodItems.value.filter(i => !i.checked))
  const checkedItems = computed(() => periodItems.value.filter(i => i.checked))
  const totalItems = computed(() => periodItems.value.length)
  const remainingItems = computed(() => uncheckedItems.value.length)

  const progress = computed(() => {
    if (totalItems.value === 0) return 0
    return Math.round((checkedItems.value.length / totalItems.value) * 100)
  })

  const filteredItems = computed(() => {
    let result = uncheckedItems.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(i => i.name.toLowerCase().includes(q))
    }
    if (filterCategory.value) {
      result = result.filter(i => i.category === filterCategory.value)
    }
    return result
  })

  const itemsByCategory = computed(() => {
    const map = new Map<ShoppingCategory, ShoppingListItem[]>()
    for (const cat of SHOPPING_CATEGORIES) {
      const catItems = filteredItems.value.filter(i => i.category === cat)
      if (catItems.length > 0) {
        map.set(cat, catItems)
      }
    }
    return map
  })

  const pendingSyncCount = computed(() =>
    items.value.filter(i => i.syncStatus === 'pending').length
  )

  function upsertItem(item: ShoppingListItem) {
    const index = items.value.findIndex(candidate => candidate.id === item.id)
    if (index === -1) {
      items.value.push(item)
    } else {
      items.value[index] = item
    }
  }

  async function loadItems() {
    if (loadPromise) return loadPromise

    loading.value = true
    error.value = null
    loadPromise = apiClient<{ items: ShoppingListItem[]; total: number }>('/shopping?limit=200')
      .then(({ data }) => { items.value = data.items })
      .catch((e: unknown) => { error.value = getErrorMessage(e, 'Failed to load shopping list') })
      .finally(() => { loading.value = false; loadPromise = null })

    return loadPromise
  }

  async function toggleItem(id: string) {
    const item = items.value.find(i => i.id === id)
    if (!item) return

    const previousChecked = item.checked
    item.checked = !item.checked
    item.syncStatus = 'pending'
    syncService.addPending()

    try {
      const { data } = await apiClient<ShoppingListItem>(`/shopping/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: item.checked }),
      })

      upsertItem(data)
    } catch (e: unknown) {
      item.checked = previousChecked
      item.syncStatus = 'error'
      error.value = getErrorMessage(e, 'Failed to update item')
    } finally {
      const latestItem = items.value.find(candidate => candidate.id === id)
      if (latestItem && latestItem.syncStatus !== 'error') {
        latestItem.syncStatus = 'synced'
      }
      syncService.resolvePending()
    }
  }

  async function addItem(dto: AddShoppingItemDTO) {
    syncService.addPending()
    try {
      const { data } = await apiClient<ShoppingListItem>('/shopping', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      upsertItem(data)
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to add shopping item')
      throw new Error(error.value)
    } finally {
      syncService.resolvePending()
    }
  }

  async function removeItem(id: string) {
    await apiClient<boolean>(`/shopping/${id}`, {
      method: 'DELETE',
    })
    items.value = items.value.filter(i => i.id !== id)
  }

  async function clearChecked(weekStart?: string) {
    const targetWeekStart = weekStart || periodWeekStart.value
    const checkedIds = new Set(checkedItems.value.map(item => item.id))

    await apiClient<boolean>('/shopping/checked', {
      method: 'DELETE',
      body: JSON.stringify({
        ...(targetWeekStart ? { weekStart: targetWeekStart } : {}),
        period: periodFilter.value,
      }),
    })
    items.value = items.value.filter(i => !checkedIds.has(i.id))
  }

  async function clearAll() {
    loading.value = true
    error.value = null

    try {
      await apiClient<boolean>('/shopping', {
        method: 'DELETE',
      })
      items.value = []
      aiSummary.value = null
      lastGenerationSummary.value = null
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to clear shopping list')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function addRecipeIngredients(recipeId: string, recipeName: string, ingredients: { name: string; quantity: number; unit: string }[]) {
    loading.value = true
    try {
      const { data } = await apiClient<ShoppingListItem[]>('/shopping/recipe-ingredients', {
        method: 'POST',
        body: JSON.stringify({
          recipeId,
          recipeName,
          ingredients,
        }),
      })

      for (const item of data) {
        upsertItem(item)
      }
    } finally {
      loading.value = false
    }
  }

  async function generateFromPlan(weekStart?: string) {
    loading.value = true
    error.value = null

    try {
      const { data } = await apiClient<ShoppingGenerationSummary>('/shopping/generate', {
        method: 'POST',
        body: JSON.stringify(weekStart ? { weekStart } : {}),
      })

      lastGenerationSummary.value = data
      await loadItems()
      return data
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to generate shopping list')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function generateSummary(weekStart?: string, force = false, period = periodFilter.value) {
    if (!force && aiSummary.value && (!weekStart || aiSummary.value.weekStart === weekStart) && aiSummary.value.period === period) {
      return aiSummary.value
    }

    aiSummaryLoading.value = true
    aiSummaryError.value = null

    try {
      const { data } = await apiClient<ShoppingAiSummary>('/shopping/summary', {
        method: 'POST',
        body: JSON.stringify({
          ...(weekStart ? { weekStart } : {}),
          period,
        }),
      })

      aiSummary.value = data
      return data
    } catch (err: unknown) {
      aiSummaryError.value = getErrorMessage(err, 'Failed to generate shopping summary')
      throw new Error(aiSummaryError.value)
    } finally {
      aiSummaryLoading.value = false
    }
  }

  return {
    items,
    loading,
    error,
    searchQuery,
    filterCategory,
    periodFilter,
    periodWeekStart,
    lastGenerationSummary,
    aiSummary,
    aiSummaryLoading,
    aiSummaryError,
    allItemCount,
    periodItems,
    uncheckedItems,
    checkedItems,
    totalItems,
    remainingItems,
    progress,
    filteredItems,
    itemsByCategory,
    pendingSyncCount,
    loadItems,
    toggleItem,
    addItem,
    removeItem,
    clearChecked,
    clearAll,
    addRecipeIngredients,
    generateFromPlan,
    generateSummary,
  }
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
