<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  Archive,
  BookOpen,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navItems = [
  { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Planner', path: '/planner', icon: CalendarDays },
  { name: 'Shop', path: '/shopping-list', icon: ShoppingCart },
  { name: 'Pantry', path: '/pantry', icon: Archive },
  { name: 'Recipes', path: '/recipes', icon: BookOpen },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-xl shadow-[0_-1px_6px_rgba(0,0,0,0.08)] lg:hidden safe-bottom"
    aria-label="Mobile navigation"
  >
    <div class="flex items-center h-[68px] px-2">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="router.push(item.path)"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1.5 rounded-xl transition-all duration-200 relative active:scale-95"
        :class="
          isActive(item.path)
            ? 'text-primary'
            : 'text-muted-foreground/60'
        "
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <!-- Active pill background -->
        <span
          v-if="isActive(item.path)"
          class="absolute inset-x-2 top-0.5 bottom-0.5 rounded-xl bg-primary/8"
        />
        <component :is="item.icon" class="w-5 h-5 relative z-10 transition-transform duration-200" :class="isActive(item.path) ? 'scale-110' : ''" />
        <span class="text-[10px] font-bold relative z-10 tracking-wide" :class="isActive(item.path) ? '' : 'font-semibold'">{{ item.name }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
