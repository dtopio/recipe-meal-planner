<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
const household = useHouseholdStore()

const name = ref('')
const selectedColor = ref('#22c55e')
const step = ref<'form' | 'success'>('form')
const copied = ref(false)

const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

const isValid = computed(() => name.value.trim().length >= 2)

async function handleCreate() {
  try {
    await household.createHousehold({ name: name.value.trim(), color: selectedColor.value })
    step.value = 'success'
  } catch {
    // error handled in store
  }
}

async function copyCode() {
  if (household.invite?.code) {
    await navigator.clipboard.writeText(household.invite.code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}
</script>

<template>
  <button @click="router.back()" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
    <ArrowLeft class="w-4 h-4" /> Back
  </button>

  <!-- Form step -->
  <template v-if="step === 'form'">
    <div class="text-center mb-8">
      <h1 class="text-2xl font-bold text-foreground">Create your household</h1>
      <p class="text-sm text-muted-foreground mt-1">Name your household and pick a color</p>
    </div>

    <div class="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <form @submit.prevent="handleCreate" class="space-y-5">
        <div v-if="household.error" class="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {{ household.error }}
        </div>

        <div class="space-y-2">
          <Label for="household-name">Household name</Label>
          <Input id="household-name" v-model="name" placeholder="e.g. The Chen-Park Home" required />
        </div>

        <div class="space-y-2">
          <Label>Color (optional)</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in colors"
              :key="c"
              type="button"
              @click="selectedColor = c"
              class="w-8 h-8 rounded-full border-2 transition-all"
              :class="selectedColor === c ? 'border-foreground scale-110' : 'border-transparent'"
              :style="{ backgroundColor: c }"
              :aria-label="`Select color ${c}`"
            />
          </div>
        </div>

        <!-- Preview -->
        <div class="p-4 rounded-xl bg-muted/50 flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" :style="{ backgroundColor: selectedColor }">
            {{ name.trim().charAt(0)?.toUpperCase() || '?' }}
          </div>
          <div>
            <p class="text-sm font-semibold">{{ name.trim() || 'Your Household' }}</p>
            <p class="text-xs text-muted-foreground">1 member</p>
          </div>
        </div>

        <Button type="submit" class="w-full" :disabled="!isValid || household.loading">
          <Loader2 v-if="household.loading" class="w-4 h-4 mr-2 animate-spin" />
          Create household
        </Button>
      </form>
    </div>
  </template>

  <!-- Success step -->
  <template v-else>
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 mb-4">
        <Check class="w-7 h-7 text-emerald-500" />
      </div>
      <h1 class="text-2xl font-bold text-foreground">Household created!</h1>
      <p class="text-sm text-muted-foreground mt-1">Share the invite code so others can join</p>
    </div>

    <div class="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
      <div class="text-center">
        <p class="text-xs text-muted-foreground mb-2">Invite code</p>
        <div class="inline-flex items-center gap-2 px-4 py-2.5 bg-muted rounded-xl">
          <code class="text-lg font-bold tracking-wider text-foreground">{{ household.invite?.code }}</code>
          <button @click="copyCode" class="p-1.5 rounded-lg hover:bg-background transition-colors" :aria-label="copied ? 'Copied!' : 'Copy code'">
            <Check v-if="copied" class="w-4 h-4 text-emerald-500" />
            <Copy v-else class="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <p class="text-xs text-muted-foreground text-center">
        Share this code with anyone you'd like to invite. They can enter it when they sign up or from their settings.
      </p>

      <Button @click="router.push('/dashboard')" class="w-full">
        Go to dashboard
      </Button>
    </div>
  </template>
</template>
