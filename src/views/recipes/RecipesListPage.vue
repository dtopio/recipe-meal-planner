<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import { useHouseholdStore } from '@/stores/household'
import { usePantryStore } from '@/stores/pantry'
import PageHeader from '@/components/layout/PageHeader.vue'
import RecipeCard from '@/components/app/RecipeCard.vue'
import AppEmptyState from '@/components/app/AppEmptyState.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Import, Search, Grid3x3, List, X } from 'lucide-vue-next'
import { formatMinutes } from '@/utils/date'
import {
  getPreferenceConflicts,
  hasLowStockIngredient,
  hasRecipeNutrition,
  isRecipeCompatible,
  isRecipePantryReady,
} from '@/utils/recipe'
import type { Recipe } from '@/types'

type RecipeSmartFilter = 'missing-nutrition' | 'has-nutrition' | 'pantry-ready' | 'low-stock' | 'dietary-conflict'

const router = useRouter()
const store = useRecipeStore()
const household = useHouseholdStore()
const pantry = usePantryStore()
const viewMode = ref<'grid' | 'list'>('grid')
const matchPreferencesOnly = ref(false)
const activeSmartFilters = ref<RecipeSmartFilter[]>([])

const smartFilterOptions: Array<{ value: RecipeSmartFilter; label: string }> = [
  { value: 'missing-nutrition', label: 'Missing nutrition' },
  { value: 'has-nutrition', label: 'Has nutrition' },
  { value: 'pantry-ready', label: 'Pantry-ready' },
  { value: 'low-stock', label: 'Low stock warning' },
  { value: 'dietary-conflict', label: 'Dietary conflict' },
]

const activePreferences = computed(() => household.preferences?.dietaryPreferences || [])
const visibleRecipes = computed(() => {
  let result = store.filteredRecipes.filter(recipe => (
    activeSmartFilters.value.every(filter => matchesSmartFilter(recipe, filter))
  ))

  if (matchPreferencesOnly.value && activePreferences.value.length > 0) {
    result = result.filter(recipe => isRecipeCompatible(recipe, household.preferences))
  }

  return result
})

const hasActiveFilters = computed(() =>
  Boolean(store.searchQuery || store.activeTag || matchPreferencesOnly.value || activeSmartFilters.value.length)
)

onMounted(async () => {
  await Promise.all([
    store.recipes.length === 0 ? store.loadRecipes() : Promise.resolve(),
    pantry.items.length === 0 ? pantry.loadItems() : Promise.resolve(),
    localStorage.getItem('household_id') && !household.preferences ? household.loadHousehold() : Promise.resolve(),
  ])
})

function conflictsFor(recipe: Recipe) {
  return getPreferenceConflicts(recipe, household.preferences)
}

function matchesSmartFilter(recipe: Recipe, filter: RecipeSmartFilter) {
  switch (filter) {
    case 'missing-nutrition':
      return !hasRecipeNutrition(recipe)
    case 'has-nutrition':
      return hasRecipeNutrition(recipe)
    case 'pantry-ready':
      return isRecipePantryReady(recipe, pantry.items)
    case 'low-stock':
      return hasLowStockIngredient(recipe, pantry.items)
    case 'dietary-conflict':
      return conflictsFor(recipe).length > 0
    default:
      return true
  }
}

function toggleSmartFilter(filter: RecipeSmartFilter) {
  activeSmartFilters.value = activeSmartFilters.value.includes(filter)
    ? activeSmartFilters.value.filter(value => value !== filter)
    : [...activeSmartFilters.value, filter]
}

function clearAllFilters() {
  store.searchQuery = ''
  store.activeTag = null
  matchPreferencesOnly.value = false
  activeSmartFilters.value = []
}
</script>

<template>
  <PageHeader title="Recipes" description="Your household recipe collection">
    <template #actions>
      <Button variant="outline" size="sm" @click="router.push('/recipes/import')" class="press-scale">
        <Import class="w-4 h-4 mr-1.5" /> Import
      </Button>
      <Button size="sm" @click="router.push('/recipes/new')" class="shadow-md shadow-primary/10 press-scale">
        <Plus class="w-4 h-4 mr-1.5" /> Add Recipe
      </Button>
    </template>
  </PageHeader>

  <!-- Filters bar -->
  <div class="flex flex-col sm:flex-row gap-3 mb-5">
    <div class="relative flex-1">
      <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        v-model="store.searchQuery"
        placeholder="Search recipes..."
        class="pl-10 h-11"
        :style="{ borderRadius: '0.75rem' }"
      />
      <button
        v-if="store.searchQuery"
        @click="store.searchQuery = ''"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted"
      >
        <X class="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>

    <select
      v-model="store.sortBy"
      class="h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <option value="newest">Newest first</option>
      <option value="name">Name A-Z</option>
      <option value="prep-time">Fastest first</option>
    </select>

    <div class="hidden sm:flex items-center border border-border rounded-xl overflow-hidden">
      <button
        @click="viewMode = 'grid'"
        class="p-2.5 transition-colors"
        :class="viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'"
        aria-label="Grid view"
      >
        <Grid3x3 class="w-4 h-4" />
      </button>
      <button
        @click="viewMode = 'list'"
        class="p-2.5 transition-colors"
        :class="viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'"
        aria-label="List view"
      >
        <List class="w-4 h-4" />
      </button>
    </div>
  </div>

  <!-- Tag chips -->
  <div class="flex gap-2 overflow-x-auto pb-3 mb-5 -mx-1 px-1 snap-x">
    <button
      @click="store.activeTag = null"
      class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
      :class="!store.activeTag ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
    >
      All
    </button>
    <button
      v-for="tag in store.allTags"
      :key="tag"
      @click="store.activeTag = store.activeTag === tag ? null : tag"
      class="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200"
      :class="store.activeTag === tag ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
    >
      {{ tag }}
    </button>
  </div>

  <div class="flex flex-wrap gap-2 mb-5">
    <button
      v-for="option in smartFilterOptions"
      :key="option.value"
      type="button"
      class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      :class="activeSmartFilters.includes(option.value)
        ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/10'
        : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary'"
      @click="toggleSmartFilter(option.value)"
    >
      {{ option.label }}
    </button>
  </div>

  <div v-if="activePreferences.length" class="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-wrap gap-2">
      <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        Household filters
      </span>
      <span
        v-for="preference in activePreferences"
        :key="preference"
        class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
      >
        {{ preference }}
      </span>
    </div>

    <Button
      variant="outline"
      size="sm"
      class="press-scale"
      :class="matchPreferencesOnly ? 'border-primary/30 bg-primary/5 text-primary' : ''"
      @click="matchPreferencesOnly = !matchPreferencesOnly"
    >
      {{ matchPreferencesOnly ? 'Showing only matches' : 'Only show matches' }}
    </Button>
  </div>

  <!-- Loading -->
  <div v-if="store.loading && store.recipes.length === 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    <AppSkeleton v-for="i in 8" :key="i" class="h-64" />
  </div>

  <!-- Empty states -->
  <AppEmptyState
    v-else-if="visibleRecipes.length === 0 && hasActiveFilters"
    icon="🔍"
    title="No recipes found"
    description="No recipes match the current search, tags, pantry, nutrition, or dietary filters. Try adjusting your criteria."
    action-label="Clear all filters"
    @action="clearAllFilters"
  />

  <AppEmptyState
    v-else-if="store.recipes.length === 0"
    icon="🍳"
    title="Your recipe box is empty"
    description="Every great kitchen starts with one recipe. Add your own or import from a URL to get started!"
    action-label="Add Your First Recipe"
    secondary-action-label="Import from URL"
    @action="router.push('/recipes/new')"
    @secondary-action="router.push('/recipes/import')"
  />

  <!-- Grid view -->
  <div v-else-if="viewMode === 'grid'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    <div v-for="recipe in visibleRecipes" :key="recipe.id" class="space-y-2">
      <RecipeCard
        :recipe="recipe"
        @click="router.push(`/recipes/${recipe.id}`)"
      />
      <div v-if="activePreferences.length" class="px-1">
        <span
          v-if="conflictsFor(recipe).length"
          class="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
        >
          Conflicts: {{ conflictsFor(recipe).join(', ') }}
        </span>
        <span
          v-else
          class="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
        >
          Matches household preferences
        </span>
      </div>
      <div class="flex flex-wrap gap-1.5 px-1">
        <span v-if="isRecipePantryReady(recipe, pantry.items)" class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          Pantry-ready
        </span>
        <span v-if="hasLowStockIngredient(recipe, pantry.items)" class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          Low stock
        </span>
      </div>
    </div>
  </div>

  <!-- List view -->
  <div v-else class="space-y-2.5">
    <button
      v-for="recipe in visibleRecipes"
      :key="recipe.id"
      @click="router.push(`/recipes/${recipe.id}`)"
      class="w-full flex items-center gap-4 p-3.5 surface-card hover:shadow-md hover:border-primary/20 transition-all text-left press-scale"
    >
      <img
        v-if="recipe.imageUrl"
        :src="recipe.imageUrl"
        class="w-16 h-16 rounded-xl object-cover shrink-0 ring-1 ring-border/40"
      />
      <div class="flex-1 min-w-0">
        <h3 class="font-bold text-foreground truncate">{{ recipe.title }}</h3>
        <p class="text-xs text-muted-foreground line-clamp-1 mt-0.5">{{ recipe.description }}</p>
        <div class="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span class="font-medium">{{ formatMinutes(recipe.prepTime + recipe.cookTime) }}</span>
          <span>{{ recipe.servings }} servings</span>
          <span v-for="tag in recipe.tags.slice(0, 2)" :key="tag" class="text-primary/60 font-medium">#{{ tag }}</span>
        </div>
        <div v-if="activePreferences.length" class="mt-2">
          <span
            v-if="conflictsFor(recipe).length"
            class="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
          >
            Conflicts: {{ conflictsFor(recipe).join(', ') }}
          </span>
          <span
            v-else
            class="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
          >
            Matches household preferences
          </span>
        </div>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span v-if="isRecipePantryReady(recipe, pantry.items)" class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            Pantry-ready
          </span>
          <span v-if="hasLowStockIngredient(recipe, pantry.items)" class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            Low stock
          </span>
        </div>
      </div>
    </button>
  </div>
</template>
