import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AddPantryItemDTO, ApiError, PantryItem, ShoppingCategory, UpdatePantryItemDTO } from '@/types'
import { SHOPPING_CATEGORIES } from '@/types'
import { apiClient } from '@/services/api/client'

export const usePantryStore = defineStore('pantry', () => {
  const items = ref<PantryItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const filterCategory = ref<ShoppingCategory | null>(null)
  let loadPromise: Promise<void> | null = null

  const filteredItems = computed(() => {
    let result = [...items.value]

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(item => item.name.toLowerCase().includes(query))
    }

    if (filterCategory.value) {
      result = result.filter(item => item.category === filterCategory.value)
    }

    return result.sort((left, right) => left.name.localeCompare(right.name))
  })

  const itemsByCategory = computed(() => {
    const grouped = new Map<ShoppingCategory, PantryItem[]>()

    for (const category of SHOPPING_CATEGORIES) {
      const categoryItems = filteredItems.value.filter(item => item.category === category)
      if (categoryItems.length > 0) {
        grouped.set(category, categoryItems)
      }
    }

    return grouped
  })

  const lowStockItems = computed(() =>
    items.value.filter(item => item.quantity <= item.lowStockThreshold)
      .sort((left, right) => left.quantity - right.quantity)
  )

  const totalUnitsTracked = computed(() =>
    items.value.reduce((total, item) => total + item.quantity, 0)
  )

  function upsertItem(item: PantryItem) {
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
    loadPromise = apiClient<{ items: PantryItem[]; total: number }>('/pantry?limit=200')
      .then(({ data }) => { items.value = data.items })
      .catch((err: unknown) => { error.value = getErrorMessage(err, 'Failed to load pantry') })
      .finally(() => { loading.value = false; loadPromise = null })

    return loadPromise
  }

  async function addItem(dto: AddPantryItemDTO) {
    loading.value = true
    error.value = null

    try {
      const { data } = await apiClient<PantryItem>('/pantry', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      upsertItem(data)
      return data
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to add pantry item')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function updateItem(dto: UpdatePantryItemDTO) {
    loading.value = true
    error.value = null

    try {
      const { data } = await apiClient<PantryItem>(`/pantry/${dto.id}`, {
        method: 'PATCH',
        body: JSON.stringify(dto),
      })

      upsertItem(data)
      return data
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to update pantry item')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function adjustQuantity(itemId: string, delta: number) {
    const item = items.value.find(candidate => candidate.id === itemId)
    if (!item) return

    return updateItem({
      id: itemId,
      quantity: Math.max(0, Number((item.quantity + delta).toFixed(2))),
    })
  }

  async function removeItem(itemId: string) {
    loading.value = true
    error.value = null

    try {
      await apiClient<boolean>(`/pantry/${itemId}`, {
        method: 'DELETE',
      })

      items.value = items.value.filter(item => item.id !== itemId)
    } catch (err: unknown) {
      error.value = getErrorMessage(err, 'Failed to remove pantry item')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    loading,
    error,
    searchQuery,
    filterCategory,
    filteredItems,
    itemsByCategory,
    lowStockItems,
    totalUnitsTracked,
    loadItems,
    addItem,
    updateItem,
    adjustQuantity,
    removeItem,
  }
})

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
