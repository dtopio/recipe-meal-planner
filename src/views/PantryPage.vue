<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PantryItemRow from '@/components/app/PantryItemRow.vue'
import AppEmptyState from '@/components/app/AppEmptyState.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePantryStore } from '@/stores/pantry'
import { usePlannerStore } from '@/stores/planner'
import { CATEGORY_EMOJI, CATEGORY_LABELS, SHOPPING_CATEGORIES } from '@/types'
import type { AddPantryItemDTO } from '@/types'
import { ingredientMatchKey } from '@/utils/recipe'
import { formatDateShort, getTodayDateKey } from '@/utils/date'
import { Archive, Plus, Search, X, AlertTriangle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const pantry = usePantryStore()
const planner = usePlannerStore()
const showAddForm = ref(false)
const form = ref<AddPantryItemDTO>({
  name: '',
  quantity: 1,
  unit: '',
  category: 'pantry',
  lowStockThreshold: 1,
  expiresAt: '',
})

const lowStockSummary = computed(() => pantry.lowStockItems.slice(0, 3))
const plannedMealAlerts = computed(() => {
  const pantryByKey = new Map<string, {
    name: string
    unit: string
    quantity: number
    lowStockThreshold: number
    expiresAt?: string
  }>()

  for (const item of pantry.items) {
    const key = ingredientMatchKey(item.name, item.unit)
    const existing = pantryByKey.get(key)

    if (existing) {
      existing.quantity += item.quantity
      existing.lowStockThreshold = Math.max(existing.lowStockThreshold, item.lowStockThreshold)
      existing.expiresAt = pickEarlierDate(existing.expiresAt, item.expiresAt)
    } else {
      pantryByKey.set(key, {
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        lowStockThreshold: item.lowStockThreshold,
        expiresAt: item.expiresAt,
      })
    }
  }

  const requiredByKey = new Map<string, {
    requiredQuantity: number
    lastMealDate: string
    meals: Set<string>
  }>()

  for (const slot of planner.slots) {
    if (!slot.recipe) continue

    const multiplier = slot.recipe.servings > 0 && slot.servings
      ? slot.servings / slot.recipe.servings
      : 1

    for (const ingredient of slot.recipe.ingredients) {
      const key = ingredientMatchKey(ingredient.name, ingredient.unit)
      const existing = requiredByKey.get(key)
      const mealLabel = `${slot.recipe.title} (${formatDateShort(slot.date)})`

      if (existing) {
        existing.requiredQuantity += ingredient.quantity * multiplier
        existing.lastMealDate = existing.lastMealDate > slot.date ? existing.lastMealDate : slot.date
        existing.meals.add(mealLabel)
      } else {
        requiredByKey.set(key, {
          requiredQuantity: ingredient.quantity * multiplier,
          lastMealDate: slot.date,
          meals: new Set([mealLabel]),
        })
      }
    }
  }

  const today = getTodayDateKey()
  const alerts: Array<{
    id: string
    label: string
    tone: 'amber' | 'rose'
    name: string
    summary: string
    mealsLabel: string
  }> = []

  for (const [key, requirement] of requiredByKey) {
    const pantryItem = pantryByKey.get(key)
    if (!pantryItem) continue

    const mealLabels = Array.from(requirement.meals)
    const mealsLabel = mealLabels.length > 2
      ? `${mealLabels.slice(0, 2).join(' | ')} +${mealLabels.length - 2} more`
      : mealLabels.join(' | ')

    if (pantryItem.quantity < requirement.requiredQuantity || pantryItem.quantity <= pantryItem.lowStockThreshold) {
      alerts.push({
        id: `${key}-stock`,
        label: 'Low stock',
        tone: 'amber',
        name: pantryItem.name,
        summary: `Need ${formatQuantity(requirement.requiredQuantity)} ${pantryItem.unit || 'units'} this week, pantry has ${formatQuantity(pantryItem.quantity)}.`,
        mealsLabel,
      })
    }

    if (pantryItem.expiresAt) {
      const expiresBeforeUse = pantryItem.expiresAt <= requirement.lastMealDate
      const daysUntilExpiry = getDayDifference(today, pantryItem.expiresAt)

      if (expiresBeforeUse || (daysUntilExpiry >= 0 && daysUntilExpiry <= 2)) {
        alerts.push({
          id: `${key}-expiry`,
          label: pantryItem.expiresAt <= today ? 'Expired' : 'Use soon',
          tone: 'rose',
          name: pantryItem.name,
          summary: expiresBeforeUse
            ? `Expires ${formatDateShort(pantryItem.expiresAt)} before all planned uses finish this week.`
            : `Expires ${formatDateShort(pantryItem.expiresAt)} while this ingredient is planned this week.`,
          mealsLabel,
        })
      }
    }
  }

  return alerts
})
const plannedMealRiskPreview = computed(() => plannedMealAlerts.value.slice(0, 4))

onMounted(async () => {
  await Promise.all([pantry.loadItems(), planner.loadWeekPlan()])
})

async function handleAddItem() {
  if (!form.value.name.trim()) return

  try {
    await pantry.addItem({
      ...form.value,
      name: form.value.name.trim(),
      expiresAt: form.value.expiresAt || undefined,
    })
    toast.success('Pantry updated')
    form.value = {
      name: '',
      quantity: 1,
      unit: '',
      category: 'pantry',
      lowStockThreshold: 1,
      expiresAt: '',
    }
    showAddForm.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update pantry')
  }
}

async function adjustQuantity(itemId: string, delta: number) {
  try {
    await pantry.adjustQuantity(itemId, delta)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update pantry item')
  }
}

async function removeItem(itemId: string) {
  try {
    await pantry.removeItem(itemId)
    toast.success('Pantry item removed')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to remove pantry item')
  }
}

function pickEarlierDate(left?: string, right?: string) {
  if (!left) return right
  if (!right) return left
  return left < right ? left : right
}

function getDayDifference(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`)
  const toDate = new Date(`${to}T00:00:00`)
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000)
}

function formatQuantity(value: number) {
  return Number(value.toFixed(2)).toString()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Pantry</h1>
        <p class="mt-1 text-base text-muted-foreground">
          {{ pantry.items.length }} tracked ingredients / {{ pantry.lowStockItems.length }} low-stock alerts
        </p>
      </div>
      <Button class="shadow-md shadow-primary/10" @click="showAddForm = !showAddForm">
        <Plus class="mr-1.5 h-4 w-4" /> Add Pantry Item
      </Button>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="surface-card p-5">
        <p class="text-sm font-semibold text-muted-foreground">Tracked Items</p>
        <p class="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{{ pantry.items.length }}</p>
      </div>
      <div class="surface-card p-5">
        <p class="text-sm font-semibold text-muted-foreground">Total Quantity</p>
        <p class="mt-2 text-3xl font-extrabold tracking-tight text-foreground">{{ pantry.totalUnitsTracked }}</p>
      </div>
      <div class="surface-card p-5">
        <p class="text-sm font-semibold text-muted-foreground">Low-Stock Alerts</p>
        <p class="mt-2 text-3xl font-extrabold tracking-tight text-amber-600">{{ pantry.lowStockItems.length }}</p>
      </div>
      <div class="surface-card p-5">
        <p class="text-sm font-semibold text-muted-foreground">Planned Meal Risks</p>
        <p class="mt-2 text-3xl font-extrabold tracking-tight text-rose-600">{{ plannedMealAlerts.length }}</p>
      </div>
    </div>

    <div v-if="lowStockSummary.length" class="surface-card p-5">
      <div class="mb-3 flex items-center gap-2">
        <Archive class="h-4 w-4 text-amber-600" />
        <h2 class="font-bold tracking-tight text-foreground">Restock Soon</h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in lowStockSummary"
          :key="item.id"
          class="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-700"
        >
          {{ item.name }} - {{ item.quantity }} {{ item.unit || 'units' }}
        </span>
      </div>
    </div>

    <div v-if="plannedMealRiskPreview.length" class="surface-card p-5">
      <div class="mb-3 flex items-center gap-2">
        <AlertTriangle class="h-4 w-4 text-rose-600" />
        <h2 class="font-bold tracking-tight text-foreground">Planned Meal Alerts</h2>
      </div>
      <div class="space-y-3">
        <div
          v-for="alert in plannedMealRiskPreview"
          :key="alert.id"
          class="rounded-2xl border border-border/60 bg-card/70 p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-foreground">{{ alert.name }}</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ alert.summary }}</p>
              <p class="mt-2 text-xs text-muted-foreground">{{ alert.mealsLabel }}</p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              :class="alert.tone === 'rose'
                ? 'bg-rose-500/10 text-rose-700'
                : 'bg-amber-500/10 text-amber-700'"
            >
              {{ alert.label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex gap-2.5">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="pantry.searchQuery" class="h-11 rounded-xl pl-10" placeholder="Search pantry..." />
        <button v-if="pantry.searchQuery" class="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 hover:bg-muted" @click="pantry.searchQuery = ''">
          <X class="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <select
        v-model="pantry.filterCategory"
        class="hidden h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring sm:block"
      >
        <option :value="null">All</option>
        <option v-for="category in SHOPPING_CATEGORIES" :key="category" :value="category">
          {{ CATEGORY_EMOJI[category] }} {{ CATEGORY_LABELS[category] }}
        </option>
      </select>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="showAddForm" class="surface-card p-5">
        <h3 class="mb-3 text-sm font-bold text-foreground">Add pantry item</h3>
        <form class="space-y-3" @submit.prevent="handleAddItem">
          <div class="flex flex-col gap-3 sm:flex-row">
            <Input v-model="form.name" class="h-11 flex-1" placeholder="Ingredient name" required />
            <div class="flex gap-2">
              <Input v-model.number="form.quantity" class="h-11 w-24" min="0" step="0.5" type="number" />
              <Input v-model="form.unit" class="h-11 w-24" placeholder="Unit" />
            </div>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <select v-model="form.category" class="h-11 rounded-xl border border-border bg-card px-3 text-sm sm:w-44">
              <option v-for="category in SHOPPING_CATEGORIES" :key="category" :value="category">
                {{ CATEGORY_EMOJI[category] }} {{ CATEGORY_LABELS[category] }}
              </option>
            </select>
            <div class="space-y-1">
              <label class="text-xs font-medium text-muted-foreground">Low-stock threshold</label>
              <Input v-model.number="form.lowStockThreshold" class="h-11 w-28" min="0" step="0.5" type="number" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-medium text-muted-foreground">Expires on</label>
              <Input v-model="form.expiresAt" class="h-11 w-40" type="date" />
            </div>
            <div class="flex gap-2 sm:ml-auto">
              <Button :disabled="!form.name.trim()" type="submit">Save</Button>
              <Button type="button" variant="outline" @click="showAddForm = false">Cancel</Button>
            </div>
          </div>
        </form>
      </div>
    </Transition>

    <div v-if="pantry.loading && pantry.items.length === 0" class="space-y-3">
      <AppSkeleton v-for="index in 6" :key="index" class="h-16" />
    </div>

    <AppEmptyState
      v-else-if="pantry.items.length === 0"
      icon="BOX"
      title="Your pantry is empty"
      description="Track what you already have at home. MealSync will subtract pantry stock when generating your shopping list - no more buying duplicates!"
      action-label="Add Your First Item"
      @action="showAddForm = true"
    />

    <div v-else class="space-y-5">
      <div v-for="[category, categoryItems] in pantry.itemsByCategory" :key="category">
        <div class="mb-2 flex items-center gap-2.5">
          <span class="text-lg">{{ CATEGORY_EMOJI[category] }}</span>
          <h3 class="text-sm font-bold tracking-tight text-foreground">{{ CATEGORY_LABELS[category] }}</h3>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{{ categoryItems.length }}</span>
        </div>

        <div class="surface-card overflow-hidden divide-y divide-border/50">
          <PantryItemRow
            v-for="item in categoryItems"
            :key="item.id"
            :item="item"
            @decrement="adjustQuantity(item.id, -1)"
            @increment="adjustQuantity(item.id, 1)"
            @remove="removeItem(item.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
