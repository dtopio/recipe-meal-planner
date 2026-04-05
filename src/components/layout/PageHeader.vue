<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="mb-8 lg:mb-10">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{{ title }}</h1>
        <p v-if="description" class="text-base text-muted-foreground mt-1.5 leading-relaxed">{{ description }}</p>
      </div>
      <div class="flex items-center gap-3">
        <slot name="actions" />
      </div>
    </div>
    <slot name="below" />
  </div>
</template>
