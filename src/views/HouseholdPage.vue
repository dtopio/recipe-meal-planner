<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/layout/PageHeader.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Copy, Check, RefreshCw, LogOut, Shield, User, Crown } from 'lucide-vue-next'

const router = useRouter()
const household = useHouseholdStore()
const auth = useAuthStore()
const ui = useUiStore()

const copied = ref(false)

onMounted(async () => {
  if (!household.household) await household.loadHousehold()
})

async function copyCode() {
  if (household.invite?.code) {
    await navigator.clipboard.writeText(household.invite.code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function handleLeave() {
  ui.showConfirm({
    title: 'Leave household?',
    description: 'You will lose access to shared recipes, meal plans, and shopping lists. This action cannot be undone.',
    confirmLabel: 'Leave',
    variant: 'destructive',
    onConfirm: () => {
      household.leaveHousehold()
      router.push('/onboarding')
    },
  })
}
</script>

<template>
  <PageHeader title="Household" description="Manage your household and members" />

  <!-- Loading -->
  <div v-if="household.loading && !household.household" class="space-y-4">
    <AppSkeleton class="h-32" />
    <AppSkeleton class="h-48" />
    <AppSkeleton class="h-40" />
  </div>

  <template v-else-if="household.household">
    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Household info -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Info card -->
        <div class="surface-card p-5 lg:p-6">
          <div class="flex items-center gap-4 mb-6">
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
              :style="{ backgroundColor: household.household.color || '#22c55e' }"
            >
              {{ household.household.name.charAt(0) }}
            </div>
            <div>
              <h2 class="text-xl font-bold text-foreground tracking-tight">{{ household.household.name }}</h2>
              <p class="text-sm text-muted-foreground">{{ household.memberCount }} members · Created {{ new Date(household.household.createdAt).toLocaleDateString() }}</p>
            </div>
          </div>
        </div>

        <!-- Members -->
        <div class="surface-card p-5 lg:p-6">
          <h3 class="font-bold text-foreground tracking-tight mb-4">Members</h3>
          <div class="space-y-3">
            <div
              v-for="member in household.members"
              :key="member.id"
              class="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
            >
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {{ member.displayName.split(' ').map(n => n[0]).join('').toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-medium text-foreground">{{ member.displayName }}</p>
                  <span v-if="member.userId === auth.user?.id" class="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>
                </div>
                <p class="text-xs text-muted-foreground">Joined {{ new Date(member.joinedAt).toLocaleDateString() }}</p>
              </div>
              <span
                class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                :class="member.role === 'admin' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'"
              >
                <Crown v-if="member.role === 'admin'" class="w-3 h-3" />
                <User v-else class="w-3 h-3" />
                {{ member.role === 'admin' ? 'Admin' : 'Member' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="space-y-6">
        <!-- Invite card -->
        <div class="surface-card p-5">
          <h3 class="font-bold text-foreground tracking-tight mb-3">Invite Members</h3>
          <p class="text-xs text-muted-foreground mb-4">Share this code with people you want to invite to your household.</p>

          <div class="flex items-center gap-2 p-3 bg-muted rounded-xl mb-3">
            <code class="flex-1 text-sm font-bold tracking-wider text-foreground text-center">
              {{ household.invite?.code || '—' }}
            </code>
            <button @click="copyCode" class="p-2 rounded-lg hover:bg-background transition-colors tap-target press-scale">
              <Check v-if="copied" class="w-4 h-4 text-emerald-500" />
              <Copy v-else class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <Button variant="outline" size="sm" class="w-full" @click="household.regenerateInvite()" :disabled="household.loading">
            <RefreshCw class="w-3.5 h-3.5 mr-1.5" /> Regenerate Code
          </Button>
        </div>

        <!-- Danger zone -->
        <div class="bg-card border border-destructive/20 rounded-2xl shadow-sm p-5">
          <h3 class="font-bold text-destructive tracking-tight mb-3">Danger Zone</h3>
          <p class="text-xs text-muted-foreground mb-4">Leaving the household will remove your access to all shared data.</p>
          <Button variant="outline" class="w-full text-destructive border-destructive/30 hover:bg-destructive/10" @click="handleLeave">
            <LogOut class="w-4 h-4 mr-1.5" /> Leave Household
          </Button>
        </div>
      </div>
    </div>
  </template>
</template>
