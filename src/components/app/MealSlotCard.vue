<script setup lang="ts">
import type { MealSlot, MealType } from '@/types'
import { formatMinutes } from '@/utils/date'
import { Clock, X, GripVertical, Plus } from 'lucide-vue-next'

const props = defineProps<{
  slot: MealSlot
  mealType: MealType
  draggable?: boolean
}>()

defineEmits<{
  remove: []
  click: []
}>()

const mealTypeConfig: Record<MealType, { label: string; emoji: string; gradient: string; border: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🌅', gradient: 'from-amber-500/8 to-orange-500/4', border: 'border-l-amber-400' },
  lunch: { label: 'Lunch', emoji: '☀️', gradient: 'from-sky-500/8 to-blue-500/4', border: 'border-l-sky-400' },
  dinner: { label: 'Dinner', emoji: '🌙', gradient: 'from-indigo-500/8 to-violet-500/4', border: 'border-l-indigo-400' },
}

const config = mealTypeConfig[props.mealType]
</script>

<template>
  <div
    class="rounded-xl border transition-all duration-200 group"
    :class="[
      slot.recipe
        ? 'bg-card border-border/70 hover:shadow-sm hover:border-primary/20 cursor-pointer border-l-[3px] ' + config.border
        : 'border-dashed border-border/50 hover:border-primary/30 hover:bg-primary/[0.02] cursor-pointer bg-gradient-to-br ' + config.gradient,
    ]"
  >
    <!-- Assigned recipe -->
    <div v-if="slot.recipe" class="p-3 flex items-start gap-2.5" @click="$emit('click')">
      <div v-if="draggable" class="pt-1 cursor-grab text-muted-foreground/30 hover:text-muted-foreground transition-colors">
        <GripVertical class="w-4 h-4" />
      </div>

      <img
        v-if="slot.recipe.imageUrl"
        :src="slot.recipe.imageUrl"
        :alt="slot.recipe.title"
        class="w-11 h-11 rounded-lg object-cover shrink-0 ring-1 ring-border/50"
      />

      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-foreground truncate leading-tight">{{ slot.recipe.title }}</p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-[11px] text-muted-foreground inline-flex items-center gap-0.5">
            <Clock class="w-3 h-3" />
            {{ formatMinutes(slot.recipe.prepTime + slot.recipe.cookTime) }}
          </span>
          <span class="text-[11px] text-muted-foreground">{{ slot.recipe.servings }} servings</span>
        </div>
      </div>

      <button
        @click.stop="$emit('remove')"
        class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/8 transition-all"
        aria-label="Remove meal"
      >
        <X class="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>

    <!-- Empty slot -->
    <div
      v-else
      class="p-3.5 flex items-center justify-center gap-2 text-xs text-muted-foreground/50 min-h-[56px] transition-colors group-hover:text-muted-foreground/70"
      @click="$emit('click')"
    >
      <Plus class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      <span>{{ config.emoji }} Add {{ config.label.toLowerCase() }}</span>
    </div>
  </div>
</template>
