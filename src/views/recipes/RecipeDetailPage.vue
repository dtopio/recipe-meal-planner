<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import { useShoppingStore } from '@/stores/shopping'
import { usePlannerStore } from '@/stores/planner'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { formatMinutes } from '@/utils/date'
import {
  ArrowLeft, Clock, Users, Edit, ChefHat, ShoppingCart, CalendarPlus,
  Minus, Plus, ExternalLink, Trash2
} from 'lucide-vue-next'
import type { Recipe } from '@/types'
import { useUiStore } from '@/stores/ui'
import { toast } from 'vue-sonner'

const props = defineProps<{ recipeId: string }>()
const router = useRouter()
const store = useRecipeStore()
const shopping = useShoppingStore()
const planner = usePlannerStore()
const ui = useUiStore()

const recipe = ref<Recipe | undefined>()
const scaleMultiplier = ref(1)

const scaledServings = computed(() => (recipe.value?.servings || 1) * scaleMultiplier.value)

onMounted(async () => {
  if (store.recipes.length === 0) await store.loadRecipes()
  recipe.value = store.getRecipe(props.recipeId)
})

watch(() => props.recipeId, () => {
  recipe.value = store.getRecipe(props.recipeId)
})

function scaleUp() { scaleMultiplier.value = Math.min(scaleMultiplier.value + 0.5, 5) }
function scaleDown() { scaleMultiplier.value = Math.max(scaleMultiplier.value - 0.5, 0.5) }

function addToShoppingList() {
  if (!recipe.value) return
  shopping.addRecipeIngredients(
    recipe.value.id,
    recipe.value.title,
    recipe.value.ingredients.map(i => ({
      name: i.name,
      quantity: i.quantity * scaleMultiplier.value,
      unit: i.unit,
    }))
  )
  toast.success('Ingredients added to shopping list')
}

function handleDelete() {
  if (!recipe.value) return
  ui.showConfirm({
    title: 'Delete recipe?',
    description: `Are you sure you want to delete "${recipe.value.title}"? This action cannot be undone.`,
    confirmLabel: 'Delete',
    variant: 'destructive',
    onConfirm: async () => {
      await store.deleteRecipe(recipe.value!.id)
      router.push('/recipes')
    },
  })
}
</script>

<template>
  <div class="max-w-5xl mx-auto">
    <button @click="router.back()" class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors tap-target">
      <ArrowLeft class="w-4 h-4" /> Back
    </button>

    <!-- Loading -->
    <div v-if="!recipe" class="space-y-4">
      <AppSkeleton class="h-64 rounded-2xl" />
      <AppSkeleton class="h-12 w-2/3" />
      <AppSkeleton class="h-96" />
    </div>

    <template v-else>
      <!-- Hero card -->
      <div class="surface-elevated overflow-hidden mb-8">
        <div class="relative">
          <img
            v-if="recipe.imageUrl"
            :src="recipe.imageUrl"
            :alt="recipe.title"
            class="w-full h-56 md:h-80 object-cover"
          />
          <div v-if="recipe.imageUrl" class="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

          <!-- Tags on image -->
          <div v-if="recipe.imageUrl && recipe.tags.length" class="absolute bottom-4 left-5 flex flex-wrap gap-1.5">
            <span v-for="tag in recipe.tags" :key="tag" class="px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-md">
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="p-6 lg:p-8">
          <!-- Tags (no image) -->
          <div v-if="!recipe.imageUrl && recipe.tags.length" class="flex flex-wrap gap-2 mb-3">
            <span v-for="tag in recipe.tags" :key="tag" class="px-2.5 py-0.5 rounded-full bg-primary/8 text-primary text-xs font-bold">
              {{ tag }}
            </span>
          </div>

          <h1 class="text-2xl lg:text-3xl font-extrabold text-foreground mb-2 tracking-tight">{{ recipe.title }}</h1>
          <p v-if="recipe.description" class="text-muted-foreground mb-5 leading-relaxed">{{ recipe.description }}</p>

          <!-- Stats -->
          <div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <span class="inline-flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg font-medium">
              <Clock class="w-4 h-4 text-primary/70" />
              Prep {{ formatMinutes(recipe.prepTime) }}
            </span>
            <span class="inline-flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg font-medium">
              <Clock class="w-4 h-4 text-primary/70" />
              Cook {{ formatMinutes(recipe.cookTime) }}
            </span>
            <span class="inline-flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-lg font-medium">
              <Users class="w-4 h-4 text-primary/70" />
              {{ scaledServings }} servings
            </span>
            <a
              v-if="recipe.sourceUrl"
              :href="recipe.sourceUrl"
              target="_blank"
              class="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <ExternalLink class="w-4 h-4" /> Source
            </a>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2.5">
            <Button @click="router.push(`/recipes/${recipe.id}/cook`)" class="shadow-md shadow-primary/10 press-scale">
              <ChefHat class="w-4 h-4 mr-1.5" /> Cook Mode
            </Button>
            <Button variant="outline" @click="router.push(`/recipes/${recipe.id}/edit`)" class="press-scale">
              <Edit class="w-4 h-4 mr-1.5" /> Edit
            </Button>
            <Button variant="outline" @click="addToShoppingList" class="press-scale">
              <ShoppingCart class="w-4 h-4 mr-1.5" /> Add to List
            </Button>
            <Button variant="outline" @click="router.push('/planner')" class="press-scale">
              <CalendarPlus class="w-4 h-4 mr-1.5" /> Plan
            </Button>
            <Button variant="outline" class="text-destructive hover:text-destructive hover:border-destructive/30" @click="handleDelete">
              <Trash2 class="w-4 h-4 mr-1.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      <!-- Content grid -->
      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Ingredients -->
        <div class="lg:col-span-2">
          <div class="surface-card p-5 lg:p-6 lg:sticky lg:top-20">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-lg font-bold text-foreground tracking-tight">Ingredients</h2>
              <div class="flex items-center gap-1 bg-muted rounded-xl p-1">
                <button @click="scaleDown" class="p-1.5 rounded-lg hover:bg-card transition-colors tap-target" aria-label="Decrease">
                  <Minus class="w-3.5 h-3.5" />
                </button>
                <span class="text-xs font-bold w-8 text-center">{{ scaleMultiplier }}x</span>
                <button @click="scaleUp" class="p-1.5 rounded-lg hover:bg-card transition-colors tap-target" aria-label="Increase">
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <ul class="space-y-3">
              <li v-for="ing in recipe.ingredients" :key="ing.id" class="flex items-start gap-2.5 text-sm">
                <span class="w-2 h-2 rounded-full bg-primary/60 mt-2 shrink-0" />
                <span class="leading-relaxed">
                  <strong class="font-semibold text-foreground">{{ (ing.quantity * scaleMultiplier).toFixed(ing.quantity * scaleMultiplier % 1 ? 1 : 0) }}</strong>
                  <span class="text-muted-foreground"> {{ ing.unit }}</span>
                  {{ ing.name }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Instructions -->
        <div class="lg:col-span-3">
          <div class="surface-card p-5 lg:p-6">
            <h2 class="text-lg font-bold text-foreground mb-5 tracking-tight">Instructions</h2>
            <ol class="space-y-6">
              <li v-for="(step, index) in recipe.instructions" :key="index" class="flex gap-4">
                <span class="w-9 h-9 rounded-xl bg-primary/10 text-primary text-sm font-extrabold flex items-center justify-center shrink-0">
                  {{ index + 1 }}
                </span>
                <p class="text-sm text-foreground leading-relaxed pt-1.5">{{ step }}</p>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
