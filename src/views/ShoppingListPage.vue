<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useShoppingStore } from '@/stores/shopping'
import { usePlannerStore } from '@/stores/planner'
import { useUiStore } from '@/stores/ui'
import { useOnline } from '@/composables/useOnline'
import { syncService } from '@/services/sync/socket'
import ShoppingListItemRow from '@/components/app/ShoppingListItemRow.vue'
import StatusBadge from '@/components/app/StatusBadge.vue'
import AppEmptyState from '@/components/app/AppEmptyState.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { CATEGORY_LABELS, CATEGORY_EMOJI, SHOPPING_CATEGORIES } from '@/types'
import type { AddShoppingItemDTO, ShoppingPeriod } from '@/types'
import { formatDateShort } from '@/utils/date'
import {
  Plus,
  Search,
  X,
  Trash2,
  Copy,
  Share2,
  Download,
  WifiOff,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Sparkles,
  AlertTriangle,
  Loader2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const store = useShoppingStore()
const planner = usePlannerStore()
const ui = useUiStore()
const { isOnline } = useOnline()

const showAddForm = ref(false)
const showCompleted = ref(false)
const newItem = ref<AddShoppingItemDTO>({
  name: '',
  quantity: 1,
  unit: '',
  category: 'other',
})
const periodOptions: Array<{ value: ShoppingPeriod; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]
const visibleAiSummary = computed(() => {
  if (!store.aiSummary || store.aiSummary.period !== store.periodFilter) {
    return null
  }

  if (store.aiSummary.period === 'week' && store.aiSummary.weekStart !== store.periodWeekStart) {
    return null
  }

  return store.aiSummary
})
const hasItemsOutsideCurrentPeriod = computed(() => (
  store.allItemCount > 0 && store.totalItems === 0
))
const exportItems = computed(() => {
  let result = [...store.periodItems]

  if (store.searchQuery) {
    const query = store.searchQuery.toLowerCase()
    result = result.filter(item => item.name.toLowerCase().includes(query))
  }

  if (store.filterCategory) {
    result = result.filter(item => item.category === store.filterCategory)
  }

  return result.sort((left, right) => {
    if (left.checked !== right.checked) {
      return Number(left.checked) - Number(right.checked)
    }

    if (left.category !== right.category) {
      return left.category.localeCompare(right.category)
    }

    return left.name.localeCompare(right.name)
  })
})

onMounted(async () => {
  await Promise.all([store.loadItems(), planner.loadWeekPlan()])
  store.periodWeekStart = planner.currentWeekStart
  syncService.connect()
})

watch(() => store.periodFilter, () => {
  store.aiSummaryError = null
})

watch(() => planner.currentWeekStart, (weekStart) => {
  store.periodWeekStart = weekStart
  store.aiSummaryError = null
})

async function addItem() {
  if (!newItem.value.name.trim()) return

  try {
    await store.addItem({ ...newItem.value })
    newItem.value = { name: '', quantity: 1, unit: '', category: 'other' }
    showAddForm.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to add item')
  }
}

async function handleGenerateFromPlan() {
  if (planner.assignedMealCount === 0) {
    toast.error('Plan some meals for this week before generating the shopping list')
    return
  }

  try {
    const summary = await store.generateFromPlan(planner.currentWeekStart)
    try {
      await store.generateSummary(store.periodWeekStart, true, store.periodFilter)
    } catch {
      // Keep generation success even if AI summary falls back or fails.
    }
    toast.success(`Generated ${summary.createdCount} shopping items from this week's meal plan`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to generate shopping list')
  }
}

async function handleGenerateSummary() {
  try {
    await store.generateSummary(store.periodWeekStart, true, store.periodFilter)
    toast.success('Shopping summary updated')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to generate shopping summary')
  }
}

function handleClearAll() {
  if (store.allItemCount === 0) {
    return
  }

  ui.showConfirm({
    title: 'Clear shopping list?',
    description: 'This will remove every shopping item, including generated and completed items.',
    confirmLabel: 'Remove all',
    variant: 'destructive',
    onConfirm: async () => {
      try {
        await store.clearAll()
        toast.success('Shopping list cleared')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to clear shopping list')
      }
    },
  })
}

function getActivePeriodLabel() {
  return periodOptions.find(option => option.value === store.periodFilter)?.label || 'All'
}

function buildShareText() {
  const lines = [
    `MealSync Shopping List (${getActivePeriodLabel()})`,
    '',
  ]

  const remaining = exportItems.value.filter(item => !item.checked)
  const completed = exportItems.value.filter(item => item.checked)

  if (remaining.length > 0) {
    lines.push('To buy:')
    for (const item of remaining) {
      lines.push(`- ${item.quantity} ${item.unit}`.trimEnd() + ` ${item.name}`.replace(/\s+/g, ' ').trim())
    }
    lines.push('')
  }

  if (completed.length > 0) {
    lines.push('Completed:')
    for (const item of completed) {
      lines.push(`- ${item.quantity} ${item.unit}`.trimEnd() + ` ${item.name}`.replace(/\s+/g, ' ').trim())
    }
  }

  return lines.join('\n').trim()
}

async function handleCopyList() {
  if (exportItems.value.length === 0) {
    toast('No shopping items match the current filters')
    return
  }

  try {
    await navigator.clipboard.writeText(buildShareText())
    toast.success('Shopping list copied')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to copy shopping list')
  }
}

async function handleShareList() {
  if (exportItems.value.length === 0) {
    toast('No shopping items match the current filters')
    return
  }

  if (!('share' in navigator)) {
    await handleCopyList()
    return
  }

  try {
    await navigator.share({
      title: `MealSync Shopping List - ${getActivePeriodLabel()}`,
      text: buildShareText(),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return
    }

    toast.error(error instanceof Error ? error.message : 'Failed to share shopping list')
  }
}

function handleDownloadCsv() {
  if (exportItems.value.length === 0) {
    toast('No shopping items match the current filters')
    return
  }

  const rows = [
    ['Status', 'Category', 'Name', 'Quantity', 'Unit', 'Source'],
    ...exportItems.value.map(item => [
      item.checked ? 'Completed' : 'Open',
      CATEGORY_LABELS[item.category],
      item.name,
      String(item.quantity),
      item.unit,
      item.sourceRecipeName || '',
    ]),
  ]

  const csv = rows
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mealsync-shopping-${store.periodFilter}.csv`
  link.click()
  URL.revokeObjectURL(url)
  toast.success('Shopping list exported')
}
</script>

<template>
  <div class="mb-6">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 class="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Shopping List</h1>
        <p class="mt-1 text-base text-muted-foreground">{{ store.remainingItems }} items remaining in {{ periodOptions.find(option => option.value === store.periodFilter)?.label.toLowerCase() }}</p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          variant="outline"
          class="press-scale shrink-0"
          :disabled="planner.loading || planner.assignedMealCount === 0"
          @click="handleGenerateFromPlan"
        >
          <Sparkles class="mr-1.5 h-4 w-4" /> Generate From Plan
        </Button>
        <Button
          variant="outline"
          class="press-scale shrink-0"
          :disabled="store.aiSummaryLoading || store.totalItems === 0"
          @click="handleGenerateSummary"
        >
          <Loader2 v-if="store.aiSummaryLoading" class="mr-1.5 h-4 w-4 animate-spin" />
          <Sparkles v-else class="mr-1.5 h-4 w-4" /> AI Summary
        </Button>
        <Button variant="outline" class="press-scale shrink-0" :disabled="exportItems.length === 0" @click="handleCopyList">
          <Copy class="mr-1.5 h-4 w-4" /> Copy
        </Button>
        <Button variant="outline" class="press-scale shrink-0" :disabled="exportItems.length === 0" @click="handleShareList">
          <Share2 class="mr-1.5 h-4 w-4" /> Share
        </Button>
        <Button variant="outline" class="press-scale shrink-0" :disabled="exportItems.length === 0" @click="handleDownloadCsv">
          <Download class="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
        <Button @click="showAddForm = !showAddForm" class="shadow-md shadow-primary/10 press-scale shrink-0">
          <Plus class="mr-1.5 h-4 w-4" /> Add Item
        </Button>
        <Button
          variant="outline"
          class="border-destructive/20 text-destructive hover:bg-destructive/5 press-scale shrink-0"
          :disabled="store.allItemCount === 0"
          @click="handleClearAll"
        >
          <Trash2 class="mr-1.5 h-4 w-4" /> Remove All
        </Button>
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div
        v-if="!isOnline"
        class="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/8 p-3.5"
      >
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 shrink-0">
          <WifiOff class="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p class="text-sm font-semibold text-amber-700">You&apos;re offline</p>
          <p class="text-xs text-amber-600/70">Changes will sync when you reconnect</p>
        </div>
      </div>
    </Transition>
  </div>

  <div class="surface-card mb-6 p-5">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShoppingCart class="h-5 w-5 text-primary" />
        </div>
        <div>
          <span class="text-3xl font-extrabold tracking-tight text-primary">{{ store.progress }}%</span>
          <span class="ml-1.5 text-sm text-muted-foreground">complete</span>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <StatusBadge :status="isOnline ? syncService.status.value : 'disconnected'" show-label />
        <span v-if="store.pendingSyncCount > 0" class="font-semibold text-amber-600">
          {{ store.pendingSyncCount }} pending
        </span>
      </div>
    </div>
    <Progress :model-value="store.progress" class="h-2.5 rounded-full" />
    <p class="mt-2.5 text-xs text-muted-foreground">
      {{ store.checkedItems.length }} checked · {{ store.remainingItems }} remaining · {{ store.totalItems }} total
    </p>
  </div>

  <div class="surface-card mb-6 border-primary/10 p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles class="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 class="text-base font-bold tracking-tight text-foreground">Auto Shopping Generation</h2>
            <p class="text-sm text-muted-foreground">
              Build this week&apos;s list from {{ planner.assignedMealCount }} planned meals and subtract pantry stock automatically.
            </p>
          </div>
        </div>

        <div v-if="store.lastGenerationSummary" class="mt-4 flex flex-wrap gap-2">
          <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Week of {{ formatDateShort(store.lastGenerationSummary.weekStart) }}
          </span>
          <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {{ store.lastGenerationSummary.createdCount }} items created
          </span>
          <span class="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {{ store.lastGenerationSummary.mergedIngredientCount }} duplicates merged
          </span>
          <span class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700">
            {{ store.lastGenerationSummary.pantryCoveredCount }} covered by pantry
          </span>
        </div>
      </div>

      <Button
        class="shadow-md shadow-primary/10 press-scale shrink-0"
        :disabled="planner.loading || planner.assignedMealCount === 0"
        @click="handleGenerateFromPlan"
      >
        <Sparkles class="mr-1.5 h-4 w-4" /> Regenerate
      </Button>
    </div>
  </div>

  <div v-if="visibleAiSummary || store.aiSummaryError" class="surface-card mb-6 p-5">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles class="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 class="text-base font-bold tracking-tight text-foreground">Shopping Summary</h2>
            <p class="text-sm text-muted-foreground">
              Short AI summary and alerts for the current list.
            </p>
          </div>
        </div>

        <div v-if="visibleAiSummary" class="mt-4 space-y-4">
          <div>
            <p class="text-sm font-semibold text-primary">{{ visibleAiSummary.headline }}</p>
            <p class="mt-2 text-sm leading-relaxed text-foreground">{{ visibleAiSummary.summary }}</p>
          </div>

          <div v-if="visibleAiSummary.alerts.length" class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alerts</p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="alert in visibleAiSummary.alerts"
                :key="alert"
                class="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700"
              >
                <AlertTriangle class="h-3 w-3" />
                {{ alert }}
              </span>
            </div>
          </div>

          <div v-if="visibleAiSummary.focus.length" class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Focus</p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="focus in visibleAiSummary.focus"
                :key="focus"
                class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700"
              >
                {{ focus }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-else
          class="mt-4 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground"
        >
          {{ store.aiSummaryError }}
        </div>
      </div>

      <Button
        variant="outline"
        class="press-scale shrink-0"
        :disabled="store.aiSummaryLoading || store.totalItems === 0"
        @click="handleGenerateSummary"
      >
        <Loader2 v-if="store.aiSummaryLoading" class="mr-1.5 h-4 w-4 animate-spin" />
        <Sparkles v-else class="mr-1.5 h-4 w-4" /> Refresh
      </Button>
    </div>
  </div>

  <div class="sticky top-16 z-20 -mx-5 bg-background/95 px-5 pb-3 pt-1 backdrop-blur-lg lg:-mx-10 lg:px-10">
    <div class="mb-3 flex flex-wrap gap-2">
      <button
        v-for="option in periodOptions"
        :key="option.value"
        class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
        :class="store.periodFilter === option.value
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary'"
        @click="store.periodFilter = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="flex gap-2.5">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          v-model="store.searchQuery"
          placeholder="Search items..."
          class="h-11 rounded-xl pl-10"
          :style="{ borderRadius: '0.75rem' }"
        />
        <button
          v-if="store.searchQuery"
          @click="store.searchQuery = ''"
          class="absolute right-3 top-1/2 rounded-lg p-1 -translate-y-1/2 hover:bg-muted"
        >
          <X class="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <select
        v-model="store.filterCategory"
        class="hidden h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring sm:block"
      >
        <option :value="null">All</option>
        <option v-for="cat in SHOPPING_CATEGORIES" :key="cat" :value="cat">
          {{ CATEGORY_EMOJI[cat] }} {{ CATEGORY_LABELS[cat] }}
        </option>
      </select>
    </div>
  </div>

  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div v-if="showAddForm" class="surface-card mb-5 p-5">
      <h3 class="mb-3 text-sm font-bold text-foreground">Add new item</h3>
      <form @submit.prevent="addItem" class="space-y-3">
        <div class="flex flex-col gap-3 sm:flex-row">
          <Input v-model="newItem.name" placeholder="Item name" class="h-11 flex-1" required />
          <div class="flex gap-2">
            <Input v-model.number="newItem.quantity" type="number" min="1" placeholder="Qty" class="h-11 w-20" />
            <Input v-model="newItem.unit" placeholder="Unit" class="h-11 w-24" />
          </div>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <select v-model="newItem.category" class="h-11 rounded-xl border border-border bg-card px-3 text-sm sm:w-44">
            <option v-for="cat in SHOPPING_CATEGORIES" :key="cat" :value="cat">
              {{ CATEGORY_EMOJI[cat] }} {{ CATEGORY_LABELS[cat] }}
            </option>
          </select>
          <div class="flex gap-2 sm:ml-auto">
            <Button type="submit" :disabled="!newItem.name.trim()" class="press-scale flex-1 sm:flex-initial">
              <Plus class="mr-1 h-4 w-4" /> Add
            </Button>
            <Button type="button" variant="outline" @click="showAddForm = false">Cancel</Button>
          </div>
        </div>
      </form>
    </div>
  </Transition>

  <div v-if="store.loading && store.items.length === 0" class="space-y-3">
    <AppSkeleton v-for="i in 8" :key="i" class="h-16" />
  </div>

  <AppEmptyState
    v-else-if="store.allItemCount === 0"
    icon="🛒"
    title="Your shopping list is empty"
    description="Add items manually or let MealSync auto-generate from your weekly meal plan. It even subtracts pantry stock!"
    action-label="Add Item"
    secondary-action-label="Generate from Plan"
    @action="showAddForm = true"
    @secondary-action="handleGenerateFromPlan"
  />

  <div v-else-if="hasItemsOutsideCurrentPeriod" class="surface-card p-6 text-center">
    <h3 class="text-lg font-bold tracking-tight text-foreground">No items in this period</h3>
    <p class="mt-2 text-sm text-muted-foreground">
      The shopping list has saved items, but none match {{ periodOptions.find(option => option.value === store.periodFilter)?.label.toLowerCase() }}.
    </p>
    <Button class="mt-4" variant="outline" @click="store.periodFilter = 'all'">
      Show All Items
    </Button>
  </div>

  <template v-else>
    <div class="space-y-5">
      <div v-for="[category, items] in store.itemsByCategory" :key="category">
        <div class="sticky top-[7.5rem] z-10 -mx-5 mb-2 flex items-center gap-2.5 bg-background/95 px-5 py-2 backdrop-blur-lg lg:-mx-10 lg:px-10">
          <span class="text-lg">{{ CATEGORY_EMOJI[category] }}</span>
          <h3 class="text-sm font-bold tracking-tight text-foreground">{{ CATEGORY_LABELS[category] }}</h3>
          <span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{{ items.length }}</span>
        </div>
        <div class="surface-card overflow-hidden divide-y divide-border/50">
          <ShoppingListItemRow
            v-for="item in items"
            :key="item.id"
            :item="item"
            @toggle="store.toggleItem(item.id)"
            @remove="store.removeItem(item.id)"
          />
        </div>
      </div>
    </div>

    <div v-if="store.checkedItems.length > 0" class="mt-8">
      <button
        @click="showCompleted = !showCompleted"
        class="tap-target mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <component :is="showCompleted ? ChevronDown : ChevronRight" class="h-4 w-4" />
        Completed ({{ store.checkedItems.length }})
      </button>

      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showCompleted">
          <div class="surface-card mb-3 overflow-hidden divide-y divide-border/50">
            <ShoppingListItemRow
              v-for="item in store.checkedItems"
              :key="item.id"
              :item="item"
              @toggle="store.toggleItem(item.id)"
              @remove="store.removeItem(item.id)"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            class="border-destructive/20 text-destructive hover:bg-destructive/5"
            @click="store.clearChecked(store.periodWeekStart)"
          >
            <Trash2 class="mr-1.5 h-3.5 w-3.5" /> Clear completed
          </Button>
        </div>
      </Transition>
    </div>
  </template>
</template>
