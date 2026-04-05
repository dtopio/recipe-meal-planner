<script setup lang="ts">
defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="['animate-pulse rounded-2xl bg-muted/60', $props.class]">
    <slot />
  </div>
</template>
