<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  BookOpen,
  MoreHorizontal,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const navItems = [
  { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Planner', path: '/planner', icon: CalendarDays },
  { name: 'Shop', path: '/shopping-list', icon: ShoppingCart },
  { name: 'Recipes', path: '/recipes', icon: BookOpen },
  { name: 'More', path: '/household', icon: MoreHorizontal },
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl shadow-[0_-1px_3px_rgba(0,0,0,0.05)] lg:hidden safe-bottom"
    aria-label="Mobile navigation"
  >
    <div class="flex items-center h-[72px] px-1">
      <button
        v-for="item in navItems"
        :key="item.path"
        @click="router.push(item.path)"
        class="flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] py-2 rounded-xl transition-colors relative"
        :class="
          isActive(item.path)
            ? 'text-primary'
            : 'text-muted-foreground'
        "
        :aria-current="isActive(item.path) ? 'page' : undefined"
      >
        <component :is="item.icon" class="w-6 h-6" />
        <span class="text-[11px] font-semibold">{{ item.name }}</span>
        <!-- Active dot indicator -->
        <span
          v-if="isActive(item.path)"
          class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
        />
      </button>
    </div>
  </nav>
</template>

<style scoped>
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
