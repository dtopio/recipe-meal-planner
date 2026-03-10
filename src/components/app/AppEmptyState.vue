<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-8 text-center">
    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center mb-5 shadow-sm">
      <slot name="icon">
        <span class="text-3xl">📭</span>
      </slot>
    </div>
    <h3 class="text-lg font-bold text-foreground mb-1.5 tracking-tight">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{{ description }}</p>
    <slot name="action">
      <button
        v-if="actionLabel"
        @click="$emit('action')"
        class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-md shadow-primary/15 press-scale"
      >
        {{ actionLabel }}
      </button>
    </slot>
  </div>
</template>
