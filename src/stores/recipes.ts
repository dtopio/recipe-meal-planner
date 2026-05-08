import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Recipe, CreateRecipeDTO, UpdateRecipeDTO, ImportRecipeDTO, ApiError } from '@/types'
import { apiClient } from '@/services/api/client'

export const useRecipeStore = defineStore('recipes', () => {
  const recipes = ref<Recipe[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const activeTag = ref<string | null>(null)
  const sortBy = ref<'newest' | 'name' | 'prep-time'>('newest')
  let loadPromise: Promise<void> | null = null

  const allTags = computed(() =>
    Array.from(new Set(recipes.value.flatMap(recipe => recipe.tags))).sort()
  )

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
    if (loadPromise) return loadPromise

    loading.value = true
    error.value = null
    loadPromise = apiClient<{ items: Recipe[]; total: number }>('/recipes?limit=200')
      .then(({ data }) => { recipes.value = data.items })
      .catch((e: unknown) => { error.value = getErrorMessage(e, 'Failed to load recipes') })
      .finally(() => { loading.value = false; loadPromise = null })

    return loadPromise
  }

  function getRecipe(id: string): Recipe | undefined {
    return recipes.value.find(r => r.id === id)
  }

  async function createRecipe(dto: CreateRecipeDTO): Promise<Recipe> {
    loading.value = true
    error.value = null
    try {
      const { data: recipe } = await apiClient<Recipe>('/recipes', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      recipes.value.unshift(recipe)
      return recipe
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to create recipe')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function updateRecipe(dto: UpdateRecipeDTO): Promise<Recipe> {
    loading.value = true
    error.value = null
    try {
      const { data: updated } = await apiClient<Recipe>(`/recipes/${dto.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: dto.title,
          description: dto.description,
          imageUrl: dto.imageUrl,
          prepTime: dto.prepTime,
          cookTime: dto.cookTime,
          servings: dto.servings,
          tags: dto.tags,
          ingredients: dto.ingredients,
          instructions: dto.instructions,
          nutrition: dto.nutrition,
        }),
      })

      const idx = recipes.value.findIndex(r => r.id === dto.id)
      if (idx === -1) {
        recipes.value.unshift(updated)
      } else {
        recipes.value[idx] = updated
      }

      return updated
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to update recipe')
      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function importRecipe(dto: ImportRecipeDTO): Promise<Recipe> {
    loading.value = true
    error.value = null
    try {
      const { data: recipe } = await apiClient<Recipe>('/recipes/import', {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      recipes.value.unshift(recipe)
      return recipe
    } catch (e: unknown) {
      const apiError = e as ApiError
      error.value = getErrorMessage(e, 'Failed to import recipe')

      if (apiError?.code === 'DUPLICATE_RECIPE_SOURCE') {
        const existingRecipe = apiError.details?.existingRecipe as { id?: string; title?: string } | undefined
        if (existingRecipe?.id && existingRecipe?.title) {
          throw new Error(`DUPLICATE:${existingRecipe.id}:${existingRecipe.title}`)
        }
      }

      throw new Error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function deleteRecipe(id: string) {
    loading.value = true
    try {
      await apiClient<boolean>(`/recipes/${id}`, {
        method: 'DELETE',
      })
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as ApiError).message)
  }

  return fallback
}
