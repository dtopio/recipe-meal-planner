<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useShoppingStore } from '@/stores/shopping'
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
import type { AddShoppingItemDTO } from '@/types'
import {
  Plus, Search, X, Trash2, WifiOff, ChevronDown, ChevronRight,
  ShoppingCart, Sparkles,
} from 'lucide-vue-next'

const store = useShoppingStore()
const { isOnline } = useOnline()

const showAddForm = ref(false)
const showCompleted = ref(false)
const newItem = ref<AddShoppingItemDTO>({
  name: '',
  quantity: 1,
  unit: '',
  category: 'other',
})

onMounted(async () => {
  await store.loadItems()
  syncService.connect()
})

function addItem() {
  if (!newItem.value.name.trim()) return
  store.addItem({ ...newItem.value })
  newItem.value = { name: '', quantity: 1, unit: '', category: 'other' }
  showAddForm.value = false
}
</script>

<template>
  <!-- Header with large progress -->
  <div class="mb-6">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">Shopping List</h1>
        <p class="text-base text-muted-foreground mt-1">{{ store.remainingItems }} items remaining</p>
      </div>
      <Button @click="showAddForm = !showAddForm" class="shadow-md shadow-primary/10 press-scale shrink-0">
        <Plus class="w-4 h-4 mr-1.5" /> Add Item
      </Button>
    </div>

    <!-- Offline banner -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
    >
      <div v-if="!isOnline" class="mb-4 p-3.5 rounded-xl bg-amber-500/8 border border-amber-500/15 flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
          <WifiOff class="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p class="text-sm font-semibold text-amber-700">You're offline</p>
          <p class="text-xs text-amber-600/70">Changes will sync when you reconnect</p>
        </div>
      </div>
    </Transition>
  </div>

  <!-- Progress hero — big, scannable, tap-friendly -->
  <div class="surface-card p-5 mb-6">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingCart class="w-5 h-5 text-primary" />
        </div>
        <div>
          <span class="text-3xl font-extrabold text-primary tracking-tight">{{ store.progress }}%</span>
          <span class="text-sm text-muted-foreground ml-1.5">complete</span>
        </div>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <StatusBadge :status="isOnline ? syncService.status.value : 'disconnected'" show-label />
        <span v-if="store.pendingSyncCount > 0" class="text-amber-600 font-semibold">
          {{ store.pendingSyncCount }} pending
        </span>
      </div>
    </div>
    <Progress :model-value="store.progress" class="h-2.5 rounded-full" />
    <p class="text-xs text-muted-foreground mt-2.5">
      {{ store.checkedItems.length }} checked · {{ store.remainingItems }} remaining · {{ store.totalItems }} total
    </p>
  </div>

  <!-- Search & filter — sticky on mobile for grocery store use -->
  <div class="sticky top-16 z-20 bg-background/95 backdrop-blur-lg pb-3 -mx-5 px-5 lg:-mx-10 lg:px-10 pt-1">
    <div class="flex gap-2.5">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          v-model="store.searchQuery"
          placeholder="Search items..."
          class="pl-10 h-11 rounded-xl"
          :style="{ borderRadius: '0.75rem' }"
        />
        <button v-if="store.searchQuery" @click="store.searchQuery = ''" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-muted">
          <X class="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <select
        v-model="store.filterCategory"
        class="h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring hidden sm:block"
      >
        <option :value="null">All</option>
        <option v-for="cat in SHOPPING_CATEGORIES" :key="cat" :value="cat">
          {{ CATEGORY_EMOJI[cat] }} {{ CATEGORY_LABELS[cat] }}
        </option>
      </select>
    </div>
  </div>

  <!-- Add item form -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div v-if="showAddForm" class="mb-5 surface-card p-5">
      <h3 class="text-sm font-bold text-foreground mb-3">Add new item</h3>
      <form @submit.prevent="addItem" class="space-y-3">
        <div class="flex flex-col sm:flex-row gap-3">
          <Input v-model="newItem.name" placeholder="Item name" class="flex-1 h-11" required />
          <div class="flex gap-2">
            <Input v-model.number="newItem.quantity" type="number" min="1" placeholder="Qty" class="w-20 h-11" />
            <Input v-model="newItem.unit" placeholder="Unit" class="w-24 h-11" />
          </div>
        </div>
        <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <select v-model="newItem.category" class="h-11 rounded-xl border border-border bg-card px-3 text-sm sm:w-44">
            <option v-for="cat in SHOPPING_CATEGORIES" :key="cat" :value="cat">{{ CATEGORY_EMOJI[cat] }} {{ CATEGORY_LABELS[cat] }}</option>
          </select>
          <div class="flex gap-2 sm:ml-auto">
            <Button type="submit" :disabled="!newItem.name.trim()" class="press-scale flex-1 sm:flex-initial">
              <Plus class="w-4 h-4 mr-1" /> Add
            </Button>
            <Button type="button" variant="outline" @click="showAddForm = false">Cancel</Button>
          </div>
        </div>
      </form>
    </div>
  </Transition>

  <!-- Loading -->
  <div v-if="store.loading && store.items.length === 0" class="space-y-3">
    <AppSkeleton v-for="i in 8" :key="i" class="h-16" />
  </div>

  <!-- Empty state -->
  <AppEmptyState
    v-else-if="store.items.length === 0"
    title="Shopping list is empty"
    description="Add items manually or add recipe ingredients from a recipe page."
    action-label="Add Item"
    @action="showAddForm = true"
  />

  <template v-else>
    <!-- Grouped items by category — optimized for one-hand grocery store use -->
    <div class="space-y-5">
      <div v-for="[category, items] in store.itemsByCategory" :key="category">
        <!-- Sticky category header -->
        <div class="flex items-center gap-2.5 mb-2 sticky top-[7.5rem] bg-background/95 backdrop-blur-lg z-10 py-2 -mx-5 px-5 lg:-mx-10 lg:px-10">
          <span class="text-lg">{{ CATEGORY_EMOJI[category] }}</span>
          <h3 class="text-sm font-bold text-foreground tracking-tight">{{ CATEGORY_LABELS[category] }}</h3>
          <span class="text-xs text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">{{ items.length }}</span>
        </div>
        <!-- Item list — large touch targets, clear typography -->
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

    <!-- Completed items section -->
    <div v-if="store.checkedItems.length > 0" class="mt-8">
      <button
        @click="showCompleted = !showCompleted"
        class="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors mb-3 tap-target"
      >
        <component :is="showCompleted ? ChevronDown : ChevronRight" class="w-4 h-4" />
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
          <div class="surface-card overflow-hidden divide-y divide-border/50 mb-3">
            <ShoppingListItemRow
              v-for="item in store.checkedItems"
              :key="item.id"
              :item="item"
              @toggle="store.toggleItem(item.id)"
              @remove="store.removeItem(item.id)"
            />
          </div>
          <Button variant="outline" size="sm" class="text-destructive border-destructive/20 hover:bg-destructive/5" @click="store.clearChecked()">
            <Trash2 class="w-3.5 h-3.5 mr-1.5" /> Clear completed
          </Button>
        </div>
      </Transition>
    </div>
  </template>
</template>
