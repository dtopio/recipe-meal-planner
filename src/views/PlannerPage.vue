<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'
import { useRecipeStore } from '@/stores/recipes'
import { useShoppingStore } from '@/stores/shopping'
import { useHouseholdStore } from '@/stores/household'
import PageHeader from '@/components/layout/PageHeader.vue'
import MealSlotCard from '@/components/app/MealSlotCard.vue'
import AppSkeleton from '@/components/app/AppSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateShort, getDayName, getDayNameShort, isToday } from '@/utils/date'
import { formatMealPeriodLabel, getMealPeriodDisplay, getMealPeriods } from '@/utils/meal-periods'
import type { MealSlot, MealType, Recipe } from '@/types'
import { ChevronLeft, ChevronRight, Search, X, BookOpen, ShoppingCart, Copy, RefreshCw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const router = useRouter()
const planner = usePlannerStore()
const recipes = useRecipeStore()
const shopping = useShoppingStore()
const household = useHouseholdStore()

const showRecipePanel = ref(false)
const recipeSearch = ref('')
const assignTarget = ref<{ date: string; mealType: MealType } | null>(null)
const draggedRecipe = ref<Recipe | null>(null)

const filteredRecipes = computed(() => {
  if (!recipeSearch.value) return recipes.recipes
  const q = recipeSearch.value.toLowerCase()
  return recipes.recipes.filter(recipe => recipe.title.toLowerCase().includes(q))
})

const mealTypes = computed(() => getMealPeriods(household.preferences))

const summaryCounts = computed(() => (
  mealTypes.value.reduce<Record<string, number>>((counts, mealType) => {
    counts[mealType] = planner.weekDates.reduce((sum, date) => sum + getMealSlots(date, mealType).length, 0)
    return counts
  }, {})
))

onMounted(async () => {
  await Promise.all([
    planner.loadWeekPlan(),
    recipes.loadRecipes(),
    localStorage.getItem('household_id') && !household.preferences ? household.loadHousehold() : Promise.resolve(),
  ])
})

function onDragStart(recipe: Recipe, event: DragEvent) {
  draggedRecipe.value = recipe
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('text/plain', recipe.id)
  }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

async function onDrop(date: string, mealType: MealType, event: DragEvent) {
  event.preventDefault()
  if (!draggedRecipe.value) return

  try {
    await planner.assignMeal(date, mealType, draggedRecipe.value)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to assign meal')
  } finally {
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

async function assignRecipe(recipe: Recipe) {
  if (!assignTarget.value) return

  try {
    await planner.assignMeal(assignTarget.value.date, assignTarget.value.mealType, recipe)
    showRecipePanel.value = false
    assignTarget.value = null
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to assign meal')
  }
}

function getMealSlots(date: string, mealType: MealType): MealSlot[] {
  return planner.getSlots(date, mealType)
}

function openRecipe(slot: MealSlot) {
  if (!slot.recipeId) return
  router.push(`/recipes/${slot.recipeId}`)
}

async function handleRemoveMeal(slotId: string) {
  try {
    await planner.removeMeal(slotId)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to remove meal')
  }
}

async function handleChangeServings(slot: MealSlot, delta: number) {
  const current = slot.servings || slot.recipe?.servings || 1
  const next = Math.max(1, Math.min(20, current + delta))

  if (next === current) {
    return
  }

  try {
    await planner.updateMealServings(slot.id, next)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update servings')
  }
}

async function handleToggleRecurring(slot: MealSlot) {
  try {
    const nextValue = !slot.repeatWeekly
    await planner.setMealRecurring(slot.id, nextValue)
    toast.success(nextValue ? 'Meal will repeat weekly' : 'Weekly repeat removed')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to update recurring meal')
  }
}

async function handleCopyLastWeek() {
  try {
    const summary = await planner.copyLastWeek()
    if (summary.createdCount === 0) {
      toast(summary.skippedCount > 0 ? 'Last week is already copied into this planner' : 'No meals found to copy from last week')
      return
    }

    toast.success(
      summary.skippedCount > 0
        ? `Copied ${summary.createdCount} meals from last week, skipped ${summary.skippedCount} duplicates`
        : `Copied ${summary.createdCount} meals from last week`,
    )
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to copy last week')
  }
}

async function handleApplyRecurringMeals() {
  try {
    const summary = await planner.applyRecurringMeals()
    if (summary.createdCount === 0) {
      toast(summary.skippedCount > 0 ? 'Recurring meals are already applied for this week' : 'No recurring meals are set yet')
      return
    }

    toast.success(
      summary.skippedCount > 0
        ? `Applied ${summary.createdCount} recurring meals, skipped ${summary.skippedCount} duplicates`
        : `Applied ${summary.createdCount} recurring meals`,
    )
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to apply recurring meals')
  }
}

async function handleGenerateShoppingList() {
  if (planner.assignedMealCount === 0) {
    toast.error('Plan some meals for this week before generating a shopping list')
    return
  }

  try {
    const summary = await shopping.generateFromPlan(planner.currentWeekStart)
    toast.success(`Generated ${summary.createdCount} shopping items from this week's plan`)
    router.push('/shopping-list')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to generate shopping list')
  }
}
</script>

<template>
  <PageHeader
    title="Meal Planner"
    :description="`Week of ${formatDateShort(planner.weekDates[0])} - ${formatDateShort(planner.weekDates[6])}`"
  >
    <template #actions>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" @click="planner.navigateWeek('prev')" class="press-scale">
          <ChevronLeft class="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" @click="planner.navigateWeek('next')" class="press-scale">
          <ChevronRight class="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" @click="handleCopyLastWeek" class="press-scale">
          <Copy class="w-4 h-4 mr-1.5" /> Copy Last Week
        </Button>
        <Button variant="outline" size="sm" @click="handleApplyRecurringMeals" class="press-scale">
          <RefreshCw class="w-4 h-4 mr-1.5" /> Apply Recurring
        </Button>
        <Button size="sm" class="hidden lg:inline-flex shadow-sm" @click="showRecipePanel = !showRecipePanel">
          <BookOpen class="w-4 h-4 mr-1.5" /> Recipe Library
        </Button>
      </div>
    </template>
  </PageHeader>

  <div v-if="planner.loading && planner.slots.length === 0" class="space-y-4">
    <div class="grid grid-cols-7 gap-2">
      <AppSkeleton v-for="i in 7" :key="'hd-' + i" class="h-16 rounded-xl" />
    </div>
    <div class="grid grid-cols-7 gap-2">
      <AppSkeleton
        v-for="i in Math.max(21, mealTypes.length * 7)"
        :key="'sl-' + i"
        class="h-24 rounded-xl"
      />
    </div>
  </div>

  <template v-else>
    <div class="flex gap-6">
      <div class="flex-1 min-w-0">
        <div class="hidden lg:block">
          <div class="surface-card overflow-hidden flex flex-col">
            <!-- Horizontal scroll wrapper for header and meal rows together -->
            <div class="overflow-x-auto flex-1">
              <!-- Header -->
              <div class="grid grid-cols-[100px_repeat(7,280px)] border-b border-border/40 w-max">
                <div class="p-4" />
                <div
                  v-for="date in planner.weekDates"
                  :key="'h-' + date"
                  class="p-4 text-center transition-colors relative"
                  :class="isToday(date) ? 'bg-primary/[0.05]' : ''"
                >
                  <p class="text-[11px] font-bold uppercase tracking-wider" :class="isToday(date) ? 'text-primary' : 'text-muted-foreground'">
                    {{ getDayNameShort(date) }}
                  </p>
                  <p class="text-sm font-semibold mt-0.5" :class="isToday(date) ? 'text-primary' : 'text-foreground'">
                    {{ formatDateShort(date) }}
                  </p>
                  <span v-if="isToday(date)" class="inline-block text-[9px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full mt-1 font-bold">Today</span>
                </div>
              </div>

              <!-- Meal rows -->
              <div
                v-for="(mealType, mealIndex) in mealTypes"
                :key="mealType"
                class="grid grid-cols-[100px_repeat(7,280px)] w-max"
                :class="mealIndex < mealTypes.length - 1 ? 'border-b border-border/30' : ''"
              >
              <div class="p-4 flex flex-col items-center justify-center gap-2 border-r border-border/30 bg-muted/20">
                <component :is="getMealPeriodDisplay(mealType).icon" class="w-5 h-5" :class="getMealPeriodDisplay(mealType).color" />
                <span class="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ getMealPeriodDisplay(mealType).label }}</span>
              </div>

              <div
                v-for="date in planner.weekDates"
                :key="date + '-' + mealType"
                class="p-2.5 min-h-[180px] max-h-[240px] transition-colors border-r border-border/20 last:border-r-0 flex flex-col"
                :class="isToday(date) ? 'bg-primary/[0.03]' : ''"
                @dragover="onDragOver"
                @drop="onDrop(date, mealType, $event)"
              >
                <div
                  class="flex-1 rounded-xl transition-all p-2 flex flex-col overflow-hidden"
                  :class="draggedRecipe ? 'ring-2 ring-dashed ring-primary/20 bg-primary/[0.02]' : 'hover:bg-muted/30'"
                >
                  <div v-if="getMealSlots(date, mealType).length" class="space-y-1 overflow-y-auto pr-1.5 flex-1 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30">
                    <MealSlotCard
                      v-for="slot in getMealSlots(date, mealType)"
                      :key="slot.id"
                      :slot="slot"
                      :meal-type="mealType"
                      :servings-saving="Boolean(planner.updatingSlotIds[slot.id])"
                      @remove="handleRemoveMeal(slot.id)"
                      @click="openRecipe(slot)"
                      @decrease-servings="handleChangeServings(slot, -1)"
                      @increase-servings="handleChangeServings(slot, 1)"
                      @toggle-recurring="handleToggleRecurring(slot)"
                    />
                  </div>

                  <button
                    v-if="!getMealSlots(date, mealType).length || getMealSlots(date, mealType).length < 3"
                    type="button"
                    class="flex items-center justify-center rounded-lg border border-dashed border-border/40 px-2 py-2 text-[11px] font-semibold text-muted-foreground/40 transition-all hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary mt-auto"
                    @click="openAssignPanel(date, mealType)"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

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
                    class="rounded-2xl border border-border/50 bg-card/80 p-2.5"
                  >
                    <div class="mb-2 flex items-center gap-2 px-1">
                      <component :is="getMealPeriodDisplay(mealType).icon" class="w-3.5 h-3.5" :class="getMealPeriodDisplay(mealType).color" />
                      <p class="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {{ formatMealPeriodLabel(mealType) }}
                      </p>
                    </div>

                    <div class="space-y-2">
                      <MealSlotCard
                        v-for="slot in getMealSlots(date, mealType)"
                        :key="slot.id"
                        :slot="slot"
                        :meal-type="mealType"
                        :servings-saving="Boolean(planner.updatingSlotIds[slot.id])"
                        @remove="handleRemoveMeal(slot.id)"
                        @click="openRecipe(slot)"
                        @decrease-servings="handleChangeServings(slot, -1)"
                        @increase-servings="handleChangeServings(slot, 1)"
                        @toggle-recurring="handleToggleRecurring(slot)"
                      />

                      <button
                        type="button"
                        class="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/[0.03] hover:text-primary"
                        @click="openAssignPanel(date, mealType)"
                      >
                        Add {{ formatMealPeriodLabel(mealType).toLowerCase() }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 surface-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-4">
            <p class="text-sm text-muted-foreground">
              <strong class="text-foreground font-bold">{{ planner.assignedMealCount }}</strong> meals planned this week
            </p>
            <div class="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <span v-for="mealType in mealTypes" :key="mealType" class="inline-flex items-center gap-1">
                <component :is="getMealPeriodDisplay(mealType).icon" class="w-3 h-3" :class="getMealPeriodDisplay(mealType).color" />
                {{ summaryCounts[mealType] || 0 }}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" @click="handleGenerateShoppingList" class="press-scale">
            <ShoppingCart class="w-4 h-4 mr-1.5" /> Generate Shopping List
          </Button>
        </div>
      </div>

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
              <button type="button" @click="showRecipePanel = false" class="p-1.5 rounded-lg hover:bg-muted transition-colors">
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
                  <p class="text-[10px] text-muted-foreground">{{ recipe.prepTime + recipe.cookTime }}m - {{ recipe.servings }} servings</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

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
              <div class="flex justify-center pt-3 pb-1">
                <div class="w-10 h-1 rounded-full bg-border" />
              </div>
              <div class="px-5 pb-3 flex items-center justify-between shrink-0">
                <div>
                  <h3 class="font-bold text-foreground">Choose a Recipe</h3>
                  <p class="text-xs text-muted-foreground mt-1">
                    Add to {{ formatMealPeriodLabel(assignTarget.mealType).toLowerCase() }}
                  </p>
                </div>
                <button type="button" @click="showRecipePanel = false" class="p-2 rounded-xl hover:bg-muted tap-target"><X class="w-5 h-5" /></button>
              </div>
              <div class="px-5 pb-3 shrink-0">
                <Input v-model="recipeSearch" placeholder="Search recipes..." class="h-11" />
              </div>
              <div class="overflow-y-auto flex-1 px-4 pb-8 space-y-2">
                <button
                  type="button"
                  v-for="recipe in filteredRecipes"
                  :key="recipe.id"
                  @click="assignRecipe(recipe)"
                  class="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-border/50 hover:bg-muted/60 active:bg-muted transition-all text-left tap-target"
                >
                  <img v-if="recipe.imageUrl" :src="recipe.imageUrl" class="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-border/40" />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold truncate">{{ recipe.title }}</p>
                    <p class="text-xs text-muted-foreground mt-0.5">{{ recipe.prepTime + recipe.cookTime }}m - {{ recipe.servings }} servings</p>
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
