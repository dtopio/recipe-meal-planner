<script setup lang="ts">
import type { ShoppingListItem } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-vue-next'

defineProps<{
  item: ShoppingListItem
}>()

defineEmits<{
  toggle: []
  remove: []
}>()
</script>

<template>
  <div
    class="flex items-center gap-4 py-3.5 px-4 transition-all duration-200 group active:bg-muted/40"
    :class="item.checked ? 'opacity-50' : ''"
  >
    <!-- Large checkbox for grocery store use -->
    <Checkbox
      :checked="item.checked"
      @update:checked="$emit('toggle')"
      class="shrink-0 w-6 h-6 rounded-lg border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      :aria-label="`Mark ${item.name} as ${item.checked ? 'unchecked' : 'checked'}`"
    />

    <!-- Item info — grocery-text class for legibility at a glance -->
    <div class="flex-1 min-w-0" @click="$emit('toggle')">
      <p
        class="grocery-text transition-all duration-200"
        :class="item.checked ? 'line-through text-muted-foreground decoration-2' : 'text-foreground'"
      >
        {{ item.name }}
      </p>
      <div class="flex items-center gap-2.5 mt-0.5">
        <span class="text-sm text-muted-foreground font-medium">
          {{ item.quantity }} {{ item.unit }}
        </span>
        <span v-if="item.sourceRecipeName" class="text-xs text-primary/60 truncate">
          · {{ item.sourceRecipeName }}
        </span>
      </div>
    </div>

    <!-- Sync status dot -->
    <span
      v-if="item.syncStatus === 'pending'"
      class="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
      title="Syncing..."
    />
    <span
      v-else-if="item.syncStatus === 'error'"
      class="w-2 h-2 rounded-full bg-destructive shrink-0"
      title="Sync error"
    />

    <!-- Remove button — visible on hover/focus, always tappable on mobile -->
    <button
      @click.stop="$emit('remove')"
      class="sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 p-2.5 -mr-1 rounded-xl hover:bg-destructive/8 active:bg-destructive/12 transition-all tap-target"
      aria-label="Remove item"
    >
      <Trash2 class="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
    </button>
  </div>
</template>
