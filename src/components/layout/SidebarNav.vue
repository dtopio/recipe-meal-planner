<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  BookOpen,
  Home,
  Settings,
} from 'lucide-vue-next'
import { useUiStore } from '@/stores/ui'
import { useHouseholdStore } from '@/stores/household'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const household = useHouseholdStore()

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Planner', path: '/planner', icon: CalendarDays },
  { name: 'Shopping List', path: '/shopping-list', icon: ShoppingCart },
  { name: 'Recipes', path: '/recipes', icon: BookOpen },
  { name: 'Household', path: '/household', icon: Home },
  { name: 'Settings', path: '/settings', icon: Settings },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}

function navigate(path: string) {
  router.push(path)
  ui.closeSidebar()
}
</script>

<template>
  <nav class="flex flex-col h-full" aria-label="Main navigation">
    <!-- Logo area -->
    <div class="p-6 pb-5">
      <div class="flex items-center gap-3.5">
        <div class="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/20">
          <span class="text-white text-xl">🍽</span>
        </div>
        <div class="min-w-0">
          <h1 class="text-base font-bold text-foreground truncate tracking-tight">MealSync</h1>
          <p class="text-xs text-muted-foreground truncate">Meal Planner</p>
        </div>
      </div>
    </div>

    <!-- Household name chip -->
    <div v-if="household.household" class="px-6 pb-4">
      <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary/[0.06] border border-primary/10">
        <span class="text-sm">🏠</span>
        <span class="text-xs font-semibold text-primary truncate">{{ household.household.name }}</span>
      </div>
    </div>

    <!-- Nav links -->
    <div class="flex-1 overflow-y-auto py-2 px-4 space-y-1.5">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="navigate(item.path)"
        class="w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring relative"
        :class="
          isActive(item.path)
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
        "
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <!-- Active left border accent -->
        <span
          v-if="isActive(item.path)"
          class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary"
        />
        <component :is="item.icon" class="w-5 h-5 shrink-0" />
        <span>{{ item.name }}</span>
      </button>
    </div>

    <!-- Footer -->
    <div class="p-4 pt-2">
      <div class="px-3.5 py-2.5 text-[11px] text-muted-foreground/60 font-medium">
        MealSync v0.1.0
      </div>
    </div>
  </nav>
</template>
