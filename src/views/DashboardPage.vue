<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useRecipeStore } from '@/stores/recipes'
import { usePlannerStore } from '@/stores/planner'
import { useShoppingStore } from '@/stores/shopping'
import { useHouseholdStore } from '@/stores/household'
import { usePantryStore } from '@/stores/pantry'
import { useInsightsStore } from '@/stores/insights'
import RecipeCard from '@/components/app/RecipeCard.vue'
import QuickActionCard from '@/components/app/QuickActionCard.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { formatMinutes, formatDateShort, getDayNameShort, getTodayDateKey, isToday } from '@/utils/date'
import { DEFAULT_HEALTH_TARGETS } from '@/types'
import { formatMealPeriodLabel, getMealPeriods, getPrimaryEveningPeriod } from '@/utils/meal-periods'
import {
  Clock, Users, ShoppingCart, ChefHat, CalendarDays, Plus,
  ArrowRight, Sparkles, TrendingUp, Archive, Activity,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const router = useRouter()
const auth = useAuthStore()
const recipes = useRecipeStore()
const planner = usePlannerStore()
const shopping = useShoppingStore()
const household = useHouseholdStore()
const pantry = usePantryStore()
const insights = useInsightsStore()

const mealPeriods = computed(() => getMealPeriods(household.preferences))
const eveningMealPeriod = computed(() => getPrimaryEveningPeriod(mealPeriods.value))
const tonightsDinner = computed(() => {
  return planner.todaysMeals.find(slot => slot.mealType === eveningMealPeriod.value)?.recipe
})

const tonightDinnerCount = computed(() => (
  planner.todaysMeals.filter(slot => slot.mealType === eveningMealPeriod.value).length
))

const upcomingMeals = computed(() => {
  const today = getTodayDateKey()
  const visibleDates = planner.weekDates.filter(date => date >= today)
  const dates = (visibleDates.length ? visibleDates : planner.weekDates).slice(0, 5)

  return dates.map(date => ({
    date,
    meals: planner.slots.filter(s => s.date === date && s.recipeId),
  }))
})

const recentRecipes = computed(() => recipes.recipes.slice(0, 4))
const lowStockPreview = computed(() => pantry.lowStockItems.slice(0, 3))
const weekNutrition = computed(() => insights.weekNutritionByStart[planner.currentWeekStart] || null)
const weekNutritionError = computed(() => insights.weekNutritionErrors[planner.currentWeekStart] || null)
const healthTargets = computed(() => auth.user?.healthTargets || DEFAULT_HEALTH_TARGETS)
const todayDateKey = computed(() => getTodayDateKey())
const todayNutrition = computed(() => (
  weekNutrition.value?.perDay.find(day => day.date === todayDateKey.value) || null
))
const weeklyTargets = computed(() => ({
  calories: healthTargets.value.calories * 7,
  protein: healthTargets.value.protein * 7,
  carbs: healthTargets.value.carbs * 7,
  fat: healthTargets.value.fat * 7,
}))
const healthAlerts = computed(() => {
  const alerts: string[] = []
  const today = todayNutrition.value?.total
  const weekly = weekNutrition.value?.total

  if (today) {
    if (today.calories > healthTargets.value.calories * 1.1) {
      alerts.push('Today is running above your calorie target.')
    } else if (today.calories < healthTargets.value.calories * 0.6) {
      alerts.push('Today is still well under your calorie target.')
    }

    if (today.protein < healthTargets.value.protein * 0.75) {
      alerts.push('Protein is behind your daily goal.')
    }
  }

  if (weekly) {
    if (weekNutrition.value?.missingNutritionCount) {
      alerts.push(`${weekNutrition.value.missingNutritionCount} planned meals are missing nutrition.`)
    }

    if (weekly.protein < weeklyTargets.value.protein * 0.7) {
      alerts.push('Weekly protein is off pace.')
    }

    if (weekly.calories > weeklyTargets.value.calories * 1.1) {
      alerts.push('Weekly calories are above target pace.')
    }
  }

  return alerts.slice(0, 3)
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  const name = auth.user?.displayName?.split(' ')[0] || 'there'
  if (hour < 12) return `Good morning, ${name}`
  if (hour < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
})

onMounted(async () => {
  await Promise.all([
    auth.loadUser(),
    household.loadHousehold(),
    recipes.loadRecipes(),
    planner.loadWeekPlan(),
    shopping.loadItems(),
    pantry.loadItems(),
  ])

  if (planner.currentWeekStart) {
    try {
      await insights.loadWeekNutrition(planner.currentWeekStart, true)
    } catch {
      // surfaced through the insights error state
    }
  }
})

function getProgress(current: number, target: number) {
  if (!target) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function formatGoalDelta(current: number, target: number, unit = '') {
  const delta = Math.round((current - target) * 10) / 10
  if (delta === 0) return `On target${unit}`
  if (delta > 0) return `+${delta}${unit} over`
  return `${Math.abs(delta)}${unit} left`
}

function getCaloriesTone(current: number, target: number) {
  if (current > target * 1.1) return 'text-rose-600 dark:text-rose-400'
  if (current < target * 0.6) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function getProteinTone(current: number, target: number) {
  if (current >= target) return 'text-emerald-600 dark:text-emerald-400'
  if (current >= target * 0.75) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}
</script>

<template>
  <!-- Greeting header -->
  <div class="mb-8 lg:mb-10">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{{ greeting }} 👋</h1>
        <p class="text-base text-muted-foreground mt-1.5 leading-relaxed">Here's what's happening in your kitchen</p>
      </div>
      <Button @click="router.push('/recipes/new')" class="hidden sm:inline-flex shadow-md shadow-primary/10">
        <Plus class="w-4 h-4 mr-1.5" /> Add Recipe
      </Button>
    </div>
  </div>

  <!-- Loading state -->
  <div v-if="recipes.loading && recipes.recipes.length === 0" class="grid gap-6 lg:grid-cols-3">
    <AppSkeleton class="h-64 lg:col-span-2" />
    <AppSkeleton class="h-64" />
    <AppSkeleton class="h-48" />
    <AppSkeleton class="h-48" />
    <AppSkeleton class="h-48" />
  </div>

  <template v-else>
    <div class="grid gap-6 lg:grid-cols-12 stagger-children">

      <div class="lg:col-span-8 space-y-6">
      <!-- ===== Tonight's Dinner Hero ===== -->
      <div class="surface-elevated overflow-hidden">
        <div v-if="tonightsDinner" class="flex flex-col md:flex-row">
          <!-- Image -->
          <div class="relative md:w-2/5 h-52 md:h-auto">
            <img
              :src="tonightsDinner.imageUrl"
              :alt="tonightsDinner.title"
              class="w-full h-full object-cover"
            />
            <div class="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-card/50 to-transparent" />
            <!-- Floating badge -->
            <div class="absolute top-3 left-3">
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warm/90 text-warm-foreground text-xs font-bold shadow-lg backdrop-blur-sm">
                <Sparkles class="w-3 h-3" /> Tonight's Dinner
              </span>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 p-6 lg:p-7 flex flex-col justify-between">
            <div>
              <h2 class="text-xl lg:text-2xl font-extrabold text-foreground mb-2 tracking-tight">{{ tonightsDinner.title }}</h2>
              <p class="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">{{ tonightsDinner.description }}</p>
              <div class="flex items-center gap-4 text-sm text-muted-foreground">
                <span class="inline-flex items-center gap-1.5">
                  <Clock class="w-4 h-4 text-primary/70" />
                  {{ formatMinutes(tonightsDinner.prepTime + tonightsDinner.cookTime) }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <Users class="w-4 h-4 text-primary/70" />
                  {{ tonightsDinner.servings }} servings
                </span>
                <span v-if="tonightDinnerCount > 1" class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  +{{ tonightDinnerCount - 1 }} more tonight
                </span>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-6">
              <Button @click="router.push(`/recipes/${tonightsDinner.id}/cook`)" class="shadow-md shadow-primary/15">
                <ChefHat class="w-4 h-4 mr-1.5" /> Start Cooking
              </Button>
              <Button variant="outline" @click="router.push(`/recipes/${tonightsDinner.id}`)">
                View Recipe
              </Button>
            </div>
          </div>
        </div>

        <!-- No dinner planned -->
        <div v-else class="p-10 text-center">
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <span class="text-4xl">🍽</span>
          </div>
          <h3 class="text-lg font-bold text-foreground mb-1.5 tracking-tight">No dinner planned tonight</h3>
          <p class="text-sm text-muted-foreground mb-5">Head to the planner to pick something delicious</p>
          <Button @click="router.push('/planner')" class="shadow-md shadow-primary/15">
            <CalendarDays class="w-4 h-4 mr-1.5" /> Plan a Meal
          </Button>
        </div>
      </div>

      <!-- ===== Quick Actions ===== -->
      <div class="surface-card p-5">
        <h3 class="font-bold text-foreground mb-4 tracking-tight">Quick Actions</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <QuickActionCard title="Household" description="Members and invite code" icon="HM" color="emerald" @click="router.push('/household')" />
          <QuickActionCard title="Add Recipe" description="Create a new recipe manually" icon="📝" color="primary" @click="router.push('/recipes/new')" />
          <QuickActionCard title="Import Recipe" description="Paste a URL and import" icon="🔗" color="amber" @click="router.push('/recipes/import')" />
          <QuickActionCard title="Plan Meals" description="Open the weekly planner" icon="📅" color="blue" @click="router.push('/planner')" />
          <QuickActionCard title="Weekly Report" description="View nutrition summary" icon="📊" color="emerald" @click="router.push('/weekly-report')" />
          <QuickActionCard title="Shopping List" description="Manage your items" icon="🛒" color="violet" @click="router.push('/shopping-list')" />
        </div>
      </div>

      <!-- ===== Weekly Preview ===== -->
      <div class="surface-card p-5">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays class="w-4 h-4 text-primary" />
            </div>
            This Week
          </h3>
          <button type="button" @click="router.push('/planner')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
            Full planner <ArrowRight class="w-3 h-3" />
          </button>
        </div>

        <div class="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          <div
            v-for="day in upcomingMeals"
            :key="day.date"
            class="shrink-0 w-36 lg:w-auto lg:flex-1 snap-start"
          >
            <div
              class="rounded-xl border p-3.5 h-full transition-all duration-200"
              :class="isToday(day.date) ? 'border-primary/40 bg-primary/[0.04] shadow-sm shadow-primary/5' : 'border-border/60 bg-card hover:border-border'"
            >
              <div class="text-xs font-semibold mb-2.5" :class="isToday(day.date) ? 'text-primary' : 'text-muted-foreground'">
                {{ getDayNameShort(day.date) }} · {{ formatDateShort(day.date) }}
                <span v-if="isToday(day.date)" class="ml-1.5 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">Today</span>
              </div>
              <div v-if="day.meals.length" class="space-y-2">
                <div v-for="meal in day.meals" :key="meal.id" class="flex items-center gap-2">
                  <img v-if="meal.recipe?.imageUrl" :src="meal.recipe.imageUrl" class="w-7 h-7 rounded-lg object-cover shrink-0 ring-1 ring-border/40" />
                  <div class="min-w-0">
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ formatMealPeriodLabel(meal.mealType) }}</p>
                    <span class="text-xs font-medium text-foreground truncate block">{{ meal.recipe?.title }}</span>
                  </div>
                </div>
              </div>
              <p v-else class="text-[11px] text-muted-foreground/40 italic">Nothing planned</p>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- ===== Shopping and Pantry ===== -->
      <div class="lg:col-span-4 space-y-6">
        <div class="surface-card p-5">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingCart class="w-4 h-4 text-primary" />
              </div>
              Shopping
            </h3>
            <button type="button" @click="router.push('/shopping-list')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
              View all <ArrowRight class="w-3 h-3" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="flex items-end gap-2">
              <span class="text-4xl font-extrabold text-primary tracking-tight">{{ shopping.progress }}%</span>
              <span class="text-sm text-muted-foreground mb-1">complete</span>
            </div>

            <Progress :model-value="shopping.progress" class="h-2.5 rounded-full" />

            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">{{ shopping.checkedItems.length }} of {{ shopping.totalItems }} items</span>
              <span class="font-bold text-foreground">{{ shopping.remainingItems }} left</span>
            </div>

            <Button variant="outline" class="w-full mt-1 press-scale" @click="router.push('/shopping-list')">
              <TrendingUp class="w-4 h-4 mr-1.5" /> Go Shopping
            </Button>
          </div>
        </div>

        <div class="surface-card p-5">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Archive class="w-4 h-4 text-primary" />
              </div>
              Pantry
            </h3>
            <button type="button" @click="router.push('/pantry')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
              Open <ArrowRight class="w-3 h-3" />
            </button>
          </div>

          <div class="space-y-4">
            <div class="flex items-end gap-2">
              <span class="text-4xl font-extrabold tracking-tight text-foreground">{{ pantry.items.length }}</span>
              <span class="text-sm text-muted-foreground mb-1">tracked items</span>
            </div>

            <div v-if="lowStockPreview.length" class="space-y-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Low-stock alerts</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="item in lowStockPreview"
                  :key="item.id"
                  class="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400"
                >
                  {{ item.name }} · {{ item.quantity }} {{ item.unit || 'units' }}
                </span>
              </div>
            </div>
            <p v-else class="text-sm text-muted-foreground">No low-stock alerts right now.</p>

            <Button variant="outline" class="w-full mt-1 press-scale" @click="router.push('/pantry')">
              <Archive class="w-4 h-4 mr-1.5" /> Manage Pantry
            </Button>
          </div>
        </div>

        <div class="surface-card p-5">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity class="w-4 h-4 text-primary" />
              </div>
              Daily Health
            </h3>
            <button type="button" @click="router.push('/settings')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
              Targets <ArrowRight class="w-3 h-3" />
            </button>
          </div>

          <div v-if="todayNutrition" class="space-y-4">
            <div class="rounded-2xl bg-muted/40 p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calories</p>
                  <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ todayNutrition.total.calories }}</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-muted-foreground">Goal {{ healthTargets.calories }}</p>
                  <p class="text-xs font-semibold" :class="getCaloriesTone(todayNutrition.total.calories, healthTargets.calories)">
                    {{ formatGoalDelta(todayNutrition.total.calories, healthTargets.calories) }}
                  </p>
                </div>
              </div>
              <Progress :model-value="getProgress(todayNutrition.total.calories, healthTargets.calories)" class="mt-3 h-2.5 rounded-full" />
            </div>

            <div class="rounded-2xl bg-muted/40 p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protein</p>
                  <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ todayNutrition.total.protein }}g</p>
                </div>
                <div class="text-right">
                  <p class="text-xs text-muted-foreground">Goal {{ healthTargets.protein }}g</p>
                  <p class="text-xs font-semibold" :class="getProteinTone(todayNutrition.total.protein, healthTargets.protein)">
                    {{ formatGoalDelta(todayNutrition.total.protein, healthTargets.protein, 'g') }}
                  </p>
                </div>
              </div>
              <Progress :model-value="getProgress(todayNutrition.total.protein, healthTargets.protein)" class="mt-3 h-2.5 rounded-full" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-muted/30 p-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carbs</p>
                <p class="mt-1 text-xl font-extrabold tracking-tight text-foreground">{{ todayNutrition.total.carbs }}g</p>
                <p class="text-xs text-muted-foreground">Goal {{ healthTargets.carbs }}g</p>
              </div>
              <div class="rounded-2xl bg-muted/30 p-3">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fat</p>
                <p class="mt-1 text-xl font-extrabold tracking-tight text-foreground">{{ todayNutrition.total.fat }}g</p>
                <p class="text-xs text-muted-foreground">Goal {{ healthTargets.fat }}g</p>
              </div>
            </div>
          </div>

          <div v-else class="rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
            {{ weekNutritionError ? 'Nutrition data is unavailable right now.' : 'No nutrition tracked for today yet. Plan meals in your active periods to start the daily totals.' }}
          </div>
        </div>
      </div>

      <!-- ===== Weekly Health (full width below the two columns) ===== -->
      <div v-if="weekNutrition" class="lg:col-span-12 surface-card p-5">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity class="w-4 h-4 text-primary" />
              </div>
              Weekly Health
            </h3>
            <span class="text-[11px] font-semibold text-primary">{{ weekNutrition.source }}</span>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="rounded-2xl bg-muted/40 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Calories</p>
              <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ weekNutrition.total.calories }}</p>
              <p class="text-xs" :class="getCaloriesTone(weekNutrition.total.calories, weeklyTargets.calories)">Goal {{ weeklyTargets.calories }}</p>
            </div>
            <div class="rounded-2xl bg-muted/40 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protein</p>
              <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ weekNutrition.total.protein }}g</p>
              <p class="text-xs" :class="getProteinTone(weekNutrition.total.protein, weeklyTargets.protein)">Goal {{ weeklyTargets.protein }}g</p>
            </div>
            <div class="rounded-2xl bg-muted/40 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Carbs</p>
              <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ weekNutrition.total.carbs }}g</p>
              <p class="text-xs text-muted-foreground">Goal {{ weeklyTargets.carbs }}g</p>
            </div>
            <div class="rounded-2xl bg-muted/40 p-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fat</p>
              <p class="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{{ weekNutrition.total.fat }}g</p>
              <p class="text-xs text-muted-foreground">Goal {{ weeklyTargets.fat }}g</p>
            </div>
          </div>

          <div class="mt-4 space-y-3">
            <div>
              <div class="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Weekly calories</span>
                <span>{{ weekNutrition.total.calories }} / {{ weeklyTargets.calories }}</span>
              </div>
              <Progress :model-value="getProgress(weekNutrition.total.calories, weeklyTargets.calories)" class="h-2.5 rounded-full" />
            </div>
            <div>
              <div class="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>Weekly protein</span>
                <span>{{ weekNutrition.total.protein }}g / {{ weeklyTargets.protein }}g</span>
              </div>
              <Progress :model-value="getProgress(weekNutrition.total.protein, weeklyTargets.protein)" class="h-2.5 rounded-full" />
            </div>
          </div>

          <div v-if="healthAlerts.length" class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="alert in healthAlerts"
              :key="alert"
              class="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700"
            >
              {{ alert }}
            </span>
          </div>

          <p class="mt-4 text-sm text-muted-foreground">
            {{ weekNutrition.plannedMealCount }} planned meals in the current week.
          </p>
        </div>

      <div v-else-if="weekNutritionError" class="lg:col-span-12 surface-card p-5">
          <div class="flex items-center justify-between mb-5">
            <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity class="w-4 h-4 text-primary" />
              </div>
              Weekly Health
            </h3>
          </div>

          <div class="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-foreground">
            Nutrition data is unavailable. {{ weekNutritionError }}
          </div>
        </div>

      <!-- ===== Recent Recipes ===== -->
      <div class="lg:col-span-12">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-foreground tracking-tight">Recent Recipes</h3>
          <button type="button" @click="router.push('/recipes')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
            View all <ArrowRight class="w-3 h-3" />
          </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <RecipeCard
            v-for="recipe in recentRecipes"
            :key="recipe.id"
            :recipe="recipe"
            compact
            @click="router.push(`/recipes/${recipe.id}`)"
          />
        </div>
      </div>
    </div>
  </template>
</template>
