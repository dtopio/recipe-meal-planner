<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useHouseholdStore } from '@/stores/household'
import { useUiStore } from '@/stores/ui'
import { useOnline } from '@/composables/useOnline'
import StatusBadge from '@/components/app/StatusBadge.vue'
import { syncService } from '@/services/sync/socket'
import { Menu, Bell, LogOut, User, Settings } from 'lucide-vue-next'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

defineProps<{
  title?: string
}>()

const auth = useAuthStore()
const household = useHouseholdStore()
const ui = useUiStore()
const { isOnline } = useOnline()
const router = useRouter()

const userMenuOpen = ref(false)

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function handleLogout() {
  userMenuOpen.value = false
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-card/85 backdrop-blur-xl shadow-sm">
    <div class="flex items-center h-16 px-5 lg:px-8 gap-4">
      <!-- Mobile hamburger -->
      <button
        @click="ui.toggleSidebar()"
        class="lg:hidden flex items-center justify-center w-11 h-11 -ml-2 rounded-xl hover:bg-muted transition-colors"
        aria-label="Toggle navigation"
      >
        <Menu class="w-5 h-5 text-foreground" />
      </button>

      <!-- Page title -->
      <div class="flex-1 min-w-0">
        <h1 class="text-xl font-bold text-foreground truncate tracking-tight hidden sm:block">{{ title }}</h1>
        <h1 class="text-lg font-semibold text-foreground truncate sm:hidden">{{ title }}</h1>
      </div>

      <!-- Right controls -->
      <div class="flex items-center gap-1.5 sm:gap-3">
        <!-- Connection status — subtle inline -->
        <div class="flex items-center gap-1.5">
          <StatusBadge :status="isOnline ? syncService.status.value : 'disconnected'" :show-label="false" />
          <span v-if="syncService.pendingCount.value > 0" class="text-xs text-amber-600/80 font-medium hidden sm:inline">
            {{ syncService.pendingCount.value }} pending
          </span>
        </div>

        <!-- Household badge (desktop) — warmer styling -->
        <span
          v-if="household.household"
          class="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/[0.07] text-xs font-semibold text-primary"
        >
          🏠 {{ household.household.name }}
        </span>

        <!-- Notifications -->
        <button
          class="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-muted transition-colors relative"
          aria-label="Notifications"
        >
          <Bell class="w-5 h-5 text-muted-foreground" />
          <span class="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full ring-2 ring-card" />
        </button>

        <!-- User menu -->
        <div class="relative">
          <button
            @click="toggleUserMenu"
            class="flex items-center justify-center w-11 h-11 rounded-xl hover:bg-muted transition-colors"
            aria-label="User menu"
          >
            <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
              {{ auth.initials }}
            </div>
          </button>

          <!-- Dropdown -->
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="userMenuOpen"
              class="absolute right-0 mt-2 w-64 rounded-2xl bg-card shadow-xl border border-border/50 py-2 z-50"
            >
              <div class="px-5 py-3.5 border-b border-border/50">
                <p class="text-base font-semibold text-foreground">{{ auth.displayName }}</p>
                <p class="text-sm text-muted-foreground mt-0.5">{{ auth.user?.email }}</p>
              </div>
              <div class="py-1.5">
                <button
                  @click="userMenuOpen = false; router.push('/settings')"
                  class="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium hover:bg-muted transition-colors min-h-[44px]"
                >
                  <Settings class="w-4.5 h-4.5 text-muted-foreground" /> Settings
                </button>
                <button
                  @click="userMenuOpen = false; router.push('/household')"
                  class="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium hover:bg-muted transition-colors min-h-[44px]"
                >
                  <User class="w-4.5 h-4.5 text-muted-foreground" /> Household
                </button>
              </div>
              <div class="border-t border-border/50 pt-1.5">
                <button
                  @click="handleLogout"
                  class="w-full flex items-center gap-3 px-5 py-3 text-sm font-medium text-destructive hover:bg-destructive/[0.06] transition-colors min-h-[44px]"
                >
                  <LogOut class="w-4.5 h-4.5" /> Sign out
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>

  <!-- Click-away for user menu -->
  <div v-if="userMenuOpen" class="fixed inset-0 z-30" @click="userMenuOpen = false" />
</template>
