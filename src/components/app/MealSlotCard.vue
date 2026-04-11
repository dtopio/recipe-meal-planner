<script setup lang="ts">
import { computed } from 'vue'
import type { MealSlot, MealType } from '@/types'
import { formatMinutes } from '@/utils/date'
import { formatMealPeriodLabel, getMealPeriodDisplay } from '@/utils/meal-periods'
import { Clock, X, GripVertical, Minus, Plus, Loader2, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  slot: MealSlot
  mealType: MealType
  draggable?: boolean
  servingsSaving?: boolean
}>()

defineEmits<{
  remove: []
  click: []
  decreaseServings: []
  increaseServings: []
  toggleRecurring: []
}>()

const config = computed(() => getMealPeriodDisplay(props.mealType))
const currentServings = computed(() => props.slot.servings || props.slot.recipe?.servings || 1)
</script>

<template>
  <div
    class="w-full min-w-0 rounded-xl border transition-all duration-200 group"
    :class="[
      slot.recipe
        ? 'bg-card border-border/70 hover:shadow-sm hover:border-primary/20 cursor-pointer border-l-[3px] ' + config.border
        : 'border-dashed border-border/50 hover:border-primary/30 hover:bg-primary/[0.02] cursor-pointer bg-gradient-to-br ' + config.gradient,
    ]"
  >
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
          <span class="text-[11px] text-muted-foreground">{{ formatMealPeriodLabel(slot.mealType) }}</span>
          <span
            v-if="slot.repeatWeekly"
            class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
          >
            <RefreshCw class="h-3 w-3" />
            Weekly
          </span>
        </div>

        <div class="mt-2">
          <div class="inline-flex items-center gap-1 rounded-full bg-muted px-1 py-0.5 text-[11px] font-semibold text-foreground">
            <button
              class="rounded-full p-1 transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="servingsSaving || currentServings <= 1"
              @click.stop="$emit('decreaseServings')"
            >
              <Minus class="h-3 w-3" />
            </button>
            <span class="min-w-[70px] text-center">
              <Loader2 v-if="servingsSaving" class="mx-auto h-3.5 w-3.5 animate-spin" />
              <template v-else>{{ currentServings }} serving{{ currentServings === 1 ? '' : 's' }}</template>
            </span>
            <button
              class="rounded-full p-1 transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="servingsSaving || currentServings >= 20"
              @click.stop="$emit('increaseServings')"
            >
              <Plus class="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <button
        @click.stop="$emit('toggleRecurring')"
        class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-primary/8 transition-all"
        :aria-label="slot.repeatWeekly ? 'Disable weekly repeat' : 'Repeat weekly'"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="slot.repeatWeekly ? 'text-primary' : 'text-muted-foreground hover:text-primary'" />
      </button>

      <button
        @click.stop="$emit('remove')"
        class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/8 transition-all"
        aria-label="Remove meal"
      >
        <X class="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
      </button>
    </div>

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
