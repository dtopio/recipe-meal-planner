import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Recipe, CreateRecipeDTO, UpdateRecipeDTO, ImportRecipeDTO } from '@/types'
import { delay, generateId } from '@/services/api/client'
import { mockRecipes, getAllTags } from '@/services/mock/data'

export const useRecipeStore = defineStore('recipes', () => {
  const recipes = ref<Recipe[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const activeTag = ref<string | null>(null)
  const sortBy = ref<'newest' | 'name' | 'prep-time'>('newest')

  const allTags = computed(() => getAllTags())

  const filteredRecipes = computed(() => {
    let result = [...recipes.value]

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    if (activeTag.value) {
      result = result.filter(r => r.tags.includes(activeTag.value!))
    }

    switch (sortBy.value) {
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'prep-time':
        result.sort((a, b) => (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime))
        break
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    return result
  })

  async function loadRecipes() {
    loading.value = true
    error.value = null
    try {
      await delay(400)
      recipes.value = [...mockRecipes]
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load recipes'
    } finally {
      loading.value = false
    }
  }

  function getRecipe(id: string): Recipe | undefined {
    return recipes.value.find(r => r.id === id)
  }

  async function createRecipe(dto: CreateRecipeDTO): Promise<Recipe> {
    loading.value = true
    error.value = null
    try {
      await delay(600)
      const recipe: Recipe = {
        id: generateId(),
        householdId: localStorage.getItem('household_id') || 'h1',
        ...dto,
        ingredients: dto.ingredients.map(ing => ({ ...ing, id: generateId() })),
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      recipes.value.unshift(recipe)
      return recipe
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to create recipe'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRecipe(dto: UpdateRecipeDTO): Promise<Recipe> {
    loading.value = true
    error.value = null
    try {
      await delay(500)
      const idx = recipes.value.findIndex(r => r.id === dto.id)
      if (idx === -1) throw new Error('Recipe not found')

      const updated: Recipe = {
        ...recipes.value[idx],
        ...dto,
        ingredients: dto.ingredients
          ? dto.ingredients.map(ing => ({ ...ing, id: ('id' in ing ? (ing as { id: string }).id : generateId()) }))
          : recipes.value[idx].ingredients,
        updatedAt: new Date().toISOString(),
      }
      recipes.value[idx] = updated
      return updated
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to update recipe'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function importRecipe(dto: ImportRecipeDTO): Promise<Recipe> {
    loading.value = true
    error.value = null
    try {
      await delay(2000) // Simulate parsing
      // Check for duplicate source URL
      const existing = recipes.value.find(r => r.sourceUrl === dto.url)
      if (existing) {
        throw new Error(`DUPLICATE:${existing.id}:${existing.title}`)
      }
      // Mock imported recipe
      const recipe: Recipe = {
        id: generateId(),
        householdId: localStorage.getItem('household_id') || 'h1',
        title: 'Imported: Mediterranean Quinoa Bowl',
        description: 'A vibrant, healthy quinoa bowl with roasted vegetables, feta, and lemon-herb dressing.',
        imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop',
        prepTime: 15,
        cookTime: 25,
        servings: 4,
        tags: ['healthy', 'mediterranean', 'lunch', 'vegetarian'],
        ingredients: [
          { id: generateId(), quantity: 1, unit: 'cup', name: 'quinoa' },
          { id: generateId(), quantity: 1, unit: 'can', name: 'chickpeas, drained' },
          { id: generateId(), quantity: 1, unit: 'cup', name: 'cherry tomatoes, halved' },
          { id: generateId(), quantity: 1, unit: '', name: 'cucumber, diced' },
          { id: generateId(), quantity: 0.5, unit: 'cup', name: 'feta cheese, crumbled' },
          { id: generateId(), quantity: 0.25, unit: 'cup', name: 'kalamata olives' },
          { id: generateId(), quantity: 3, unit: 'tbsp', name: 'lemon-herb dressing' },
        ],
        instructions: [
          'Cook quinoa according to package directions. Let cool slightly.',
          'Roast chickpeas at 400°F for 20 minutes until crispy.',
          'Combine quinoa, tomatoes, cucumber, and olives in a large bowl.',
          'Top with crispy chickpeas and crumbled feta.',
          'Drizzle with lemon-herb dressing and serve.',
        ],
        sourceUrl: dto.url,
        createdBy: 'u1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      recipes.value.unshift(recipe)
      return recipe
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to import recipe'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteRecipe(id: string) {
    loading.value = true
    try {
      await delay(300)
      recipes.value = recipes.value.filter(r => r.id !== id)
    } finally {
      loading.value = false
    }
  }

  return {
    recipes,
    loading,
    error,
    searchQuery,
    activeTag,
    sortBy,
    allTags,
    filteredRecipes,
    loadRecipes,
    getRecipe,
    createRecipe,
    updateRecipe,
    importRecipe,
    deleteRecipe,
  }
})
