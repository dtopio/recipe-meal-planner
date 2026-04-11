<script setup lang="ts">
import type { Recipe } from '@/types'
import { formatMinutes } from '@/utils/date'
import { Clock, Users } from 'lucide-vue-next'

defineProps<{
  recipe: Recipe
  compact?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <article
    @click="$emit('click')"
    class="group cursor-pointer surface-card overflow-hidden transition-all duration-300 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 press-scale"
    :class="compact ? '' : 'flex flex-col'"
  >
    <!-- Image -->
    <div class="relative overflow-hidden" :class="compact ? 'h-32' : 'h-44'">
      <img
        v-if="recipe.imageUrl"
        :src="recipe.imageUrl"
        :alt="recipe.title"
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div v-else class="w-full h-full bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
        <span class="text-4xl opacity-40">🍽</span>
      </div>

      <!-- Tags overlay -->
      <div v-if="!compact && recipe.tags.length" class="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
        <span
          v-for="tag in recipe.tags.slice(0, 3)"
          :key="tag"
          class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-black/40 text-white backdrop-blur-md"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Time badge overlay -->
      <div v-if="!compact" class="absolute bottom-2.5 right-2.5">
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-black/40 text-white backdrop-blur-md">
          <Clock class="w-3 h-3" />
          {{ formatMinutes(recipe.prepTime + recipe.cookTime) }}
        </span>
      </div>
    </div>

    <!-- Content -->
    <div class="p-3.5 flex-1 flex flex-col">
      <h3
        class="font-bold text-foreground leading-snug group-hover:text-primary transition-colors duration-200"
        :class="compact ? 'text-sm line-clamp-1' : 'text-[15px] line-clamp-2 mb-1.5'"
      >
        {{ recipe.title }}
      </h3>

      <p v-if="!compact && recipe.description" class="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
        {{ recipe.description }}
      </p>

      <div class="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span v-if="compact" class="inline-flex items-center gap-1">
          <Clock class="w-3.5 h-3.5" />
          {{ formatMinutes(recipe.prepTime + recipe.cookTime) }}
        </span>
        <span class="inline-flex items-center gap-1">
          <Users class="w-3.5 h-3.5" />
          {{ recipe.servings }}
        </span>
      </div>
    </div>
  </article>
</template>
