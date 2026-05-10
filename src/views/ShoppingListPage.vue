<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useShoppingStore } from '@/stores/shopping'
import { usePlannerStore } from '@/stores/planner'
import { usePantryStore } from '@/stores/pantry'
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
import type { AddShoppingItemDTO, ShoppingCategory, ShoppingListItem, ShoppingPeriod } from '@/types'
import { formatDateShort } from '@/utils/date'
import { ingredientMatchKey } from '@/utils/recipe'
import {
  Archive,
  Plus,
  Search,
  X,
  Trash2,
  Copy,
  Share2,
  Download,
  Printer,
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
const pantry = usePantryStore()
const ui = useUiStore()
const { isOnline } = useOnline()

const showAddForm = ref(false)
const showCompleted = ref(false)
const showPantryImport = ref(false)
const addingCheckedToPantry = ref(false)
const clearImportedShoppingItems = ref(false)
const pantryImportRows = ref<PantryImportRow[]>([])
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
const pantryCoverageByKey = computed(() => {
  const coverage = new Map<string, { quantity: number; unit: string }>()

  for (const item of pantry.items) {
    if (item.quantity <= 0) continue

    const key = ingredientMatchKey(item.name, item.unit)
    const existing = coverage.get(key)

    if (existing) {
      existing.quantity += item.quantity
    } else {
      coverage.set(key, {
        quantity: item.quantity,
        unit: item.unit,
      })
    }
  }

  return coverage
})
const selectedPantryImportRows = computed(() => (
  pantryImportRows.value.filter(row => row.selected && row.name.trim() && Number(row.quantity) > 0)
))

interface PantryImportRow {
  itemId: string
  selected: boolean
  name: string
  quantity: number
  unit: string
  category: ShoppingCategory
  lowStockThreshold: number
  expiresAt: string
}

onMounted(async () => {
  await Promise.all([
    store.loadItems(),
    planner.loadWeekPlan(),
    pantry.loadItems().catch(() => undefined),
  ])
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

async function handleRemoveItem(itemId: string) {
  try {
    await store.removeItem(itemId)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to remove shopping item')
  }
}

async function handleClearCompleted() {
  try {
    await store.clearChecked(store.periodWeekStart)
    toast.success('Completed items cleared')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to clear completed items')
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
      lines.push(formatShareItemLine(item))
    }
    lines.push('')
  }

  if (completed.length > 0) {
    lines.push('Completed:')
    for (const item of completed) {
      lines.push(formatShareItemLine(item))
    }
  }

  return lines.join('\n').trim()
}

function formatShareItemLine(item: ShoppingListItem) {
  const base = `- ${item.quantity} ${item.unit}`.trimEnd() + ` ${item.name}`.replace(/\s+/g, ' ').trim()
  return item.sourceRecipeName ? `${base} (for ${item.sourceRecipeName})` : base
}

function getPantryCoverageLabel(item: ShoppingListItem) {
  const coverage = pantryCoverageByKey.value.get(ingredientMatchKey(item.name, item.unit))
  if (!coverage) return ''

  return `In pantry: ${formatCompactQuantity(coverage.quantity)} ${coverage.unit || 'units'}`
}

function openPantryImportPanel() {
  if (store.checkedItems.length === 0) {
    toast('Check off shopping items before adding them to pantry')
    return
  }

  pantryImportRows.value = store.checkedItems.map(item => ({
    itemId: item.id,
    selected: true,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    lowStockThreshold: 1,
    expiresAt: '',
  }))
  clearImportedShoppingItems.value = false
  showPantryImport.value = true
}

function closePantryImportPanel() {
  showPantryImport.value = false
  pantryImportRows.value = []
  clearImportedShoppingItems.value = false
}

async function handleAddCheckedToPantry() {
  const rows = selectedPantryImportRows.value

  if (rows.length === 0) {
    toast('Select at least one valid item to add to pantry')
    return
  }

  addingCheckedToPantry.value = true

  try {
    await pantry.loadItems()

    let addedCount = 0
    let updatedCount = 0

    for (const row of rows) {
      const name = row.name.trim()
      const unit = row.unit.trim()
      const quantity = Number(row.quantity)
      const existing = pantry.items.find(item => ingredientMatchKey(item.name, item.unit) === ingredientMatchKey(name, unit))

      if (existing) {
        await pantry.updateItem({
          id: existing.id,
          quantity: Number((existing.quantity + quantity).toFixed(2)),
        })
        updatedCount += 1
      } else {
        await pantry.addItem({
          name,
          quantity,
          unit,
          category: row.category,
          lowStockThreshold: Math.max(0, Number(row.lowStockThreshold) || 1),
          expiresAt: row.expiresAt || undefined,
        })
        addedCount += 1
      }
    }

    if (clearImportedShoppingItems.value) {
      for (const row of rows) {
        await store.removeItem(row.itemId)
      }
    }

    closePantryImportPanel()
    toast.success(`Pantry updated: ${addedCount} added, ${updatedCount} updated`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to add checked items to pantry')
  } finally {
    addingCheckedToPantry.value = false
  }
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
    ['Status', 'Category', 'Name', 'Quantity', 'Unit', 'For'],
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

function handlePrintList() {
  if (exportItems.value.length === 0) {
    toast('No shopping items match the current filters')
    return
  }

  const printWindow = window.open('', '_blank', 'width=760,height=900')
  if (!printWindow) {
    toast.error('Could not open print window')
    return
  }

  printWindow.document.write(buildPrintHtml())
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}

function buildPrintHtml() {
  const grouped = new Map<string, ShoppingListItem[]>()

  for (const item of exportItems.value) {
    const label = CATEGORY_LABELS[item.category]
    grouped.set(label, [...(grouped.get(label) || []), item])
  }

  const sections = Array.from(grouped.entries()).map(([label, items]) => `
    <section>
      <h2>${escapeHtml(label)}</h2>
      <ul>
        ${items.map(item => `
          <li class="${item.checked ? 'checked' : ''}">
            <span class="box">${item.checked ? 'x' : ''}</span>
            <span>
              <span class="name">${escapeHtml(item.name)}</span>
              ${item.sourceRecipeName ? `<span class="source">For: ${escapeHtml(item.sourceRecipeName)}</span>` : ''}
            </span>
            <span class="qty">${escapeHtml(formatExportQuantity(item.quantity, item.unit))}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `).join('')

  return `<!doctype html>
    <html>
      <head>
        <title>MealSync Shopping List</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Inter, Arial, sans-serif; color: #111827; margin: 32px; }
          header { border-bottom: 2px solid #111827; margin-bottom: 24px; padding-bottom: 16px; }
          h1 { font-size: 28px; line-height: 1.1; margin: 0; }
          p { color: #4b5563; margin: 8px 0 0; }
          section { break-inside: avoid; margin-bottom: 24px; }
          h2 { font-size: 14px; letter-spacing: .08em; margin: 0 0 8px; text-transform: uppercase; }
          ul { border-top: 1px solid #d1d5db; list-style: none; margin: 0; padding: 0; }
          li { align-items: center; border-bottom: 1px solid #e5e7eb; display: grid; gap: 10px; grid-template-columns: 24px 1fr auto; min-height: 36px; padding: 8px 0; }
          .box { border: 1px solid #6b7280; display: inline-flex; height: 18px; justify-content: center; line-height: 16px; width: 18px; }
          .checked { color: #6b7280; text-decoration: line-through; }
          .name { font-weight: 700; }
          .source { color: #4b5563; display: block; font-size: 11px; margin-top: 2px; }
          .qty { color: #4b5563; font-size: 13px; }
        </style>
      </head>
      <body>
        <header>
          <h1>MealSync Shopping List</h1>
          <p>${escapeHtml(getActivePeriodLabel())} / ${exportItems.value.length} item${exportItems.value.length === 1 ? '' : 's'}</p>
        </header>
        ${sections}
      </body>
    </html>`
}

function formatExportQuantity(quantity: number, unit: string) {
  return `${quantity} ${unit}`.trim()
}

function formatCompactQuantity(value: number) {
  return Number(value.toFixed(2)).toString()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
        <Button variant="outline" class="press-scale shrink-0" :disabled="exportItems.length === 0" @click="handlePrintList">
          <Printer class="mr-1.5 h-4 w-4" /> Print
        </Button>
        <Button @click="showAddForm = !showAddForm" class="shadow-md shadow-primary/10 press-scale shrink-0">
          <Plus class="mr-1.5 h-4 w-4" /> Add Item
        </Button>
        <Button
          variant="outline"
          class="press-scale shrink-0"
          :disabled="store.checkedItems.length === 0"
          @click="openPantryImportPanel"
        >
          <Archive class="mr-1.5 h-4 w-4" /> Add Checked to Pantry
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
        type="button"
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
          type="button"
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

  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div v-if="showPantryImport" class="surface-card mb-5 p-5">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-sm font-bold text-foreground">Add checked items to pantry</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            Review what gets saved. Matching pantry items with the same name and unit will be updated.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" class="shrink-0" @click="closePantryImportPanel">
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div class="overflow-hidden rounded-xl border border-border/60">
        <div
          v-for="row in pantryImportRows"
          :key="row.itemId"
          class="grid gap-3 border-b border-border/50 p-3 last:border-b-0 md:grid-cols-[auto_1fr_96px_104px_152px_120px_148px]"
        >
          <label class="flex items-center gap-2 text-sm font-medium text-foreground md:pt-2">
            <input v-model="row.selected" type="checkbox" class="h-4 w-4 rounded border-border" />
            <span class="md:hidden">Add</span>
          </label>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Item</label>
            <Input v-model="row.name" class="h-10" />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Qty</label>
            <Input v-model.number="row.quantity" type="number" min="0.01" step="0.01" class="h-10" />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Unit</label>
            <Input v-model="row.unit" class="h-10" />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</label>
            <select v-model="row.category" class="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm">
              <option v-for="cat in SHOPPING_CATEGORIES" :key="cat" :value="cat">
                {{ CATEGORY_EMOJI[cat] }} {{ CATEGORY_LABELS[cat] }}
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Low stock</label>
            <Input v-model.number="row.lowStockThreshold" type="number" min="0" step="0.5" class="h-10" />
          </div>

          <div class="space-y-1">
            <label class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expires</label>
            <Input v-model="row.expiresAt" type="date" class="h-10" />
          </div>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <input v-model="clearImportedShoppingItems" type="checkbox" class="h-4 w-4 rounded border-border" />
          Remove imported items from shopping
        </label>

        <div class="flex gap-2">
          <Button type="button" variant="outline" @click="closePantryImportPanel">Cancel</Button>
          <Button
            type="button"
            :disabled="addingCheckedToPantry || selectedPantryImportRows.length === 0"
            @click="handleAddCheckedToPantry"
          >
            <Loader2 v-if="addingCheckedToPantry" class="mr-1.5 h-4 w-4 animate-spin" />
            <Archive v-else class="mr-1.5 h-4 w-4" />
            Add {{ selectedPantryImportRows.length }} to Pantry
          </Button>
        </div>
      </div>
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
              :pantry-coverage-label="getPantryCoverageLabel(item)"
              @toggle="store.toggleItem(item.id)"
              @remove="handleRemoveItem(item.id)"
            />
        </div>
      </div>
    </div>

    <div v-if="store.checkedItems.length > 0" class="mt-8">
      <button
        type="button"
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
              :pantry-coverage-label="getPantryCoverageLabel(item)"
              @toggle="store.toggleItem(item.id)"
              @remove="handleRemoveItem(item.id)"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            class="mr-2"
            @click="openPantryImportPanel"
          >
            <Archive class="mr-1.5 h-3.5 w-3.5" /> Add checked to pantry
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="border-destructive/20 text-destructive hover:bg-destructive/5"
            @click="handleClearCompleted"
          >
            <Trash2 class="mr-1.5 h-3.5 w-3.5" /> Clear completed
          </Button>
        </div>
      </Transition>
    </div>
  </template>
</template>
