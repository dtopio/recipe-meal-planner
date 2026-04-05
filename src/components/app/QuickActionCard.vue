<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  icon?: string
  color?: 'primary' | 'amber' | 'blue' | 'violet'
}>()

defineEmits<{
  click: []
}>()

const colorClasses = {
  primary: 'bg-primary/8 text-primary hover:bg-primary/12 border-primary/10',
  amber: 'bg-amber-500/8 text-amber-600 hover:bg-amber-500/12 border-amber-500/10',
  blue: 'bg-blue-500/8 text-blue-600 hover:bg-blue-500/12 border-blue-500/10',
  violet: 'bg-violet-500/8 text-violet-600 hover:bg-violet-500/12 border-violet-500/10',
}
</script>

<template>
  <button
    @click="$emit('click')"
    class="flex items-center gap-3 rounded-xl p-3.5 transition-all duration-200 text-left w-full border press-scale"
    :class="colorClasses[color || 'primary']"
  >
    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/70 shadow-sm">
      <slot name="icon">
        <span class="text-lg">{{ icon || '✨' }}</span>
      </slot>
    </div>
    <div class="min-w-0">
      <p class="text-sm font-bold truncate">{{ title }}</p>
      <p v-if="description" class="text-[11px] opacity-60 truncate mt-0.5">{{ description }}</p>
    </div>
  </button>
</template>
