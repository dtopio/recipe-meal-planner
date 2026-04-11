<script setup lang="ts">
defineProps<{
  status: 'synced' | 'pending' | 'error' | 'connected' | 'disconnected' | 'reconnecting'
  showLabel?: boolean
}>()

const statusConfig = {
  synced: { color: 'bg-emerald-500', label: 'Synced' },
  pending: { color: 'bg-amber-400 animate-pulse', label: 'Syncing...' },
  error: { color: 'bg-destructive', label: 'Error' },
  connected: { color: 'bg-emerald-500', label: 'Connected' },
  disconnected: { color: 'bg-stone-400', label: 'Offline' },
  reconnecting: { color: 'bg-amber-400 animate-pulse', label: 'Reconnecting...' },
}
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span :class="['w-2 h-2 rounded-full shrink-0 ring-2 ring-background', statusConfig[status].color]" />
    <span v-if="showLabel" class="text-xs font-medium text-muted-foreground">
      {{ statusConfig[status].label }}
    </span>
  </span>
</template>
