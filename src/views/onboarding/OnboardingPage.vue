<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Home, UserPlus } from 'lucide-vue-next'

const router = useRouter()
</script>

<template>
  <div class="text-center mb-8">
    <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
      <span class="text-2xl">🏠</span>
    </div>
    <h1 class="text-2xl font-bold text-foreground">Set up your household</h1>
    <p class="text-sm text-muted-foreground mt-1">Create a new household or join an existing one</p>
  </div>

  <div class="space-y-4">
    <!-- Create household -->
    <button
      @click="router.push('/onboarding/create-household')"
      class="w-full bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Home class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h3 class="font-semibold text-foreground mb-1">Create a household</h3>
          <p class="text-sm text-muted-foreground">Start fresh. Set up a new household and invite your family or roommates to join.</p>
        </div>
      </div>
    </button>

    <!-- Join household -->
    <button
      @click="router.push('/onboarding/join-household')"
      class="w-full bg-card border border-border rounded-2xl p-6 text-left hover:border-primary/30 hover:shadow-md transition-all group"
    >
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
          <UserPlus class="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 class="font-semibold text-foreground mb-1">Join a household</h3>
          <p class="text-sm text-muted-foreground">Got an invite code? Join an existing household to start planning meals together.</p>
        </div>
      </div>
    </button>
  </div>
</template>
