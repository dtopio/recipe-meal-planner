<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/layout/PageHeader.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check, RefreshCw, LogOut, ShieldPlus, ShieldMinus, User, Crown, UserMinus, Pencil, Trash2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const router = useRouter()
const household = useHouseholdStore()
const auth = useAuthStore()
const ui = useUiStore()

const copied = ref(false)
const editingName = ref(false)
const householdName = ref('')

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

function startEditName() {
  householdName.value = household.household?.name || ''
  editingName.value = true
}

async function saveHouseholdName() {
  if (!householdName.value.trim()) return
  try {
    await household.updateHousehold({ name: householdName.value.trim() })
    editingName.value = false
    toast.success('Household renamed')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to rename')
  }
}

async function handleRegenerateInvite() {
  try {
    await household.regenerateInvite()
    toast.success('Invite code regenerated')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to regenerate invite code')
  }
}

function handleKick(member: { id: string; displayName: string }) {
  ui.showConfirm({
    title: `Remove ${member.displayName}?`,
    description: `${member.displayName} will lose access to all shared recipes, meal plans, and shopping lists.`,
    confirmLabel: 'Remove',
    variant: 'destructive',
    onConfirm: async () => {
      await household.kickMember(member.id)
      toast.success(`${member.displayName} has been removed`)
    },
  })
}

function handleDeleteHousehold() {
  ui.showConfirm({
    title: 'Delete this household?',
    description: 'This will permanently delete the household and ALL shared data — recipes, meal plans, shopping lists, and pantry items. Every member will be removed. This cannot be undone.',
    confirmLabel: 'Delete household',
    variant: 'destructive',
    onConfirm: async () => {
      await household.deleteHousehold()
      router.push('/onboarding')
    },
  })
}

function handleRoleChange(member: { id: string; displayName: string; role: string }) {
  const newRole = member.role === 'admin' ? 'member' : 'admin'
  const action = newRole === 'admin' ? 'Promote' : 'Demote'

  ui.showConfirm({
    title: `${action} ${member.displayName}?`,
    description: newRole === 'admin'
      ? `${member.displayName} will be able to manage members, invite codes, and household preferences.`
      : `${member.displayName} will no longer be able to manage the household.`,
    confirmLabel: action,
    variant: newRole === 'member' ? 'destructive' : 'default',
    onConfirm: async () => {
      await household.updateMemberRole(member.id, newRole)
    },
  })
}

function handleLeave() {
  ui.showConfirm({
    title: 'Leave household?',
    description: 'You will lose access to shared recipes, meal plans, and shopping lists. This action cannot be undone.',
    confirmLabel: 'Leave',
    variant: 'destructive',
    onConfirm: async () => {
      await household.leaveHousehold()
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
            <div class="flex-1 min-w-0">
              <template v-if="editingName">
                <div class="flex items-center gap-2">
                  <Input v-model="householdName" class="h-9 text-base font-bold" @keydown.enter="saveHouseholdName" />
                  <Button size="sm" @click="saveHouseholdName" :disabled="!householdName.trim()">Save</Button>
                  <Button size="sm" variant="ghost" @click="editingName = false">Cancel</Button>
                </div>
              </template>
              <template v-else>
                <div class="flex items-center gap-2">
                  <h2 class="text-xl font-bold text-foreground tracking-tight">{{ household.household.name }}</h2>
                  <button v-if="household.isAdmin" type="button" @click="startEditName" class="p-1 rounded-lg hover:bg-muted transition-colors" title="Rename household">
                    <Pencil class="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </template>
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
              <div v-if="household.isAdmin && member.userId !== auth.user?.id" class="flex items-center gap-1">
                <button
                  type="button"
                  @click="handleRoleChange(member)"
                  class="p-1.5 rounded-lg hover:bg-muted transition-colors tap-target"
                  :title="member.role === 'admin' ? 'Demote to member' : 'Promote to admin'"
                >
                  <ShieldMinus v-if="member.role === 'admin'" class="w-4 h-4 text-muted-foreground hover:text-destructive" />
                  <ShieldPlus v-else class="w-4 h-4 text-muted-foreground hover:text-primary" />
                </button>
                <button
                  type="button"
                  @click="handleKick(member)"
                  class="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors tap-target"
                  title="Remove from household"
                >
                  <UserMinus class="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
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
            <button type="button" @click="copyCode" class="p-2 rounded-lg hover:bg-background transition-colors tap-target press-scale">
              <Check v-if="copied" class="w-4 h-4 text-emerald-500" />
              <Copy v-else class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <Button variant="outline" size="sm" class="w-full" @click="handleRegenerateInvite" :disabled="household.loading || !household.isAdmin">
            <RefreshCw class="w-3.5 h-3.5 mr-1.5" /> Regenerate Code
          </Button>
        </div>

        <!-- Danger zone -->
        <div class="bg-card border border-destructive/20 rounded-2xl shadow-sm p-5">
          <h3 class="font-bold text-destructive tracking-tight mb-3">Danger Zone</h3>
          <div class="space-y-3">
            <div>
              <p class="text-xs text-muted-foreground mb-2">Leave this household. You will lose access to all shared data.</p>
              <Button variant="outline" class="w-full text-destructive border-destructive/30 hover:bg-destructive/10" @click="handleLeave">
                <LogOut class="w-4 h-4 mr-1.5" /> Leave Household
              </Button>
            </div>
            <div v-if="household.isAdmin">
              <p class="text-xs text-muted-foreground mb-2">Permanently delete this household and all its data for everyone.</p>
              <Button variant="outline" class="w-full text-destructive border-destructive/30 hover:bg-destructive/10" @click="handleDeleteHousehold">
                <Trash2 class="w-4 h-4 mr-1.5" /> Delete Household
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
