import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ShoppingListItem, ShoppingCategory, AddShoppingItemDTO } from '@/types'
import { SHOPPING_CATEGORIES } from '@/types'
import { delay, generateId } from '@/services/api/client'
import { mockShoppingItems } from '@/services/mock/data'
import { syncService } from '@/services/sync/socket'

export const useShoppingStore = defineStore('shopping', () => {
  const items = ref<ShoppingListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const filterCategory = ref<ShoppingCategory | null>(null)

  const uncheckedItems = computed(() => items.value.filter(i => !i.checked))
  const checkedItems = computed(() => items.value.filter(i => i.checked))
  const totalItems = computed(() => items.value.length)
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

  async function loadItems() {
    loading.value = true
    error.value = null
    try {
      await delay(400)
      items.value = [...mockShoppingItems]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load shopping list'
    } finally {
      loading.value = false
    }
  }

  async function toggleItem(id: string) {
    const item = items.value.find(i => i.id === id)
    if (!item) return

    // Optimistic update
    item.checked = !item.checked
    item.syncStatus = 'pending'
    syncService.addPending()

    // Simulate sync
    await delay(300)
    item.syncStatus = 'synced'
    syncService.resolvePending()
  }

  async function addItem(dto: AddShoppingItemDTO) {
    const newItem: ShoppingListItem = {
      id: generateId(),
      householdId: localStorage.getItem('household_id') || 'h1',
      name: dto.name,
      quantity: dto.quantity,
      unit: dto.unit,
      category: dto.category,
      checked: false,
      addedBy: 'u1',
      addedAt: new Date().toISOString(),
      syncStatus: 'pending',
    }

    items.value.push(newItem)
    syncService.addPending()

    await delay(400)
    newItem.syncStatus = 'synced'
    syncService.resolvePending()
  }

  async function removeItem(id: string) {
    items.value = items.value.filter(i => i.id !== id)
  }

  async function clearChecked() {
    items.value = items.value.filter(i => !i.checked)
  }

  async function addRecipeIngredients(recipeId: string, recipeName: string, ingredients: { name: string; quantity: number; unit: string }[]) {
    loading.value = true
    try {
      await delay(300)
      for (const ing of ingredients) {
        const existing = items.value.find(i => i.name.toLowerCase() === ing.name.toLowerCase() && !i.checked)
        if (!existing) {
          items.value.push({
            id: generateId(),
            householdId: localStorage.getItem('household_id') || 'h1',
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            category: guessCategory(ing.name),
            checked: false,
            sourceRecipeId: recipeId,
            sourceRecipeName: recipeName,
            addedBy: 'u1',
            addedAt: new Date().toISOString(),
            syncStatus: 'synced',
          })
        }
      }
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
    addRecipeIngredients,
  }
})

/** Simple category guesser based on ingredient name */
function guessCategory(name: string): ShoppingCategory {
  const n = name.toLowerCase()
  if (/lettuce|tomato|onion|garlic|pepper|basil|mushroom|broccoli|avocado|lime|lemon|cucumber|berry|fruit/.test(n)) return 'produce'
  if (/milk|yogurt|cheese|cream|egg|butter/.test(n)) return 'dairy'
  if (/chicken|beef|pork|salmon|fish|pancetta|shrimp|meat/.test(n)) return 'meat'
  if (/bread|tortilla|brioche|bun|roll/.test(n)) return 'bakery'
  if (/frozen/.test(n)) return 'frozen'
  if (/paper|soap|sponge|wrap|foil|bag/.test(n)) return 'household'
  return 'pantry'
}
