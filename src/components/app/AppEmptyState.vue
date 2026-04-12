<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  secondaryActionLabel?: string
  compact?: boolean
}>()

defineEmits<{
  action: []
  secondaryAction: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center px-8 text-center" :class="compact ? 'py-10' : 'py-16'">
    <div class="relative mb-6">
      <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-sm ring-1 ring-primary/10">
        <slot name="icon">
          <span class="text-3xl">{{ icon || '📭' }}</span>
        </slot>
      </div>
      <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted flex items-center justify-center ring-2 ring-card">
        <span class="text-xs">✨</span>
      </div>
    </div>
    <h3 class="text-lg font-bold text-foreground mb-1.5 tracking-tight">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{{ description }}</p>
    <div class="flex items-center gap-3 flex-wrap justify-center">
      <slot name="action">
        <button
          type="button"
          v-if="actionLabel"
          @click="$emit('action')"
          class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-md shadow-primary/15 press-scale"
        >
          {{ actionLabel }}
        </button>
      </slot>
      <button
        type="button"
        v-if="secondaryActionLabel"
        @click="$emit('secondaryAction')"
        class="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 press-scale"
      >
        {{ secondaryActionLabel }}
      </button>
    </div>
  </div>
</template>
