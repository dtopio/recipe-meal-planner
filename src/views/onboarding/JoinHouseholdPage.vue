<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
const household = useHouseholdStore()

const inviteCode = ref('')
const isValid = computed(() => inviteCode.value.trim().length >= 4)

async function handleJoin() {
  try {
    await household.joinHousehold({ inviteCode: inviteCode.value.trim() })
    router.push('/dashboard')
  } catch {
    // error handled in store
  }
}
</script>

<template>
  <button @click="router.back()" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
    <ArrowLeft class="w-4 h-4" /> Back
  </button>

  <div class="text-center mb-8">
    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 mb-4">
      <span class="text-2xl">🤝</span>
    </div>
    <h1 class="text-2xl font-bold text-foreground">Join a household</h1>
    <p class="text-sm text-muted-foreground mt-1">Enter the invite code shared by your household admin</p>
  </div>

  <div class="bg-card border border-border rounded-2xl p-6 shadow-sm">
    <form @submit.prevent="handleJoin" class="space-y-5">
      <div v-if="household.error" class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
        {{ household.error }}
      </div>

      <div class="space-y-2">
        <Label for="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          v-model="inviteCode"
          placeholder="e.g. CHEN-PARK-7X2K"
          class="text-center font-mono text-lg tracking-wider"
          required
        />
        <p class="text-xs text-muted-foreground">
          This code was provided by someone in the household you want to join.
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="!isValid || household.loading">
        <Loader2 v-if="household.loading" class="w-4 h-4 mr-2 animate-spin" />
        Join household
      </Button>
    </form>
  </div>
</template>
