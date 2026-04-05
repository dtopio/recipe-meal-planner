<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { useRecipeStore } from '@/stores/recipes'
import PageHeader from '@/components/layout/PageHeader.vue'
import MealSlotCard from '@/components/app/MealSlotCard.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateShort, getDayName, getDayNameShort, isToday } from '@/utils/date'
import type { MealType, Recipe } from '@/types'
import { ChevronLeft, ChevronRight, Search, X, BookOpen, ShoppingCart } from 'lucide-vue-next'

const router = useRouter()
const planner = usePlannerStore()
const recipes = useRecipeStore()

const showRecipePanel = ref(false)
const recipeSearch = ref('')
const assignTarget = ref<{ date: string; mealType: MealType } | null>(null)
const draggedRecipe = ref<Recipe | null>(null)

const filteredRecipes = computed(() => {
  if (!recipeSearch.value) return recipes.recipes
  const q = recipeSearch.value.toLowerCase()
  return recipes.recipes.filter(r => r.title.toLowerCase().includes(q))
})

const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner']

onMounted(async () => {
  await Promise.all([planner.loadWeekPlan(), recipes.loadRecipes()])
})

function onDragStart(recipe: Recipe, e: DragEvent) {
  draggedRecipe.value = recipe
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', recipe.id)
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDrop(date: string, mealType: MealType, e: DragEvent) {
  e.preventDefault()
  if (draggedRecipe.value) {
    planner.assignMeal(date, mealType, draggedRecipe.value)
    draggedRecipe.value = null
  }
}

function onDragEnd() {
  draggedRecipe.value = null
}

function openAssignPanel(date: string, mealType: MealType) {
  assignTarget.value = { date, mealType }
  showRecipePanel.value = true
}

function assignRecipe(recipe: Recipe) {
  if (assignTarget.value) {
    planner.assignMeal(assignTarget.value.date, assignTarget.value.mealType, recipe)
    showRecipePanel.value = false
    assignTarget.value = null
  }
}
</script>

<template>
  <PageHeader
    title="Meal Planner"
    :description="`Week of ${formatDateShort(planner.weekDates[0])} — ${formatDateShort(planner.weekDates[6])}`"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="planner.navigateWeek('prev')" class="press-scale">
          <ChevronLeft class="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" @click="planner.navigateWeek('next')" class="press-scale">
          <ChevronRight class="w-4 h-4" />
        </Button>
        <Button size="sm" class="hidden lg:inline-flex shadow-sm" @click="showRecipePanel = !showRecipePanel">
          <BookOpen class="w-4 h-4 mr-1.5" /> Recipe Library
        </Button>
      </div>
    </template>
  </PageHeader>

  <!-- Loading -->
  <div v-if="planner.loading && planner.slots.length === 0" class="grid grid-cols-7 gap-3">
    <AppSkeleton v-for="i in 21" :key="i" class="h-20" />
  </div>

  <template v-else>
    <div class="flex gap-6">
      <!-- Main planner grid -->
      <div class="flex-1 min-w-0">
        <!-- Desktop: full grid -->
        <div class="hidden lg:block">
          <div class="grid grid-cols-7 gap-3">
            <!-- Day headers -->
            <div
              v-for="date in planner.weekDates"
              :key="'h-' + date"
              class="text-center pb-3 border-b-2 transition-colors"
              :class="isToday(date) ? 'border-primary' : 'border-border/40'"
            >
              <p class="text-xs font-bold uppercase tracking-wider" :class="isToday(date) ? 'text-primary' : 'text-muted-foreground'">
                {{ getDayNameShort(date) }}
              </p>
              <p class="text-sm font-semibold mt-0.5" :class="isToday(date) ? 'text-primary' : 'text-foreground'">
                {{ formatDateShort(date) }}
              </p>
              <span v-if="isToday(date)" class="inline-block text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full mt-1 font-bold">Today</span>
            </div>

            <!-- Meal slots per day -->
            <template v-for="date in planner.weekDates" :key="'s-' + date">
              <div class="space-y-2">
                <div
                  v-for="mealType in mealTypes"
                  :key="mealType"
                  @dragover="onDragOver"
                  @drop="onDrop(date, mealType, $event)"
                  @click="openAssignPanel(date, mealType)"
                  class="transition-all rounded-xl"
                  :class="draggedRecipe ? 'ring-2 ring-dashed ring-primary/20 rounded-xl' : ''"
                >
                  <MealSlotCard
                    :slot="planner.getSlot(date, mealType) || { id: '', date, mealType }"
                    :meal-type="mealType"
                    @remove="planner.removeMeal(date, mealType)"
                    @click="planner.getSlot(date, mealType)?.recipe ? router.push(`/recipes/${planner.getSlot(date, mealType)!.recipeId}`) : openAssignPanel(date, mealType)"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Mobile/Tablet: horizontal scroll cards -->
        <div class="lg:hidden">
          <div class="flex gap-3 overflow-x-auto pb-4 -mx-5 px-5 snap-x">
            <div
              v-for="date in planner.weekDates"
              :key="date"
              class="shrink-0 w-72 snap-start"
            >
              <div
                class="rounded-2xl border p-4 space-y-3 transition-all"
                :class="isToday(date) ? 'border-primary/30 bg-primary/[0.03] shadow-sm shadow-primary/5' : 'border-border/60 bg-card'"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-bold" :class="isToday(date) ? 'text-primary' : 'text-foreground'">
                      {{ getDayName(date) }}
                    </p>
                    <p class="text-xs text-muted-foreground">{{ formatDateShort(date) }}</p>
                  </div>
                  <span v-if="isToday(date)" class="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-full font-bold">Today</span>
                </div>

                <div class="space-y-2">
                  <div
                    v-for="mealType in mealTypes"
                    :key="mealType"
                    @click="planner.getSlot(date, mealType)?.recipe
                      ? router.push(`/recipes/${planner.getSlot(date, mealType)!.recipeId}`)
                      : openAssignPanel(date, mealType)"
                  >
                    <MealSlotCard
                      :slot="planner.getSlot(date, mealType) || { id: '', date, mealType }"
                      :meal-type="mealType"
                      @remove="planner.removeMeal(date, mealType)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary bar -->
        <div class="mt-6 surface-card p-4 flex items-center justify-between">
          <p class="text-sm text-muted-foreground">
            <strong class="text-foreground font-bold">{{ planner.assignedMealCount }}</strong> meals planned this week
          </p>
          <Button variant="outline" size="sm" @click="router.push('/shopping-list')" class="press-scale">
            <ShoppingCart class="w-4 h-4 mr-1.5" /> Generate Shopping List
          </Button>
        </div>
      </div>

      <!-- Recipe library panel (desktop) -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-4 opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-4 opacity-0"
      >
        <div v-if="showRecipePanel" class="hidden lg:block w-72 shrink-0">
          <div class="sticky top-20 surface-elevated overflow-hidden max-h-[calc(100vh-7rem)]">
            <div class="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 class="text-sm font-bold text-foreground">Recipe Library</h3>
              <button @click="showRecipePanel = false" class="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="p-3 border-b border-border/50">
              <div class="relative">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input v-model="recipeSearch" placeholder="Search..." class="pl-8 h-8 text-sm" />
              </div>
            </div>

            <div class="overflow-y-auto max-h-96 p-2.5 space-y-2">
              <p class="text-[10px] text-muted-foreground px-1 mb-1 font-medium">Drag a recipe onto a slot</p>
              <div
                v-for="recipe in filteredRecipes"
                :key="recipe.id"
                draggable="true"
                @dragstart="onDragStart(recipe, $event)"
                @dragend="onDragEnd"
                class="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/50 hover:bg-muted/60 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm"
              >
                <img v-if="recipe.imageUrl" :src="recipe.imageUrl" class="w-10 h-10 rounded-lg object-cover shrink-0 ring-1 ring-border/40" />
                <div class="min-w-0">
                  <p class="text-xs font-semibold truncate">{{ recipe.title }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ recipe.prepTime + recipe.cookTime }}m · {{ recipe.servings }} servings</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Mobile recipe picker bottom sheet -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showRecipePanel && assignTarget" class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" @click="showRecipePanel = false">
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="translate-y-full"
            enter-to-class="translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="translate-y-0"
            leave-to-class="translate-y-full"
            appear
          >
            <div class="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl max-h-[75vh] flex flex-col shadow-2xl" @click.stop>
              <!-- Handle -->
              <div class="flex justify-center pt-3 pb-1">
                <div class="w-10 h-1 rounded-full bg-border" />
              </div>
              <div class="px-5 pb-3 flex items-center justify-between shrink-0">
                <h3 class="font-bold text-foreground">Choose a Recipe</h3>
                <button @click="showRecipePanel = false" class="p-2 rounded-xl hover:bg-muted tap-target"><X class="w-5 h-5" /></button>
              </div>
              <div class="px-5 pb-3 shrink-0">
                <Input v-model="recipeSearch" placeholder="Search recipes..." class="h-11" />
              </div>
              <div class="overflow-y-auto flex-1 px-4 pb-8 space-y-2">
                <button
                  v-for="recipe in filteredRecipes"
                  :key="recipe.id"
                  @click="assignRecipe(recipe)"
                  class="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-border/50 hover:bg-muted/60 active:bg-muted transition-all text-left tap-target"
                >
                  <img v-if="recipe.imageUrl" :src="recipe.imageUrl" class="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-border/40" />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold truncate">{{ recipe.title }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ recipe.prepTime + recipe.cookTime }}m · {{ recipe.servings }} servings</p>
                  </div>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </template>
</template>
