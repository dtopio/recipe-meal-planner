<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import SidebarNav from '@/components/layout/SidebarNav.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/planner': 'Meal Planner',
    '/shopping-list': 'Shopping List',
    '/pantry': 'Pantry',
    '/recipes': 'Recipes',
    '/recipes/new': 'New Recipe',
    '/recipes/import': 'Import Recipe',
    '/household': 'Household',
    '/settings': 'Settings',
  }
  return titles[route.path] || ''
})
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Desktop sidebar -->
    <aside class="fixed top-0 left-0 bottom-0 w-[260px] bg-card shadow-[1px_0_3px_rgba(0,0,0,0.04)] z-40 hidden lg:block">
      <SidebarNav />
    </aside>

    <!-- Mobile sidebar overlay -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="ui.sidebarOpen"
        class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm lg:hidden"
        @click="ui.closeSidebar()"
      />
    </Transition>
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside v-if="ui.sidebarOpen" class="fixed top-0 left-0 bottom-0 w-[280px] bg-card z-50 lg:hidden shadow-2xl">
        <SidebarNav />
      </aside>
    </Transition>

    <!-- Main content -->
    <div class="lg:pl-[260px]">
      <AppHeader :title="pageTitle" />
      <main class="px-5 lg:px-10 xl:px-14 py-8 pb-28 lg:pb-10 max-w-7xl mx-auto">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <BottomNav />

    <!-- Global confirm dialog -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="ui.confirmDialog.open" class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40 backdrop-blur-sm">
          <div class="bg-card rounded-2xl shadow-2xl border border-border/50 max-w-md w-full p-8">
            <h2 class="text-xl font-bold text-foreground mb-2">{{ ui.confirmDialog.title }}</h2>
            <p class="text-sm text-muted-foreground mb-8 leading-relaxed">{{ ui.confirmDialog.description }}</p>
            <div class="flex items-center justify-end gap-3">
              <button
                type="button"
                @click="ui.closeConfirm()"
                class="px-5 min-h-[44px] rounded-xl text-sm font-semibold hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="ui.executeConfirm()"
                class="px-5 min-h-[44px] rounded-xl text-sm font-semibold text-white transition-colors shadow-lg"
                :class="ui.confirmDialog.variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'"
              >
                {{ ui.confirmDialog.confirmLabel || 'Confirm' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
