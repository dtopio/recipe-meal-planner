<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlannerStore } from '@/stores/planner'
import { useShoppingStore } from '@/stores/shopping'
import { useHouseholdStore } from '@/stores/household'
import { useInsightsStore } from '@/stores/insights'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { DEFAULT_HEALTH_TARGETS } from '@/types'
import { formatDateShort, getDayNameShort, isToday } from '@/utils/date'
import { getMealPeriodDisplay, getMealPeriods } from '@/utils/meal-periods'
import {
  ChevronLeft, ChevronRight, CalendarDays, Activity, TrendingUp,
  ShoppingCart, Flame, Beef, Wheat, Droplets, ChefHat, Target,
  CheckCircle2, AlertTriangle,
} from 'lucide-vue-next'

const router = useRouter()
const auth = useAuthStore()
const planner = usePlannerStore()
const shopping = useShoppingStore()
const household = useHouseholdStore()
const insights = useInsightsStore()

const reportLoading = ref(true)

const healthTargets = computed(() => auth.user?.healthTargets || DEFAULT_HEALTH_TARGETS)
const weeklyTargets = computed(() => ({
  calories: healthTargets.value.calories * 7,
  protein: healthTargets.value.protein * 7,
  carbs: healthTargets.value.carbs * 7,
  fat: healthTargets.value.fat * 7,
}))

const weekNutrition = computed(() => insights.weekNutritionByStart[planner.currentWeekStart] || null)

const mealTypes = computed(() => getMealPeriods(household.preferences))

// Meal counts by type
const mealCountByType = computed(() => {
  const counts = mealTypes.value.reduce<Record<string, number>>((accumulator, mealType) => {
    accumulator[mealType] = 0
    return accumulator
  }, {})

  for (const slot of planner.slots) {
    if (slot.recipeId && counts[slot.mealType] !== undefined) {
      counts[slot.mealType]++
    }
  }
  return counts
})

const totalMeals = computed(() => planner.assignedMealCount)

const totalPossibleSlots = computed(() => Math.max(mealTypes.value.length * 7, 1))
const coveragePercent = computed(() => Math.round((totalMeals.value / totalPossibleSlots.value) * 100))

// Per-day data for the bar chart
const perDayData = computed(() => {
  return planner.weekDates.map(date => {
    const dayNutrition = weekNutrition.value?.perDay.find(d => d.date === date)
    const dayMeals = planner.slots.filter(s => s.date === date && s.recipeId)
    return {
      date,
      dayName: getDayNameShort(date),
      dateLabel: formatDateShort(date),
      isToday: isToday(date),
      mealCount: dayMeals.length,
      calories: dayNutrition?.total.calories || 0,
      protein: dayNutrition?.total.protein || 0,
      carbs: dayNutrition?.total.carbs || 0,
      fat: dayNutrition?.total.fat || 0,
    }
  })
})

const maxDayCalories = computed(() => Math.max(...perDayData.value.map(d => d.calories), healthTargets.value.calories))

// Score calculation
const reportScore = computed(() => {
  let score = 0
  // Coverage (max 40 points)
  score += Math.min(40, Math.round(coveragePercent.value * 0.4))
  // Calorie adherence (max 30 points)
  if (weekNutrition.value) {
    const calRatio = weekNutrition.value.total.calories / (weeklyTargets.value.calories || 1)
    if (calRatio >= 0.8 && calRatio <= 1.1) score += 30
    else if (calRatio >= 0.6 && calRatio <= 1.3) score += 20
    else score += 10
  }
  // Protein adherence (max 30 points)
  if (weekNutrition.value) {
    const proRatio = weekNutrition.value.total.protein / (weeklyTargets.value.protein || 1)
    if (proRatio >= 0.8) score += 30
    else if (proRatio >= 0.6) score += 20
    else score += 10
  }
  return score
})

const scoreLabel = computed(() => {
  if (reportScore.value >= 80) return { text: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400' }
  if (reportScore.value >= 60) return { text: 'Good', color: 'text-primary' }
  if (reportScore.value >= 40) return { text: 'Fair', color: 'text-amber-600 dark:text-amber-400' }
  return { text: 'Needs Work', color: 'text-rose-600 dark:text-rose-400' }
})

function getProgress(current: number, target: number) {
  if (!target) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function getBarHeight(calories: number) {
  if (!maxDayCalories.value) return '0%'
  return Math.max(4, Math.round((calories / maxDayCalories.value) * 100)) + '%'
}

function getNutrientTone(current: number, target: number) {
  const ratio = target ? current / target : 0
  if (ratio >= 0.8 && ratio <= 1.1) return 'text-emerald-600 dark:text-emerald-400'
  if (ratio >= 0.6 && ratio <= 1.3) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

onMounted(async () => {
  await Promise.all([
    auth.loadUser(),
    planner.loadWeekPlan(),
    shopping.loadItems(),
    localStorage.getItem('household_id') && !household.preferences ? household.loadHousehold() : Promise.resolve(),
  ])

  if (planner.currentWeekStart) {
    try {
      await insights.loadWeekNutrition(planner.currentWeekStart)
    } catch {
      // Nutrition may not be available
    }
  }

  reportLoading.value = false
})
</script>

<template>
  <PageHeader
    title="Weekly Report"
    :description="`Week of ${formatDateShort(planner.weekDates[0])} — ${formatDateShort(planner.weekDates[6])}`"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="planner.navigateWeek('prev')" class="press-scale">
          <ChevronLeft class="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" @click="planner.navigateWeek('next')" class="press-scale">
          <ChevronRight class="w-4 h-4" />
        </Button>
      </div>
    </template>
  </PageHeader>

  <!-- Loading -->
  <div v-if="reportLoading" class="grid gap-6 lg:grid-cols-12">
    <AppSkeleton class="h-48 lg:col-span-4" />
    <AppSkeleton class="h-48 lg:col-span-8" />
    <AppSkeleton class="h-64 lg:col-span-12" />
  </div>

  <template v-else>
    <div class="grid gap-6 lg:grid-cols-12 stagger-children">

      <!-- Score card -->
      <div class="lg:col-span-4 surface-elevated p-6 flex flex-col items-center justify-center text-center">
        <div class="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center mb-4">
          <span class="text-3xl font-extrabold text-foreground">{{ reportScore }}</span>
        </div>
        <p class="text-lg font-bold" :class="scoreLabel.color">{{ scoreLabel.text }}</p>
        <p class="text-sm text-muted-foreground mt-1">Weekly wellness score</p>
        <div class="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1">
            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
            {{ coveragePercent }}% meal coverage
          </span>
        </div>
      </div>

      <!-- Meal distribution -->
      <div class="lg:col-span-8 surface-card p-5 lg:p-6">
        <h3 class="font-bold text-foreground tracking-tight mb-5 flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ChefHat class="w-4 h-4 text-primary" />
          </div>
          Meal Planning Summary
        </h3>

        <div class="grid gap-4 mb-6" :style="{ gridTemplateColumns: `repeat(${mealTypes.length}, minmax(0, 1fr))` }">
          <div
            v-for="mt in mealTypes"
            :key="mt"
            class="rounded-xl p-4 text-center"
            :class="getMealPeriodDisplay(mt).bg"
          >
            <component :is="getMealPeriodDisplay(mt).icon" class="w-5 h-5 mx-auto mb-2" :class="getMealPeriodDisplay(mt).color" />
            <p class="text-2xl font-extrabold text-foreground">{{ mealCountByType[mt] }}</p>
            <p class="text-xs font-semibold text-muted-foreground mt-0.5">{{ getMealPeriodDisplay(mt).label }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-xl bg-muted/40 p-4">
          <div>
            <p class="text-sm font-semibold text-foreground">{{ totalMeals }} of {{ totalPossibleSlots }} meal slots filled</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ coveragePercent }}% weekly coverage</p>
          </div>
          <div class="w-32">
            <Progress :model-value="coveragePercent" class="h-2.5 rounded-full" />
          </div>
        </div>
      </div>

      <!-- Daily calorie bar chart -->
      <div class="lg:col-span-12 surface-card p-5 lg:p-6">
        <h3 class="font-bold text-foreground tracking-tight mb-5 flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Flame class="w-4 h-4 text-primary" />
          </div>
          Daily Calories
        </h3>

        <div class="flex items-end gap-2 sm:gap-3 h-48 mb-4">
          <div
            v-for="day in perDayData"
            :key="day.date"
            class="flex-1 flex flex-col items-center gap-2"
          >
            <!-- Bar -->
            <div class="w-full flex justify-center">
              <div
                class="w-full max-w-[48px] rounded-t-lg transition-all duration-500 ease-out relative group"
                :class="day.isToday ? 'bg-primary' : day.calories > healthTargets.calories ? 'bg-rose-400/70 dark:bg-rose-500/50' : 'bg-primary/40'"
                :style="{ height: getBarHeight(day.calories) }"
              >
                <!-- Tooltip on hover -->
                <div class="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-card shadow-lg rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground border border-border/50 whitespace-nowrap">
                  {{ day.calories }} cal
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Target line label -->
        <div class="flex items-center gap-2 mb-4">
          <div class="h-px flex-1 border-t-2 border-dashed border-primary/30" />
          <span class="text-[11px] font-semibold text-primary/60">Daily target: {{ healthTargets.calories }} cal</span>
          <div class="h-px flex-1 border-t-2 border-dashed border-primary/30" />
        </div>

        <!-- Day labels -->
        <div class="flex gap-2 sm:gap-3">
          <div
            v-for="day in perDayData"
            :key="'label-' + day.date"
            class="flex-1 text-center"
          >
            <p class="text-[11px] font-bold" :class="day.isToday ? 'text-primary' : 'text-muted-foreground'">{{ day.dayName }}</p>
            <p class="text-[10px] text-muted-foreground/60">{{ day.calories }}</p>
          </div>
        </div>
      </div>

      <!-- Macros breakdown -->
      <div class="lg:col-span-6 surface-card p-5 lg:p-6" v-if="weekNutrition">
        <h3 class="font-bold text-foreground tracking-tight mb-5 flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity class="w-4 h-4 text-primary" />
          </div>
          Weekly Macros vs Targets
        </h3>

        <div class="space-y-5">
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Flame class="w-4 h-4 text-orange-500" />
                <span class="text-sm font-semibold text-foreground">Calories</span>
              </div>
              <span class="text-sm font-bold" :class="getNutrientTone(weekNutrition.total.calories, weeklyTargets.calories)">
                {{ weekNutrition.total.calories }} / {{ weeklyTargets.calories }}
              </span>
            </div>
            <Progress :model-value="getProgress(weekNutrition.total.calories, weeklyTargets.calories)" class="h-3 rounded-full" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Beef class="w-4 h-4 text-rose-500" />
                <span class="text-sm font-semibold text-foreground">Protein</span>
              </div>
              <span class="text-sm font-bold" :class="getNutrientTone(weekNutrition.total.protein, weeklyTargets.protein)">
                {{ weekNutrition.total.protein }}g / {{ weeklyTargets.protein }}g
              </span>
            </div>
            <Progress :model-value="getProgress(weekNutrition.total.protein, weeklyTargets.protein)" class="h-3 rounded-full" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Wheat class="w-4 h-4 text-amber-500" />
                <span class="text-sm font-semibold text-foreground">Carbs</span>
              </div>
              <span class="text-sm font-bold" :class="getNutrientTone(weekNutrition.total.carbs, weeklyTargets.carbs)">
                {{ weekNutrition.total.carbs }}g / {{ weeklyTargets.carbs }}g
              </span>
            </div>
            <Progress :model-value="getProgress(weekNutrition.total.carbs, weeklyTargets.carbs)" class="h-3 rounded-full" />
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <Droplets class="w-4 h-4 text-sky-500" />
                <span class="text-sm font-semibold text-foreground">Fat</span>
              </div>
              <span class="text-sm font-bold" :class="getNutrientTone(weekNutrition.total.fat, weeklyTargets.fat)">
                {{ weekNutrition.total.fat }}g / {{ weeklyTargets.fat }}g
              </span>
            </div>
            <Progress :model-value="getProgress(weekNutrition.total.fat, weeklyTargets.fat)" class="h-3 rounded-full" />
          </div>
        </div>
      </div>

      <!-- Shopping & quick stats -->
      <div class="lg:col-span-6 space-y-6">
        <div class="surface-card p-5 lg:p-6">
          <h3 class="font-bold text-foreground tracking-tight mb-5 flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart class="w-4 h-4 text-primary" />
            </div>
            Shopping Progress
          </h3>

          <div class="flex items-center gap-6 mb-4">
            <div>
              <p class="text-4xl font-extrabold text-primary tracking-tight">{{ shopping.progress }}%</p>
              <p class="text-xs text-muted-foreground mt-0.5">complete</p>
            </div>
            <div class="flex-1">
              <Progress :model-value="shopping.progress" class="h-3 rounded-full" />
              <div class="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{{ shopping.checkedItems.length }} checked</span>
                <span>{{ shopping.remainingItems }} remaining</span>
              </div>
            </div>
          </div>

          <Button variant="outline" class="w-full press-scale" @click="router.push('/shopping-list')">
            <ShoppingCart class="w-4 h-4 mr-1.5" /> View Shopping List
          </Button>
        </div>

        <!-- Tips/Insights -->
        <div class="surface-card p-5 lg:p-6">
          <h3 class="font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target class="w-4 h-4 text-primary" />
            </div>
            Insights
          </h3>

          <div class="space-y-3">
            <div v-if="coveragePercent < 50" class="flex items-start gap-3 rounded-xl bg-amber-500/8 p-3">
              <AlertTriangle class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p class="text-sm text-foreground">You have less than half your meals planned. Head to the <button class="text-primary font-semibold hover:underline" @click="router.push('/planner')">planner</button> to fill in more slots.</p>
            </div>

            <div v-if="weekNutrition && weekNutrition.total.protein < weeklyTargets.protein * 0.7" class="flex items-start gap-3 rounded-xl bg-rose-500/8 p-3">
              <Beef class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p class="text-sm text-foreground">Weekly protein is behind target. Consider adding protein-rich recipes to upcoming meals.</p>
            </div>

            <div v-if="weekNutrition && weekNutrition.total.calories > weeklyTargets.calories * 1.1" class="flex items-start gap-3 rounded-xl bg-rose-500/8 p-3">
              <Flame class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p class="text-sm text-foreground">Weekly calories are above your target. You may want to swap a few heavier meals.</p>
            </div>

            <div v-if="coveragePercent >= 80 && reportScore >= 70" class="flex items-start gap-3 rounded-xl bg-emerald-500/8 p-3">
              <CheckCircle2 class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <p class="text-sm text-foreground">Great job! Your meal plan is well-organized and on track with your nutrition goals.</p>
            </div>

            <div v-if="!weekNutrition && totalMeals === 0" class="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <CalendarDays class="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p class="text-sm text-muted-foreground">No meals planned yet this week. Start by <button class="text-primary font-semibold hover:underline" @click="router.push('/planner')">adding meals to your planner</button>.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  </template>
</template>
