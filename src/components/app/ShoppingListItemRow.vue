<script setup lang="ts">
import type { ShoppingListItem } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2 } from 'lucide-vue-next'
import { formatDateShort } from '@/utils/date'

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
    class="group flex items-center gap-4 px-4 py-3.5 transition-all duration-200 active:bg-muted/40"
    :class="item.checked ? 'opacity-50' : ''"
  >
    <Checkbox
      :checked="item.checked"
      @update:checked="$emit('toggle')"
      class="h-6 w-6 shrink-0 rounded-lg border-2 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
      :aria-label="`Mark ${item.name} as ${item.checked ? 'unchecked' : 'checked'}`"
    />

    <div class="min-w-0 flex-1" @click="$emit('toggle')">
      <p
        class="grocery-text transition-all duration-200"
        :class="item.checked ? 'text-muted-foreground line-through decoration-2' : 'text-foreground'"
      >
        {{ item.name }}
      </p>

      <div class="mt-0.5 flex flex-wrap items-center gap-2.5">
        <span class="text-sm font-medium text-muted-foreground">
          {{ item.quantity }} {{ item.unit }}
        </span>

        <span v-if="item.sourceRecipeName" class="max-w-full truncate rounded-full bg-primary/8 px-2 py-0.5 text-[11px] font-semibold text-primary/80">
          For: {{ item.sourceRecipeName }}
        </span>

        <span
          v-if="item.generated"
          class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
        >
          Auto-generated
        </span>

        <span
          v-if="item.generated && item.sourceWeekStart"
          class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
        >
          Week of {{ formatDateShort(item.sourceWeekStart) }}
        </span>
      </div>
    </div>

    <span
      v-if="item.syncStatus === 'pending'"
      class="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse"
      title="Syncing..."
    />
    <span
      v-else-if="item.syncStatus === 'error'"
      class="h-2 w-2 shrink-0 rounded-full bg-destructive"
      title="Sync error"
    />

    <button
      type="button"
      @click.stop="$emit('remove')"
      class="tap-target -mr-1 rounded-xl p-2.5 transition-all hover:bg-destructive/8 active:bg-destructive/12 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
      aria-label="Remove item"
    >
      <Trash2 class="h-4 w-4 text-muted-foreground transition-colors group-hover:text-destructive" />
    </button>
  </div>
</template>
