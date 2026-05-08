<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlannerStore } from '@/stores/planner'
import { useShoppingStore } from '@/stores/shopping'
import { useHouseholdStore } from '@/stores/household'
import { useInsightsStore } from '@/stores/insights'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { DEFAULT_HEALTH_TARGETS, type WeeklyNutritionMeal, type WeeklyNutritionMissingMeal } from '@/types'
import { formatDateShort, getDayNameShort, getTodayDateKey, isToday } from '@/utils/date'
import { getMealPeriodDisplay, getMealPeriods } from '@/utils/meal-periods'
import {
  ChevronLeft, ChevronRight, CalendarDays, Activity, ShoppingCart, Flame,
  Beef, Wheat, Droplets, ChefHat, Target, CheckCircle2, AlertTriangle,
  Download,
} from 'lucide-vue-next'

type ReportMode = 'day' | 'week' | 'month'
type NutrientKey = 'calories' | 'protein' | 'carbs' | 'fat'
type ReportDay = {
  date: string
  dayName: string
  dateLabel: string
  isToday: boolean
  plannedMealCount: number
  missingNutritionCount: number
  calories: number
  protein: number
  carbs: number
  fat: number
  meals: WeeklyNutritionMeal[]
  missingMeals: WeeklyNutritionMissingMeal[]
}

const router = useRouter()
const auth = useAuthStore()
const planner = usePlannerStore()
const shopping = useShoppingStore()
const household = useHouseholdStore()
const insights = useInsightsStore()

const reportLoading = ref(true)
const reportMode = ref<ReportMode>('week')
const selectedDate = ref(getTodayDateKey())
const selectedMonth = ref(getMonthKey(new Date()))

const healthTargets = computed(() => auth.user?.healthTargets || DEFAULT_HEALTH_TARGETS)
const mealTypes = computed(() => getMealPeriods(household.preferences))
const periodValue = computed(() => {
  if (reportMode.value === 'day') return selectedDate.value
  if (reportMode.value === 'month') return selectedMonth.value
  return planner.currentWeekStart
})
const nutritionKey = computed(() => `${reportMode.value}:${periodValue.value}`)
const reportNutrition = computed(() => insights.periodNutritionByKey[nutritionKey.value] || null)
const reportNutritionError = computed(() => insights.periodNutritionErrors[nutritionKey.value] || null)
const trackedNutritionMealCount = computed(() => (
  reportNutrition.value?.perDay.reduce((count, day) => count + day.meals.length, 0) || 0
))
const missingNutritionMealCount = computed(() => reportNutrition.value?.missingNutritionCount || 0)
const hasTrackedNutrition = computed(() => trackedNutritionMealCount.value > 0)
const periodDayCount = computed(() => {
  if (reportMode.value === 'day') return 1
  if (reportMode.value === 'week') return 7
  return getDaysInMonth(selectedMonth.value)
})
const periodTargets = computed(() => ({
  calories: healthTargets.value.calories * periodDayCount.value,
  protein: healthTargets.value.protein * periodDayCount.value,
  carbs: healthTargets.value.carbs * periodDayCount.value,
  fat: healthTargets.value.fat * periodDayCount.value,
}))
const totalPossibleSlots = computed(() => Math.max(mealTypes.value.length * periodDayCount.value, 1))
const coveragePercent = computed(() => {
  const planned = reportNutrition.value?.plannedMealCount || 0
  return Math.min(100, Math.round((planned / totalPossibleSlots.value) * 100))
})
const periodDates = computed(() => {
  if (reportMode.value === 'day') return [selectedDate.value]
  if (reportMode.value === 'week') return getDateRange(planner.currentWeekStart, addDays(planner.currentWeekStart, 7))
  return getDateRange(`${selectedMonth.value}-01`, addDaysToMonth(selectedMonth.value, 1))
})
const perDayData = computed<ReportDay[]>(() => (
  periodDates.value.map(date => {
    const dayNutrition = reportNutrition.value?.perDay.find(day => day.date === date)
    return {
      date,
      dayName: getDayNameShort(date),
      dateLabel: formatDateShort(date),
      isToday: isToday(date),
      plannedMealCount: dayNutrition?.plannedMealCount || 0,
      missingNutritionCount: dayNutrition?.missingNutritionCount || 0,
      calories: dayNutrition?.total.calories || 0,
      protein: dayNutrition?.total.protein || 0,
      carbs: dayNutrition?.total.carbs || 0,
      fat: dayNutrition?.total.fat || 0,
      meals: dayNutrition?.meals || [],
      missingMeals: dayNutrition?.missingMeals || [],
    }
  })
))
const selectedDayMeals = computed(() => perDayData.value.find(day => day.date === selectedDate.value)?.meals || [])
const selectedDayMissingMeals = computed(() => perDayData.value.find(day => day.date === selectedDate.value)?.missingMeals || [])
const calorieChartMax = computed(() => Math.max(...perDayData.value.map(day => day.calories), healthTargets.value.calories, 1))
const calorieTargetLineBottom = computed(() => `${Math.min(100, Math.round((healthTargets.value.calories / calorieChartMax.value) * 100))}%`)
const averageDailyCalories = computed(() => Math.round((reportNutrition.value?.total.calories || 0) / periodDayCount.value))
const averageDailyProgress = computed(() => getProgress(averageDailyCalories.value, healthTargets.value.calories))
const mealCountByType = computed(() => {
  const counts = mealTypes.value.reduce<Record<string, number>>((accumulator, mealType) => {
    accumulator[mealType] = 0
    return accumulator
  }, {})
  const source = reportNutrition.value?.mealTypeCounts || {}
  for (const [mealType, count] of Object.entries(source)) {
    counts[mealType] = count
  }
  return counts
})
const reportScore = computed(() => {
  let score = Math.min(40, Math.round(coveragePercent.value * 0.4))
  if (reportNutrition.value && hasTrackedNutrition.value) {
    score += scoreNutrient(reportNutrition.value.total.calories, periodTargets.value.calories, 'balanced')
    score += scoreNutrient(reportNutrition.value.total.protein, periodTargets.value.protein, 'minimum')
  }
  return score
})
const scoreLabel = computed(() => {
  if (reportScore.value >= 80) return { text: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400' }
  if (reportScore.value >= 60) return { text: 'Good', color: 'text-primary' }
  if (reportScore.value >= 40) return { text: 'Fair', color: 'text-amber-600 dark:text-amber-400' }
  return { text: 'Needs Work', color: 'text-rose-600 dark:text-rose-400' }
})
const reportTitle = computed(() => {
  if (reportMode.value === 'day') return 'Daily Report'
  if (reportMode.value === 'month') return 'Monthly Report'
  return 'Weekly Report'
})
const reportDescription = computed(() => {
  if (reportMode.value === 'day') return formatDateLong(selectedDate.value)
  if (reportMode.value === 'month') return formatMonthLabel(selectedMonth.value)
  return `Week of ${formatDateShort(planner.currentWeekStart)} - ${formatDateShort(addDays(planner.currentWeekStart, 6))}`
})

onMounted(async () => {
  await Promise.all([
    auth.loadUser(),
    planner.loadWeekPlan(),
    shopping.loadItems(),
    localStorage.getItem('household_id') && !household.preferences ? household.loadHousehold() : Promise.resolve(),
  ])

  await loadReportNutrition(true)
  reportLoading.value = false
})

watch(reportMode, async () => {
  reportLoading.value = true
  try {
    await loadReportNutrition(true)
  } finally {
    reportLoading.value = false
  }
})

async function loadReportNutrition(force = true) {
  try {
    await insights.loadPeriodNutrition(reportMode.value, periodValue.value, force)
  } catch {
    // surfaced through the insights error state
  }
}

async function navigateReport(direction: 'prev' | 'next') {
  reportLoading.value = true
  try {
    if (reportMode.value === 'day') {
      selectedDate.value = addDays(selectedDate.value, direction === 'next' ? 1 : -1)
    } else if (reportMode.value === 'month') {
      selectedMonth.value = addMonths(selectedMonth.value, direction === 'next' ? 1 : -1)
    } else {
      await planner.navigateWeek(direction)
    }
    await loadReportNutrition(true)
  } finally {
    reportLoading.value = false
  }
}

async function handleDateInput() {
  await loadReportNutrition(true)
}

function getProgress(current: number, target: number) {
  if (!target) return 0
  return Math.min(100, Math.round((current / target) * 100))
}

function getBarHeight(calories: number) {
  if (!calorieChartMax.value) return '0%'
  if (!calories) return '4px'
  return Math.max(8, Math.round((calories / calorieChartMax.value) * 100)) + '%'
}

function getBarTone(day: ReportDay) {
  if (day.missingNutritionCount && !day.meals.length) {
    return 'from-amber-300 to-amber-500 dark:from-amber-400/70 dark:to-amber-500/80'
  }

  if (!day.plannedMealCount) {
    return 'from-muted to-muted-foreground/25'
  }

  if (day.calories > healthTargets.value.calories * 1.1) {
    return 'from-rose-300 to-rose-500 dark:from-rose-400/70 dark:to-rose-500/80'
  }

  if (day.calories >= healthTargets.value.calories * 0.8) {
    return 'from-emerald-300 to-emerald-500 dark:from-emerald-400/70 dark:to-emerald-500/80'
  }

  return day.isToday
    ? 'from-primary/60 to-primary'
    : 'from-primary/25 to-primary/60'
}

function getCalorieDelta(day: ReportDay) {
  return Math.round(day.calories - healthTargets.value.calories)
}

function formatSignedNumber(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function shouldShowChartLabel(index: number) {
  if (reportMode.value !== 'month') return true
  return index === 0 || index === perDayData.value.length - 1 || (index + 1) % 5 === 0
}

function getNutrientTone(current: number, target: number) {
  const ratio = target ? current / target : 0
  if (ratio >= 0.8 && ratio <= 1.1) return 'text-emerald-600 dark:text-emerald-400'
  if (ratio >= 0.6 && ratio <= 1.3) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function scoreNutrient(current: number, target: number, mode: 'balanced' | 'minimum') {
  const ratio = target ? current / target : 0
  if (mode === 'minimum') {
    if (ratio >= 0.8) return 30
    if (ratio >= 0.6) return 20
    return 10
  }
  if (ratio >= 0.8 && ratio <= 1.1) return 30
  if (ratio >= 0.6 && ratio <= 1.3) return 20
  return 10
}

function nutrientLabel(key: NutrientKey) {
  return key === 'calories' ? 'Calories' : key[0].toUpperCase() + key.slice(1)
}

function nutrientUnit(key: NutrientKey) {
  return key === 'calories' ? '' : 'g'
}

function getMealTotal(meal: WeeklyNutritionMeal, key: NutrientKey) {
  return meal.nutrition[key] || 0
}

function exportReportCsv() {
  const report = reportNutrition.value
  if (!report) return

  const rows = buildExportRows()
  const header = [
    'report',
    'period',
    'date',
    'meal_type',
    'recipe',
    'servings',
    'nutrition_status',
    'calories',
    'protein_g',
    'carbs_g',
    'fat_g',
  ]
  const csv = [
    header.join(','),
    ...rows.map(row => header.map(key => escapeCsv(row[key] ?? '')).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${reportMode.value}-nutrition-report-${periodValue.value}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildExportRows() {
  const rows: Record<string, string | number>[] = []
  const periodLabel = reportDescription.value

  for (const day of perDayData.value) {
    if (!day.plannedMealCount) {
      rows.push(createExportRow(day.date, '', '', '', 'not planned', day.calories, day.protein, day.carbs, day.fat, periodLabel))
      continue
    }

    for (const meal of day.meals) {
      rows.push(createExportRow(day.date, meal.mealType, meal.recipeTitle, meal.servings, 'manual nutrition', meal.nutrition.calories, meal.nutrition.protein, meal.nutrition.carbs, meal.nutrition.fat, periodLabel))
    }

    for (const meal of day.missingMeals) {
      rows.push(createExportRow(day.date, meal.mealType, meal.recipeTitle, meal.servings, 'missing nutrition', '', '', '', '', periodLabel))
    }
  }

  return rows
}

function createExportRow(
  date: string,
  mealType: string,
  recipeTitle: string,
  servings: string | number,
  status: string,
  calories: string | number,
  protein: string | number,
  carbs: string | number,
  fat: string | number,
  periodLabel: string
) {
  return {
    report: reportTitle.value,
    period: periodLabel,
    date,
    meal_type: mealType ? getMealPeriodDisplay(mealType).label : '',
    recipe: recipeTitle,
    servings,
    nutrition_status: status,
    calories,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
  }
}

function escapeCsv(value: string | number) {
  const text = String(value)
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return getDateKey(date)
}

function addMonths(monthKey: string, months: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + months, 1)
  return getMonthKey(date)
}

function addDaysToMonth(monthKey: string, months: number) {
  return `${addMonths(monthKey, months)}-01`
}

function getDateRange(startDate: string, endDate: string) {
  const dates: string[] = []
  let cursor = startDate
  while (cursor < endDate) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getDaysInMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function formatDateLong(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <PageHeader :title="reportTitle" :description="reportDescription">
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" @click="navigateReport('prev')" class="press-scale">
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <Input
          v-if="reportMode === 'day'"
          v-model="selectedDate"
          type="date"
          class="h-9 w-[150px]"
          @change="handleDateInput"
        />
        <Input
          v-else-if="reportMode === 'month'"
          v-model="selectedMonth"
          type="month"
          class="h-9 w-[150px]"
          @change="handleDateInput"
        />
        <Button variant="outline" size="sm" @click="navigateReport('next')" class="press-scale">
          <ChevronRight class="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" :disabled="reportLoading || !reportNutrition" @click="exportReportCsv" class="press-scale">
          <Download class="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </template>
  </PageHeader>

  <div class="mb-6 inline-flex rounded-xl border border-border/70 bg-muted/30 p-1">
    <button
      v-for="mode in (['day', 'week', 'month'] as ReportMode[])"
      :key="mode"
      type="button"
      class="rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors"
      :class="reportMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
      @click="reportMode = mode"
    >
      {{ mode === 'day' ? 'Daily' : mode === 'week' ? 'Weekly' : 'Monthly' }}
    </button>
  </div>

  <div v-if="reportLoading" class="grid gap-6 lg:grid-cols-12">
    <AppSkeleton class="h-48 lg:col-span-4" />
    <AppSkeleton class="h-48 lg:col-span-8" />
    <AppSkeleton class="h-64 lg:col-span-12" />
  </div>

  <template v-else>
    <div class="grid gap-6 lg:grid-cols-12 stagger-children">
      <div class="surface-elevated p-6 text-center lg:col-span-4">
        <div class="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 border-primary/20">
          <span class="text-3xl font-extrabold text-foreground">{{ reportScore }}</span>
        </div>
        <p class="text-lg font-bold" :class="scoreLabel.color">{{ scoreLabel.text }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ reportMode === 'day' ? 'Daily' : reportMode === 'month' ? 'Monthly' : 'Weekly' }} wellness score</p>
        <div class="mt-4 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1">
            <CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />
            {{ coveragePercent }}% meal coverage
          </span>
        </div>
      </div>

      <div class="surface-card p-5 lg:col-span-8 lg:p-6">
        <h3 class="mb-5 flex items-center gap-2 font-bold tracking-tight text-foreground">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ChefHat class="h-4 w-4 text-primary" />
          </div>
          Meal Planning Summary
        </h3>

        <div class="mb-6 grid gap-4" :style="{ gridTemplateColumns: `repeat(${mealTypes.length}, minmax(0, 1fr))` }">
          <div
            v-for="mealType in mealTypes"
            :key="mealType"
            class="rounded-xl p-4 text-center"
            :class="getMealPeriodDisplay(mealType).bg"
          >
            <component :is="getMealPeriodDisplay(mealType).icon" class="mx-auto mb-2 h-5 w-5" :class="getMealPeriodDisplay(mealType).color" />
            <p class="text-2xl font-extrabold text-foreground">{{ mealCountByType[mealType] || 0 }}</p>
            <p class="mt-0.5 text-xs font-semibold text-muted-foreground">{{ getMealPeriodDisplay(mealType).label }}</p>
          </div>
        </div>

        <div class="rounded-xl bg-muted/40 p-4">
          <div class="mb-3 flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold text-foreground">
                {{ reportNutrition?.plannedMealCount || 0 }} of {{ totalPossibleSlots }} meal slots filled
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                {{ trackedNutritionMealCount }} meals with nutrition
                <span v-if="reportNutrition?.missingNutritionCount">, {{ reportNutrition.missingNutritionCount }} missing nutrition</span>
              </p>
            </div>
            <span class="text-sm font-bold text-primary">{{ coveragePercent }}%</span>
          </div>
          <Progress :model-value="coveragePercent" class="h-2.5 rounded-full" />
        </div>
      </div>

      <div class="surface-card p-5 lg:col-span-12 lg:p-6">
        <div class="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <h3 class="flex items-center gap-2 font-bold tracking-tight text-foreground">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Flame class="h-4 w-4 text-primary" />
            </div>
            {{ reportMode === 'day' ? 'Daily Meal Calories' : reportMode === 'month' ? 'Monthly Calories by Day' : 'Daily Calories' }}
          </h3>

          <div class="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[520px]">
            <div class="rounded-xl bg-muted/40 px-3.5 py-3">
              <p class="text-[11px] font-semibold uppercase text-muted-foreground">Total</p>
              <p class="mt-1 font-extrabold text-foreground">{{ reportNutrition?.total.calories || 0 }} cal</p>
            </div>
            <div class="rounded-xl bg-muted/40 px-3.5 py-3">
              <p class="text-[11px] font-semibold uppercase text-muted-foreground">Daily Avg</p>
              <p class="mt-1 font-extrabold" :class="getNutrientTone(averageDailyCalories, healthTargets.calories)">
                {{ averageDailyCalories }} cal
              </p>
            </div>
            <div class="rounded-xl bg-muted/40 px-3.5 py-3">
              <p class="text-[11px] font-semibold uppercase text-muted-foreground">Manual Data</p>
              <p class="mt-1 font-extrabold text-foreground">
                {{ trackedNutritionMealCount }}/{{ reportNutrition?.plannedMealCount || 0 }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="reportNutritionError" class="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-foreground">
          Nutrition data is unavailable. {{ reportNutritionError }}
        </div>
        <template v-else>
          <div v-if="reportNutrition && !hasTrackedNutrition && reportNutrition.missingNutritionCount" class="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-foreground">
            Planned meals are missing recipe nutrition. Add whole-recipe calories and macros on each recipe to calculate this report.
          </div>

          <template v-if="reportMode === 'day'">
            <div class="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div class="rounded-2xl border border-border/60 bg-muted/25 p-5">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily calories</p>
                  <p class="mt-2 text-4xl font-extrabold tracking-tight text-foreground">
                    {{ reportNutrition?.total.calories || 0 }}
                  </p>
                </div>
                <div class="text-right text-sm">
                  <p class="font-bold" :class="getNutrientTone(reportNutrition?.total.calories || 0, healthTargets.calories)">
                    {{ getProgress(reportNutrition?.total.calories || 0, healthTargets.calories) }}%
                  </p>
                  <p class="text-xs text-muted-foreground">of {{ healthTargets.calories }} cal</p>
                </div>
              </div>
              <Progress :model-value="getProgress(reportNutrition?.total.calories || 0, healthTargets.calories)" class="mt-4 h-3 rounded-full" />
              <div class="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div class="rounded-xl bg-background/60 p-3">
                  <p class="font-bold text-foreground">{{ selectedDayMeals.length }}</p>
                  <p class="text-muted-foreground">with data</p>
                </div>
                <div class="rounded-xl bg-background/60 p-3">
                  <p class="font-bold text-foreground">{{ selectedDayMissingMeals.length }}</p>
                  <p class="text-muted-foreground">missing</p>
                </div>
                <div class="rounded-xl bg-background/60 p-3">
                  <p class="font-bold text-foreground">{{ reportNutrition?.plannedMealCount || 0 }}</p>
                  <p class="text-muted-foreground">planned</p>
                </div>
              </div>
            </div>

            <div v-if="selectedDayMeals.length || selectedDayMissingMeals.length" class="grid gap-4 md:grid-cols-2">
              <div
                v-for="meal in selectedDayMeals"
                :key="meal.slotId"
                class="rounded-xl border border-border/60 bg-muted/20 p-4"
              >
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ getMealPeriodDisplay(meal.mealType).label }}</p>
                <p class="mt-1 text-sm font-bold text-foreground">{{ meal.recipeTitle }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ meal.servings }} servings</p>
                <div class="mt-4 space-y-3">
                  <div v-for="key in (['calories', 'protein', 'carbs', 'fat'] as NutrientKey[])" :key="key">
                    <div class="mb-1 flex items-center justify-between text-xs">
                      <span class="font-semibold text-foreground">{{ nutrientLabel(key) }}</span>
                      <span class="text-muted-foreground">{{ getMealTotal(meal, key) }}{{ nutrientUnit(key) }}</span>
                    </div>
                    <Progress :model-value="getProgress(getMealTotal(meal, key), key === 'calories' ? healthTargets.calories : healthTargets[key])" class="h-2 rounded-full" />
                  </div>
                </div>
              </div>
              <div
                v-for="meal in selectedDayMissingMeals"
                :key="meal.slotId"
                class="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4"
              >
                <p class="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">{{ getMealPeriodDisplay(meal.mealType).label }}</p>
                <p class="mt-1 text-sm font-bold text-foreground">{{ meal.recipeTitle }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ meal.servings }} servings</p>
                <div class="mt-4 rounded-lg bg-background/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                  Missing manual nutrition
                </div>
              </div>
            </div>
            <div v-else class="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              No tracked nutrition for this day yet.
              </div>
            </div>
          </template>

          <template v-else>
            <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div class="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
              <div class="flex h-72 flex-col justify-between pt-3 text-right text-[11px] font-semibold text-muted-foreground">
                <span>{{ calorieChartMax }} cal</span>
                <span>{{ healthTargets.calories }} cal</span>
                <span>0</span>
              </div>

              <div class="relative h-72 rounded-2xl border border-border/60 bg-muted/25 px-2 pb-9 pt-4">
                <div
                  class="absolute left-3 right-3 z-0 border-t border-dashed border-primary/50"
                  :style="{ bottom: calorieTargetLineBottom }"
                >
                  <span class="absolute -top-3 right-0 rounded-full bg-background px-2 text-[10px] font-bold text-primary shadow-sm">target</span>
                </div>

                <div class="relative z-10 flex h-full items-end gap-1.5 sm:gap-2">
                  <div v-for="(day, index) in perDayData" :key="day.date" class="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div class="relative flex h-full w-full items-end justify-center rounded-lg bg-background/55 px-0.5">
                      <div
                        class="relative w-full max-w-[42px] rounded-t-lg bg-gradient-to-t shadow-sm transition-all duration-500"
                        :class="getBarTone(day)"
                        :style="{ height: getBarHeight(day.calories) }"
                      >
                        <div class="absolute -top-12 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-lg group-hover:block">
                          {{ day.calories }} cal
                          <span class="block text-[10px] text-muted-foreground">
                            {{ formatSignedNumber(getCalorieDelta(day)) }} vs target
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="h-7 text-center">
                      <p
                        v-if="shouldShowChartLabel(index)"
                        class="text-[10px] font-bold"
                        :class="day.isToday ? 'text-primary' : 'text-muted-foreground'"
                      >
                        {{ reportMode === 'month' ? Number(day.date.slice(-2)) : day.dayName }}
                      </p>
                      <p v-if="shouldShowChartLabel(index)" class="text-[9px] text-muted-foreground/70">
                        {{ getProgress(day.calories, healthTargets.calories) }}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <div class="rounded-xl bg-muted/35 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Average Pace</p>
                <p class="mt-2 text-2xl font-extrabold text-foreground">{{ averageDailyCalories }} cal</p>
                <Progress :model-value="averageDailyProgress" class="mt-3 h-2.5 rounded-full" />
              </div>
              <div class="rounded-xl bg-emerald-500/8 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">With manual nutrition</p>
                <p class="mt-2 text-2xl font-extrabold text-foreground">{{ trackedNutritionMealCount }}</p>
              </div>
              <div class="rounded-xl bg-amber-500/8 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Missing nutrition</p>
                <p class="mt-2 text-2xl font-extrabold text-foreground">{{ missingNutritionMealCount }}</p>
              </div>
            </div>
            </div>

            <div class="mt-4 flex items-center gap-2">
              <div class="h-px flex-1 border-t-2 border-dashed border-primary/30" />
              <span class="text-[11px] font-semibold text-primary/60">Daily target: {{ healthTargets.calories }} cal</span>
              <div class="h-px flex-1 border-t-2 border-dashed border-primary/30" />
            </div>
          </template>
        </template>
      </div>

      <div class="surface-card p-5 lg:col-span-6 lg:p-6">
        <h3 class="mb-5 flex items-center gap-2 font-bold tracking-tight text-foreground">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Activity class="h-4 w-4 text-primary" />
          </div>
          Macros vs Targets
        </h3>

        <div v-if="reportNutrition && hasTrackedNutrition" class="space-y-5">
          <div v-for="item in [
            { key: 'calories', label: 'Calories', icon: Flame, color: 'text-orange-500' },
            { key: 'protein', label: 'Protein', icon: Beef, color: 'text-rose-500' },
            { key: 'carbs', label: 'Carbs', icon: Wheat, color: 'text-amber-500' },
            { key: 'fat', label: 'Fat', icon: Droplets, color: 'text-sky-500' },
          ]" :key="item.key">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <component :is="item.icon" class="h-4 w-4" :class="item.color" />
                <span class="text-sm font-semibold text-foreground">{{ item.label }}</span>
              </div>
              <span class="text-sm font-bold" :class="getNutrientTone(reportNutrition.total[item.key as NutrientKey], periodTargets[item.key as NutrientKey])">
                {{ reportNutrition.total[item.key as NutrientKey] }}{{ item.key === 'calories' ? '' : 'g' }} / {{ periodTargets[item.key as NutrientKey] }}{{ item.key === 'calories' ? '' : 'g' }}
              </span>
            </div>
            <Progress :model-value="getProgress(reportNutrition.total[item.key as NutrientKey], periodTargets[item.key as NutrientKey])" class="h-3 rounded-full" />
          </div>
        </div>
        <div v-else class="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-foreground">
          {{ reportNutrition?.missingNutritionCount ? `${reportNutrition.missingNutritionCount} planned meals are missing recipe nutrition.` : 'No nutrition tracked for this period yet.' }}
        </div>
      </div>

      <div class="space-y-6 lg:col-span-6">
        <div class="surface-card p-5 lg:p-6">
          <h3 class="mb-5 flex items-center gap-2 font-bold tracking-tight text-foreground">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart class="h-4 w-4 text-primary" />
            </div>
            Shopping Progress
          </h3>

          <div class="mb-4 flex items-center gap-6">
            <div>
              <p class="text-4xl font-extrabold tracking-tight text-primary">{{ shopping.progress }}%</p>
              <p class="mt-0.5 text-xs text-muted-foreground">complete</p>
            </div>
            <div class="flex-1">
              <Progress :model-value="shopping.progress" class="h-3 rounded-full" />
              <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{{ shopping.checkedItems.length }} checked</span>
                <span>{{ shopping.remainingItems }} remaining</span>
              </div>
            </div>
          </div>

          <Button variant="outline" class="w-full press-scale" @click="router.push('/shopping-list')">
            <ShoppingCart class="mr-1.5 h-4 w-4" /> View Shopping List
          </Button>
        </div>

        <div class="surface-card p-5 lg:p-6">
          <h3 class="mb-4 flex items-center gap-2 font-bold tracking-tight text-foreground">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Target class="h-4 w-4 text-primary" />
            </div>
            Insights
          </h3>

          <div class="space-y-3">
            <div v-if="coveragePercent < 50" class="flex items-start gap-3 rounded-xl bg-amber-500/8 p-3">
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p class="text-sm text-foreground">Less than half of this period is planned. Add more meals in the planner.</p>
            </div>

            <div v-if="reportNutrition?.missingNutritionCount" class="flex items-start gap-3 rounded-xl bg-amber-500/8 p-3">
              <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p class="text-sm text-foreground">{{ reportNutrition.missingNutritionCount }} planned meals are missing recipe nutrition.</p>
            </div>

            <div v-if="reportNutrition && hasTrackedNutrition && reportNutrition.total.protein < periodTargets.protein * 0.7" class="flex items-start gap-3 rounded-xl bg-rose-500/8 p-3">
              <Beef class="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <p class="text-sm text-foreground">Protein is behind target for this period.</p>
            </div>

            <div v-if="reportNutrition && hasTrackedNutrition && reportNutrition.total.calories > periodTargets.calories * 1.1" class="flex items-start gap-3 rounded-xl bg-rose-500/8 p-3">
              <Flame class="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <p class="text-sm text-foreground">Calories are above target for this period.</p>
            </div>

            <div v-if="coveragePercent >= 80 && reportScore >= 70" class="flex items-start gap-3 rounded-xl bg-emerald-500/8 p-3">
              <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <p class="text-sm text-foreground">This period is well planned and close to your nutrition goals.</p>
            </div>

            <div v-if="!reportNutrition || reportNutrition.plannedMealCount === 0" class="flex items-start gap-3 rounded-xl bg-muted/60 p-3">
              <CalendarDays class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p class="text-sm text-muted-foreground">No meals planned for this period yet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
