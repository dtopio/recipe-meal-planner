<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useRecipeStore } from '@/stores/recipes'
import { usePlannerStore } from '@/stores/planner'
import { useShoppingStore } from '@/stores/shopping'
import { useHouseholdStore } from '@/stores/household'
import RecipeCard from '@/components/app/RecipeCard.vue'
import QuickActionCard from '@/components/app/QuickActionCard.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { formatMinutes, formatDateShort, getDayNameShort, isToday } from '@/utils/date'
import {
  Clock, Users, ShoppingCart, ChefHat, CalendarDays, Plus,
  ArrowRight, Sparkles, TrendingUp,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

const router = useRouter()
const auth = useAuthStore()
const recipes = useRecipeStore()
const planner = usePlannerStore()
const shopping = useShoppingStore()
const household = useHouseholdStore()

const tonightsDinner = computed(() => {
  const slot = planner.slots.find(s => s.date === '2026-03-11' && s.mealType === 'dinner')
  return slot?.recipe
})

const upcomingMeals = computed(() => {
  return planner.weekDates.slice(0, 5).map(date => ({
    date,
    meals: planner.slots.filter(s => s.date === date && s.recipeId),
  }))
})

const recentRecipes = computed(() => recipes.recipes.slice(0, 4))

const greeting = computed(() => {
  const hour = 12
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
  ])
})
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
    <div class="grid gap-6 lg:grid-cols-3">

      <!-- ===== Tonight's Dinner Hero ===== -->
      <div class="lg:col-span-2 surface-elevated overflow-hidden">
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

      <!-- ===== Shopping Progress ===== -->
      <div class="surface-card p-5">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart class="w-4 h-4 text-primary" />
            </div>
            Shopping
          </h3>
          <button @click="router.push('/shopping-list')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
            View all <ArrowRight class="w-3 h-3" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Big progress number -->
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

      <!-- ===== Quick Actions ===== -->
      <div class="surface-card p-5">
        <h3 class="font-bold text-foreground mb-4 tracking-tight">Quick Actions</h3>
        <div class="grid grid-cols-2 gap-2.5">
          <QuickActionCard title="Add Recipe" description="Manual entry" icon="📝" color="primary" @click="router.push('/recipes/new')" />
          <QuickActionCard title="Import" description="From URL" icon="🔗" color="amber" @click="router.push('/recipes/import')" />
          <QuickActionCard title="Plan Week" description="Meal planner" icon="📅" color="blue" @click="router.push('/planner')" />
          <QuickActionCard title="Add Item" description="Shopping list" icon="🛒" color="violet" @click="router.push('/shopping-list')" />
        </div>
      </div>

      <!-- ===== Weekly Preview ===== -->
      <div class="lg:col-span-2 surface-card p-5">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-foreground flex items-center gap-2 tracking-tight">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays class="w-4 h-4 text-primary" />
            </div>
            This Week
          </h3>
          <button @click="router.push('/planner')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
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
                  <span class="text-xs font-medium text-foreground truncate">{{ meal.recipe?.title }}</span>
                </div>
              </div>
              <p v-else class="text-[11px] text-muted-foreground/40 italic">Nothing planned</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== Recent Recipes ===== -->
      <div class="lg:col-span-3">
        <div class="flex items-center justify-between mb-5">
          <h3 class="font-bold text-foreground tracking-tight">Recent Recipes</h3>
          <button @click="router.push('/recipes')" class="text-xs text-primary font-semibold hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors">
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
