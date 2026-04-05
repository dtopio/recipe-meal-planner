<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'

defineProps<{
  title?: string
  message?: string
  retryLabel?: string
}>()

defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div class="w-20 h-20 rounded-2xl bg-destructive/8 flex items-center justify-center mb-5">
      <span class="text-3xl">⚠️</span>
    </div>
    <h3 class="text-lg font-bold text-foreground mb-1.5 tracking-tight">{{ title || 'Something went wrong' }}</h3>
    <p class="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{{ message || 'An unexpected error occurred. Please try again.' }}</p>
    <button
      v-if="retryLabel"
      @click="$emit('retry')"
      class="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-muted transition-all duration-200 shadow-sm press-scale"
    >
      <RotateCcw class="w-4 h-4" />
      {{ retryLabel }}
    </button>
  </div>
</template>
