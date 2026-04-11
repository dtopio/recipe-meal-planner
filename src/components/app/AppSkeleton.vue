<script setup lang="ts">
defineProps<{
  class?: string
}>()
</script>

<template>
  <div :class="['rounded-2xl skeleton-shimmer', $props.class]">
    <slot />
  </div>
</template>
