<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import { useShoppingStore } from '@/stores/shopping'
import { useHouseholdStore } from '@/stores/household'
import { usePantryStore } from '@/stores/pantry'
import { useInsightsStore } from '@/stores/insights'
import { useAuthStore } from '@/stores/auth'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMinutes } from '@/utils/date'
import { getPantryCoverage, getPreferenceConflicts, getRecipeDietaryProfile, getRecipeHealthFit } from '@/utils/recipe'
import { apiClient } from '@/services/api/client'
import {
  ArrowLeft, Clock, Users, Edit, ChefHat, ShoppingCart, CalendarPlus,
  Minus, Plus, ExternalLink, Trash2, Sparkles, Loader2, Star, MessageSquare, Send
} from 'lucide-vue-next'
import { DEFAULT_HEALTH_TARGETS } from '@/types'
import type { Recipe, RecipeIngredient, RecipeAiAskResponse, RecipeReview, RecipeReviewSummary } from '@/types'
import { useUiStore } from '@/stores/ui'
import { toast } from 'vue-sonner'

const props = defineProps<{ recipeId: string }>()
const router = useRouter()
const store = useRecipeStore()
const shopping = useShoppingStore()
const household = useHouseholdStore()
const pantry = usePantryStore()
const insights = useInsightsStore()
const auth = useAuthStore()
const ui = useUiStore()

const recipe = ref<Recipe | undefined>()
const scaleMultiplier = ref(1)
const aiAskQuestion = ref('')
const aiAskResult = ref<RecipeAiAskResponse | null>(null)
const aiAskLoading = ref(false)
const aiAskError = ref<string | null>(null)
// Review state
const reviews = ref<RecipeReview[]>([])
const averageRating = ref<number | null>(null)
const totalReviews = ref(0)
const myRating = ref(0)
const myNote = ref('')
const reviewSubmitting = ref(false)
const showReviewForm = ref(false)

const quickAskPrompts = [
  'Good for breakfast?',
  'Good for lunch?',
  'Good for dinner?',
  'Good for meal prep?',
  'Is this healthy for me?',
  'Is this high enough in protein?',
]

const scaledServings = computed(() => (recipe.value?.servings || 1) * scaleMultiplier.value)
const dietaryProfile = computed(() => (recipe.value ? getRecipeDietaryProfile(recipe.value) : null))
const activePreferences = computed(() => household.preferences?.dietaryPreferences || [])
const preferenceConflicts = computed(() =>
  recipe.value ? getPreferenceConflicts(recipe.value, household.preferences) : []
)
const nutrition = computed(() => (
  recipe.value ? insights.recipeNutritionById[recipe.value.id] || null : null
))
const healthTargets = computed(() => auth.user?.healthTargets || DEFAULT_HEALTH_TARGETS)
const healthFit = computed(() => (
  nutrition.value ? getRecipeHealthFit(nutrition.value.perServing, healthTargets.value) : null
))
const nutritionLoading = computed(() => (
  recipe.value ? Boolean(insights.recipeNutritionLoading[recipe.value.id]) : false
))
const nutritionError = computed(() => (
  recipe.value ? insights.recipeNutritionErrors[recipe.value.id] || null : null
))
const aiSummary = computed(() => (
  recipe.value ? insights.recipeSummaryById[recipe.value.id] || null : null
))
const aiSummaryLoading = computed(() => (
  recipe.value ? Boolean(insights.recipeSummaryLoading[recipe.value.id]) : false
))
const aiSummaryError = computed(() => (
  recipe.value ? insights.recipeSummaryErrors[recipe.value.id] || null : null
))
const coverageByIngredient = computed(() => {
  const coverage = new Map<string, ReturnType<typeof getPantryCoverage>>()

  if (!recipe.value) {
    return coverage
  }

  for (const ingredient of recipe.value.ingredients) {
    coverage.set(
      ingredient.id,
      getPantryCoverage(
        pantry.items,
        ingredient.name,
        ingredient.unit,
        ingredient.quantity * scaleMultiplier.value
      )
    )
  }

  return coverage
})

async function loadNutritionEstimate(recipeId: string) {
  try {
    await insights.loadRecipeNutrition(recipeId)
  } catch {
    // surfaced through store error state
  }
}

onMounted(async () => {
  await Promise.all([
    store.recipes.length === 0 ? store.loadRecipes() : Promise.resolve(),
    localStorage.getItem('household_id') && !household.preferences ? household.loadHousehold() : Promise.resolve(),
    localStorage.getItem('household_id') && pantry.items.length === 0 ? pantry.loadItems() : Promise.resolve(),
  ])
  recipe.value = store.getRecipe(props.recipeId)
  aiAskQuestion.value = ''
  aiAskResult.value = null
  aiAskError.value = null
  if (recipe.value) {
    await Promise.all([
      loadNutritionEstimate(recipe.value.id),
      loadReviews(recipe.value.id),
    ])
  }
})

watch(() => props.recipeId, () => {
  recipe.value = store.getRecipe(props.recipeId)
  aiAskQuestion.value = ''
  aiAskResult.value = null
  aiAskError.value = null
  reviews.value = []
  myRating.value = 0
  myNote.value = ''
  if (recipe.value) {
    loadNutritionEstimate(recipe.value.id)
    loadReviews(recipe.value.id)
  }
})

function scaleUp() { scaleMultiplier.value = Math.min(scaleMultiplier.value + 0.5, 5) }
function scaleDown() { scaleMultiplier.value = Math.max(scaleMultiplier.value - 0.5, 0.5) }

function formatQuantity(value: number) {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

function getIngredientCoverage(ingredient: RecipeIngredient) {
  return coverageByIngredient.value.get(ingredient.id) || {
    matchedQuantity: 0,
    hasEnough: false,
    missingQuantity: ingredient.quantity * scaleMultiplier.value,
  }
}

function getVerdictClasses(verdict: RecipeAiAskResponse['verdict']) {
  if (verdict === 'good-fit') {
    return 'bg-emerald-500/10 text-emerald-700'
  }

  if (verdict === 'not-ideal') {
    return 'bg-rose-500/10 text-rose-700'
  }

  return 'bg-amber-500/10 text-amber-700'
}

function getHealthFitClasses(verdict: 'good-fit' | 'mixed' | 'not-ideal') {
  if (verdict === 'good-fit') {
    return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700'
  }

  if (verdict === 'not-ideal') {
    return 'border-rose-500/20 bg-rose-500/5 text-rose-700'
  }

  return 'border-amber-500/20 bg-amber-500/5 text-amber-700'
}

async function addToShoppingList() {
  if (!recipe.value) return

  try {
    await shopping.addRecipeIngredients(
      recipe.value.id,
      recipe.value.title,
      recipe.value.ingredients.map(i => ({
        name: i.name,
        quantity: i.quantity * scaleMultiplier.value,
        unit: i.unit,
      }))
    )
    toast.success('Ingredients added to shopping list')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to add ingredients')
  }
}

async function handleGenerateSummary() {
  if (!recipe.value) return

  try {
    await insights.loadRecipeSummary(recipe.value.id, true)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to generate AI summary')
  }
}

async function handleAskAi(question = aiAskQuestion.value) {
  if (!recipe.value) return

  const normalizedQuestion = question.trim()
  if (!normalizedQuestion) {
    aiAskError.value = 'Enter a question for the recipe assistant.'
    return
  }

  aiAskQuestion.value = normalizedQuestion
  aiAskLoading.value = true
  aiAskError.value = null

  try {
    const { data } = await apiClient<RecipeAiAskResponse>(`/recipes/${recipe.value.id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question: normalizedQuestion }),
    })

    aiAskResult.value = data
  } catch (error) {
    aiAskError.value = error instanceof Error ? error.message : 'Failed to ask the recipe assistant'
    toast.error(aiAskError.value)
  } finally {
    aiAskLoading.value = false
  }
}

async function loadReviews(recipeId: string) {
  try {
    const { data } = await apiClient<RecipeReviewSummary>(`/recipes/${recipeId}/reviews`)
    reviews.value = data.reviews
    averageRating.value = data.averageRating
    totalReviews.value = data.totalReviews
    const myReview = data.reviews.find(r => r.userId === auth.user?.id)
    if (myReview) {
      myRating.value = myReview.rating
      myNote.value = myReview.note
    }
  } catch {
    // reviews are optional, don't block the page
  }
}

async function submitReview() {
  if (!recipe.value || myRating.value === 0) return
  reviewSubmitting.value = true
  try {
    const { data } = await apiClient<{ averageRating: number; totalReviews: number }>(`/recipes/${recipe.value.id}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ rating: myRating.value, note: myNote.value.trim() }),
    })
    averageRating.value = data.averageRating
    totalReviews.value = data.totalReviews
    showReviewForm.value = false
    toast.success('Review saved!')
    await loadReviews(recipe.value.id)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to save review')
  } finally {
    reviewSubmitting.value = false
  }
}

function handleDelete() {
  if (!recipe.value) return
  ui.showConfirm({
    title: 'Delete recipe?',
    description: `Are you sure you want to delete "${recipe.value.title}"? This action cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'destructive',
    onConfirm: async () => {
      await store.deleteRecipe(recipe.value!.id)
      router.push('/recipes')
    },
  })
}
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <button @click="router.back()" class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors tap-target">
      <ArrowLeft class="w-4 h-4" /> Back
    </button>

    <!-- Loading -->
    <div v-if="!recipe" class="space-y-4">
      <AppSkeleton class="h-64 rounded-2xl" />
      <AppSkeleton class="h-12 w-2/3" />
      <AppSkeleton class="h-96" />
    </div>

    <template v-else>
      <!-- Hero card -->
      <div class="surface-elevated overflow-hidden mb-8">
        <div class="relative">
          <img
            v-if="recipe.imageUrl"
            :src="recipe.imageUrl"
            :alt="recipe.title"
            class="w-full h-56 md:h-80 object-cover"
          />
          <div v-if="recipe.imageUrl" class="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

          <!-- Tags on image -->
          <div v-if="recipe.imageUrl && recipe.tags.length" class="absolute bottom-4 left-5 flex flex-wrap gap-1.5">
            <span v-for="tag in recipe.tags" :key="tag" class="px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-md">
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="p-6 lg:p-8">
          <!-- Tags (no image) -->
          <div v-if="!recipe.imageUrl && recipe.tags.length" class="flex flex-wrap gap-2 mb-3">
            <span v-for="tag in recipe.tags" :key="tag" class="px-2.5 py-0.5 rounded-full bg-primary/8 text-primary text-xs font-bold">
              {{ tag }}
            </span>
          </div>

          <h1 class="text-2xl lg:text-3xl font-extrabold text-foreground mb-2 tracking-tight">{{ recipe.title }}</h1>
          <p v-if="recipe.description" class="text-muted-foreground mb-5 leading-relaxed">{{ recipe.description }}</p>

          <div
            v-if="activePreferences.length"
            class="mb-5 rounded-2xl border p-4"
            :class="preferenceConflicts.length ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'"
          >
            <p
              class="text-sm font-semibold"
              :class="preferenceConflicts.length ? 'text-amber-700' : 'text-emerald-700'"
            >
              {{ preferenceConflicts.length ? 'Household preference warning' : 'Matches household dietary preferences' }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              <span v-if="preferenceConflicts.length">
                This recipe may conflict with: {{ preferenceConflicts.join(', ') }}.
              </span>
              <span v-else>
                Compatible with: {{ dietaryProfile?.compatibleWith.join(', ') || activePreferences.join(', ') }}.
              </span>
            </p>
          </div>

          <!-- Stats -->
          <div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <span class="inline-flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg font-medium">
              <Clock class="w-4 h-4 text-primary/70" />
              Prep {{ formatMinutes(recipe.prepTime) }}
            </span>
            <span class="inline-flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg font-medium">
              <Clock class="w-4 h-4 text-primary/70" />
              Cook {{ formatMinutes(recipe.cookTime) }}
            </span>
            <span class="inline-flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg font-medium">
              <Users class="w-4 h-4 text-primary/70" />
              {{ scaledServings }} servings
            </span>
            <a
              v-if="recipe.sourceUrl"
              :href="recipe.sourceUrl"
              target="_blank"
              class="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ExternalLink class="w-4 h-4" /> Source
            </a>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2.5">
            <Button @click="router.push(`/recipes/${recipe.id}/cook`)" class="shadow-md shadow-primary/10 press-scale">
              <ChefHat class="w-4 h-4 mr-1.5" /> Cook Mode
            </Button>
            <Button variant="outline" @click="router.push(`/recipes/${recipe.id}/edit`)" class="press-scale">
              <Edit class="w-4 h-4 mr-1.5" /> Edit
            </Button>
            <Button variant="outline" @click="addToShoppingList" class="press-scale">
              <ShoppingCart class="w-4 h-4 mr-1.5" /> Add to List
            </Button>
            <Button variant="outline" @click="router.push('/planner')" class="press-scale">
              <CalendarPlus class="w-4 h-4 mr-1.5" /> Plan
            </Button>
            <Button variant="outline" class="text-destructive hover:text-destructive hover:border-destructive/30" @click="handleDelete">
              <Trash2 class="w-4 h-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      <!-- Ratings & Reviews -->
      <div class="surface-card p-5 lg:p-6 mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div class="flex items-center gap-4">
            <h2 class="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Star class="w-5 h-5 text-amber-400 fill-amber-400" />
              Ratings & Notes
            </h2>
            <div v-if="averageRating" class="flex items-center gap-2">
              <div class="flex items-center gap-0.5">
                <Star
                  v-for="i in 5"
                  :key="'avg-' + i"
                  class="w-4 h-4 transition-colors"
                  :class="i <= Math.round(averageRating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'"
                />
              </div>
              <span class="text-sm font-bold text-foreground">{{ averageRating }}</span>
              <span class="text-xs text-muted-foreground">({{ totalReviews }} {{ totalReviews === 1 ? 'review' : 'reviews' }})</span>
            </div>
            <span v-else class="text-xs text-muted-foreground">No ratings yet</span>
          </div>
          <Button variant="outline" size="sm" class="press-scale" @click="showReviewForm = !showReviewForm">
            <MessageSquare class="w-4 h-4 mr-1.5" />
            {{ myRating > 0 ? 'Edit Review' : 'Rate This' }}
          </Button>
        </div>

        <!-- Review form -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div v-if="showReviewForm" class="rounded-2xl bg-muted/30 border border-border/50 p-4 mb-5">
            <p class="text-sm font-semibold text-foreground mb-3">Your rating</p>
            <div class="flex items-center gap-1 mb-4">
              <button
                v-for="i in 5"
                :key="'rate-' + i"
                @click="myRating = i"
                class="p-1 transition-transform hover:scale-110"
                :aria-label="`Rate ${i} stars`"
              >
                <Star
                  class="w-7 h-7 transition-colors cursor-pointer"
                  :class="i <= myRating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/25 hover:text-amber-300'"
                />
              </button>
              <span v-if="myRating" class="ml-2 text-sm font-semibold text-foreground">{{ myRating }}/5</span>
            </div>
            <div class="flex flex-col sm:flex-row gap-3">
              <Input
                v-model="myNote"
                placeholder="Add a note... (e.g. 'Kids loved this!', 'Add more garlic next time')"
                class="h-11 flex-1"
              />
              <Button
                :disabled="myRating === 0 || reviewSubmitting"
                @click="submitReview"
                class="press-scale"
              >
                <Loader2 v-if="reviewSubmitting" class="w-4 h-4 mr-1.5 animate-spin" />
                <Send v-else class="w-4 h-4 mr-1.5" />
                Save
              </Button>
            </div>
          </div>
        </Transition>

        <!-- Existing reviews -->
        <div v-if="reviews.length" class="space-y-3">
          <div
            v-for="review in reviews"
            :key="review.id"
            class="flex items-start gap-3 rounded-xl bg-muted/20 p-3"
          >
            <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span class="text-xs font-bold text-primary">{{ review.userName.charAt(0).toUpperCase() }}</span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-semibold text-foreground">{{ review.userName }}</span>
                <div class="flex items-center gap-0.5">
                  <Star
                    v-for="i in 5"
                    :key="'r-' + review.id + '-' + i"
                    class="w-3 h-3"
                    :class="i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'"
                  />
                </div>
              </div>
              <p v-if="review.note" class="text-sm text-muted-foreground mt-1 leading-relaxed">{{ review.note }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-6 mb-6 lg:grid-cols-5">
        <div class="lg:col-span-2 surface-card p-5 lg:p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold tracking-tight text-foreground">Nutrition Estimate</h2>
            <span class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">USDA</span>
          </div>

          <div v-if="nutritionLoading" class="space-y-3">
            <AppSkeleton class="h-14" />
            <AppSkeleton class="h-14" />
          </div>

          <div v-else-if="nutrition" class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-muted/40 p-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calories</p>
                <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ nutrition.perServing.calories }}</p>
                <p class="text-xs text-muted-foreground">per serving</p>
              </div>
              <div class="rounded-2xl bg-muted/40 p-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protein</p>
                <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ nutrition.perServing.protein }}g</p>
                <p class="text-xs text-muted-foreground">per serving</p>
              </div>
              <div class="rounded-2xl bg-muted/40 p-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carbs</p>
                <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ nutrition.perServing.carbs }}g</p>
                <p class="text-xs text-muted-foreground">per serving</p>
              </div>
              <div class="rounded-2xl bg-muted/40 p-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fat</p>
                <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ nutrition.perServing.fat }}g</p>
                <p class="text-xs text-muted-foreground">per serving</p>
              </div>
            </div>

            <div
              v-if="healthFit"
              class="rounded-2xl border p-4"
              :class="getHealthFitClasses(healthFit.verdict)"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="text-sm font-semibold">{{ healthFit.headline }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ healthFit.summary }}</p>
                </div>
                <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-white/70">
                  {{ healthFit.verdict === 'good-fit' ? 'Good fit' : healthFit.verdict === 'not-ideal' ? 'Not ideal' : 'Mixed fit' }}
                </span>
              </div>

              <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div class="rounded-xl bg-white/60 px-3 py-2">
                  Calories: {{ healthFit.targetShare.calories }}% of daily target
                </div>
                <div class="rounded-xl bg-white/60 px-3 py-2">
                  Protein: {{ healthFit.targetShare.protein }}% of daily target
                </div>
                <div class="rounded-xl bg-white/60 px-3 py-2">
                  Carbs: {{ healthFit.targetShare.carbs }}% of daily target
                </div>
                <div class="rounded-xl bg-white/60 px-3 py-2">
                  Fat: {{ healthFit.targetShare.fat }}% of daily target
                </div>
              </div>

              <div v-if="healthFit.highlights.length" class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="item in healthFit.highlights"
                  :key="item"
                  class="rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <p class="text-xs text-muted-foreground">
              Estimated from {{ nutrition.ingredients.length }} ingredient lookups in {{ nutrition.source }}.
            </p>
          </div>

          <div v-else class="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
            {{ nutritionError || 'Nutrition estimate is not available yet.' }}
          </div>
        </div>

        <div class="lg:col-span-3 surface-card p-5 lg:p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold tracking-tight text-foreground">AI Recipe Summary</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Generate a concise planner-friendly summary using OpenRouter.
              </p>
            </div>
            <Button
              variant="outline"
              class="press-scale"
              :disabled="aiSummaryLoading"
              @click="handleGenerateSummary"
            >
              <Loader2 v-if="aiSummaryLoading" class="mr-1.5 h-4 w-4 animate-spin" />
              <Sparkles v-else class="mr-1.5 h-4 w-4" />
              {{ aiSummary ? 'Regenerate' : 'Generate Summary' }}
            </Button>
          </div>

          <div v-if="aiSummary" class="space-y-4">
            <div>
              <p class="text-sm font-semibold text-primary">{{ aiSummary.headline }}</p>
              <p class="mt-2 text-sm leading-relaxed text-foreground">{{ aiSummary.summary }}</p>
            </div>

            <div v-if="aiSummary.bestFor.length" class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best For</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="item in aiSummary.bestFor"
                  :key="item"
                  class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700"
                >
                  {{ item }}
                </span>
              </div>
            </div>

            <div v-if="aiSummary.watchouts.length" class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Watchouts</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="item in aiSummary.watchouts"
                  :key="item"
                  class="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700"
                >
                  {{ item }}
                </span>
              </div>
            </div>
          </div>

          <div v-else class="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
            {{ aiSummaryError || 'No summary generated yet.' }}
          </div>

          <div class="mt-6 border-t border-border/60 pt-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 class="text-base font-bold tracking-tight text-foreground">Ask AI About Timing or Health</h3>
                <p class="mt-1 text-sm text-muted-foreground">
                  Ask if this recipe suits breakfast, lunch, dinner, meal prep, or whether it fits your health goals.
                </p>
              </div>
              <span class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">OpenRouter</span>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-for="prompt in quickAskPrompts"
                :key="prompt"
                class="rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary"
                @click="handleAskAi(prompt)"
              >
                {{ prompt }}
              </button>
            </div>

            <form class="mt-4 flex flex-col gap-3 sm:flex-row" @submit.prevent="handleAskAi()">
                <Input
                  v-model="aiAskQuestion"
                  placeholder="Example: Is this healthy for my goals?"
                  class="h-11 flex-1"
                />
              <Button type="submit" variant="outline" class="press-scale" :disabled="aiAskLoading">
                <Loader2 v-if="aiAskLoading" class="mr-1.5 h-4 w-4 animate-spin" />
                <Sparkles v-else class="mr-1.5 h-4 w-4" />
                Ask AI
              </Button>
            </form>

            <div v-if="aiAskResult" class="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-semibold text-foreground">{{ aiAskResult.headline }}</p>
                <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold" :class="getVerdictClasses(aiAskResult.verdict)">
                  {{ aiAskResult.verdict === 'good-fit' ? 'Good fit' : aiAskResult.verdict === 'not-ideal' ? 'Not ideal' : 'Mixed fit' }}
                </span>
              </div>
              <p class="mt-2 text-sm leading-relaxed text-foreground">{{ aiAskResult.answer }}</p>

              <div v-if="aiAskResult.bestTimes.length" class="mt-4 space-y-2">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Best Times</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="item in aiAskResult.bestTimes"
                    :key="item"
                    class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    {{ item }}
                  </span>
                </div>
              </div>

              <div v-if="aiAskResult.watchouts.length" class="mt-4 space-y-2">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Watchouts</p>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="item in aiAskResult.watchouts"
                    :key="item"
                    class="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700"
                  >
                    {{ item }}
                  </span>
                </div>
              </div>
            </div>

            <div v-else-if="aiAskError" class="mt-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
              {{ aiAskError }}
            </div>
          </div>
        </div>
      </div>

      <!-- Content grid -->
      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Ingredients -->
        <div class="lg:col-span-2">
          <div class="surface-card p-5 lg:p-6 lg:sticky lg:top-20">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-lg font-bold text-foreground tracking-tight">Ingredients</h2>
              <div class="flex items-center gap-1 bg-muted rounded-xl p-1">
                <button @click="scaleDown" class="p-1.5 rounded-lg hover:bg-card transition-colors tap-target" aria-label="Decrease">
                  <Minus class="w-3.5 h-3.5" />
                </button>
                <span class="text-xs font-bold w-8 text-center">{{ scaleMultiplier }}x</span>
                <button @click="scaleUp" class="p-1.5 rounded-lg hover:bg-card transition-colors tap-target" aria-label="Increase">
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              v-if="pantry.items.length === 0"
              class="mb-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground"
            >
              Track pantry items to see ingredient coverage and subtract stock from shopping generation.
            </div>

            <ul class="space-y-3">
              <li v-for="ing in recipe.ingredients" :key="ing.id" class="flex items-start gap-2.5 text-sm">
                <span class="w-2 h-2 rounded-full bg-primary/60 mt-2 shrink-0" />
                <div class="leading-relaxed">
                  <span>
                    <strong class="font-semibold text-foreground">{{ formatQuantity(ing.quantity * scaleMultiplier) }}</strong>
                    <span class="text-muted-foreground"> {{ ing.unit }}</span>
                    {{ ing.name }}
                  </span>

                  <div v-if="pantry.items.length" class="mt-1.5 flex flex-wrap gap-2">
                    <span
                      class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      :class="getIngredientCoverage(ing).hasEnough ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'"
                    >
                      <span v-if="getIngredientCoverage(ing).hasEnough">
                        Pantry covers {{ formatQuantity(getIngredientCoverage(ing).matchedQuantity) }} {{ ing.unit || 'units' }}
                      </span>
                      <span v-else-if="getIngredientCoverage(ing).matchedQuantity > 0">
                        Pantry has {{ formatQuantity(getIngredientCoverage(ing).matchedQuantity) }} {{ ing.unit || 'units' }};
                        still need {{ formatQuantity(getIngredientCoverage(ing).missingQuantity) }} {{ ing.unit || 'units' }}
                      </span>
                      <span v-else>
                        Not currently in pantry
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <!-- Instructions -->
        <div class="lg:col-span-3">
          <div class="surface-card p-5 lg:p-6">
            <h2 class="text-lg font-bold text-foreground mb-5 tracking-tight">Instructions</h2>
            <ol class="space-y-6">
              <li v-for="(step, index) in recipe.instructions" :key="index" class="flex gap-4">
                <span class="w-9 h-9 rounded-xl bg-primary/10 text-primary text-sm font-extrabold flex items-center justify-center shrink-0">
                  {{ index + 1 }}
                </span>
                <p class="text-sm text-foreground leading-relaxed pt-1.5">{{ step }}</p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
