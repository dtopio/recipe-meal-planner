<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import type { Recipe } from '@/types'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, Check, RotateCcw, ListChecks, Clock, Users } from 'lucide-vue-next'
import { formatMinutes } from '@/utils/date'

const props = defineProps<{ recipeId: string }>()
const router = useRouter()
const store = useRecipeStore()

const recipe = ref<Recipe | undefined>()
const currentStep = ref(0)
const completedSteps = ref<Set<number>>(new Set())
const checkedIngredients = ref<Set<number>>(new Set())
const showIngredients = ref(false)
const elapsedSeconds = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (store.recipes.length === 0) await store.loadRecipes()
  recipe.value = store.getRecipe(props.recipeId)
  // Start cooking timer
  timerInterval = setInterval(() => elapsedSeconds.value++, 1000)
  // Keyboard navigation
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  window.removeEventListener('keydown', handleKeyDown)
})

const totalSteps = computed(() => recipe.value?.instructions.length || 0)
const progressPercent = computed(() => totalSteps.value ? Math.round((completedSteps.value.size / totalSteps.value) * 100) : 0)
const elapsedFormatted = computed(() => {
  const mins = Math.floor(elapsedSeconds.value / 60)
  const secs = elapsedSeconds.value % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})
const allStepsDone = computed(() => completedSteps.value.size === totalSteps.value && totalSteps.value > 0)

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextStep() }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevStep() }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleComplete(currentStep.value) }
}

function nextStep() {
  if (currentStep.value < totalSteps.value - 1) currentStep.value++
}
function prevStep() {
  if (currentStep.value > 0) currentStep.value--
}
function toggleComplete(index: number) {
  const newSet = new Set(completedSteps.value)
  if (newSet.has(index)) {
    newSet.delete(index)
  } else {
    newSet.add(index)
  }
  completedSteps.value = newSet
}
function toggleIngredient(index: number) {
  const newSet = new Set(checkedIngredients.value)
  if (newSet.has(index)) newSet.delete(index)
  else newSet.add(index)
  checkedIngredients.value = newSet
}
function resetAll() {
  completedSteps.value = new Set()
  checkedIngredients.value = new Set()
  currentStep.value = 0
  elapsedSeconds.value = 0
}
</script>

<template>
  <div v-if="recipe" class="min-h-screen bg-background flex flex-col">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-card/90 backdrop-blur-xl border-b border-border/40 px-5 py-3.5 flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-3 min-w-0">
        <button @click="router.back()" class="p-2.5 rounded-xl hover:bg-muted transition-colors tap-target" aria-label="Exit cook mode">
          <X class="w-5 h-5" />
        </button>
        <div class="min-w-0">
          <h1 class="text-sm font-bold truncate tracking-tight">{{ recipe.title }}</h1>
          <p class="text-xs text-muted-foreground">Step {{ currentStep + 1 }} of {{ totalSteps }} · {{ progressPercent }}% done</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <!-- Cooking timer -->
        <div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-semibold text-muted-foreground">
          <Clock class="w-3.5 h-3.5" />
          {{ elapsedFormatted }}
        </div>
        <!-- Toggle ingredients panel -->
        <button
          @click="showIngredients = !showIngredients"
          class="p-2.5 rounded-xl transition-colors tap-target"
          :class="showIngredients ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'"
          aria-label="Toggle ingredients"
        >
          <ListChecks class="w-4 h-4" />
        </button>
        <button @click="resetAll" class="p-2.5 rounded-xl hover:bg-muted text-muted-foreground tap-target" aria-label="Reset">
          <RotateCcw class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="h-1.5 bg-muted">
      <div class="h-full bg-primary rounded-r-full transition-all duration-500 ease-out" :style="{ width: `${progressPercent}%` }" />
    </div>

    <div class="flex-1 flex">
      <!-- Main content — large, readable text for kitchen use -->
      <div class="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div class="max-w-2xl w-full text-center">
          <!-- Step dots -->
          <div class="mb-8 flex items-center justify-center gap-2 flex-wrap">
            <button
              v-for="(_, i) in recipe.instructions"
              :key="i"
              class="transition-all duration-300 rounded-full cursor-pointer"
              :class="[
                i === currentStep ? 'bg-primary w-8 h-3' : completedSteps.has(i) ? 'bg-emerald-500 w-3 h-3' : 'bg-muted-foreground/15 w-3 h-3 hover:bg-muted-foreground/25'
              ]"
              @click="currentStep = i"
              :aria-label="`Go to step ${i + 1}`"
            />
          </div>

          <!-- Step number -->
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary text-xl font-extrabold mb-6">
            {{ currentStep + 1 }}
          </div>

          <!-- Current instruction — BIG and readable -->
          <p class="text-xl sm:text-2xl lg:text-4xl font-medium text-foreground leading-relaxed lg:leading-relaxed mb-10">
            {{ recipe.instructions[currentStep] }}
          </p>

          <!-- Toggle complete button -->
          <button
            @click="toggleComplete(currentStep)"
            class="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 press-scale shadow-lg"
            :class="completedSteps.has(currentStep)
              ? 'bg-emerald-500 text-white shadow-emerald-500/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 shadow-black/5'"
          >
            <Check class="w-5 h-5" />
            {{ completedSteps.has(currentStep) ? 'Completed' : 'Mark as done' }}
          </button>

          <!-- Keyboard hint (desktop only) -->
          <p class="hidden lg:block mt-6 text-xs text-muted-foreground/40">
            Use <kbd class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">&larr;</kbd>
            <kbd class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">&rarr;</kbd> to navigate,
            <kbd class="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">Space</kbd> to mark done
          </p>
        </div>
      </div>

      <!-- Ingredients sidebar -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="translate-x-full opacity-0"
        enter-to-class="translate-x-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-x-0 opacity-100"
        leave-to-class="translate-x-full opacity-0"
      >
        <div v-if="showIngredients" class="w-72 lg:w-80 border-l border-border/40 bg-card/50 overflow-y-auto shrink-0">
          <div class="p-4 border-b border-border/30">
            <h3 class="text-sm font-bold text-foreground flex items-center gap-2">
              <ListChecks class="w-4 h-4 text-primary" />
              Ingredients
            </h3>
            <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1"><Clock class="w-3 h-3" /> {{ formatMinutes(recipe.prepTime + recipe.cookTime) }}</span>
              <span class="inline-flex items-center gap-1"><Users class="w-3 h-3" /> {{ recipe.servings }} servings</span>
            </div>
          </div>
          <div class="p-3 space-y-1">
            <button
              v-for="(ingredient, idx) in recipe.ingredients"
              :key="idx"
              @click="toggleIngredient(idx)"
              class="w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-muted/50"
            >
              <div
                class="w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                :class="checkedIngredients.has(idx)
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-border'"
              >
                <Check v-if="checkedIngredients.has(idx)" class="w-3 h-3 text-white" />
              </div>
              <span
                class="text-sm transition-all"
                :class="checkedIngredients.has(idx)
                  ? 'line-through text-muted-foreground/50'
                  : 'text-foreground font-medium'"
              >
                {{ ingredient }}
              </span>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Completion celebration overlay -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="allStepsDone" class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div class="text-center p-8 max-w-md">
          <div class="text-6xl mb-4">🎉</div>
          <h2 class="text-2xl font-extrabold text-foreground mb-2 tracking-tight">All steps completed!</h2>
          <p class="text-muted-foreground mb-2">
            You cooked <strong class="text-foreground">{{ recipe.title }}</strong> in {{ elapsedFormatted }}
          </p>
          <p class="text-sm text-muted-foreground mb-6">Time to plate up and enjoy your meal.</p>
          <div class="flex items-center justify-center gap-3">
            <Button @click="router.back()" class="shadow-md shadow-primary/15 press-scale">
              Done Cooking
            </Button>
            <Button variant="outline" @click="resetAll" class="press-scale">
              <RotateCcw class="w-4 h-4 mr-1.5" /> Cook Again
            </Button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Navigation footer — large tap targets for greasy fingers -->
    <div class="sticky bottom-0 bg-card/90 backdrop-blur-xl border-t border-border/40 p-4 flex items-center justify-between shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
      <Button variant="outline" :disabled="currentStep === 0" @click="prevStep" class="min-h-[48px] px-5 rounded-xl press-scale">
        <ChevronLeft class="w-4 h-4 mr-1" /> Previous
      </Button>

      <div class="hidden sm:flex items-center gap-3">
        <span class="text-sm font-medium text-muted-foreground">
          {{ completedSteps.size }} of {{ totalSteps }} steps done
        </span>
        <span class="text-xs text-muted-foreground/50">·</span>
        <span class="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Clock class="w-3 h-3" /> {{ elapsedFormatted }}
        </span>
      </div>

      <Button v-if="currentStep < totalSteps - 1" @click="nextStep" class="min-h-[48px] px-5 rounded-xl shadow-md shadow-primary/10 press-scale">
        Next <ChevronRight class="w-4 h-4 ml-1" />
      </Button>
      <Button v-else @click="router.back()" class="min-h-[48px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/15 press-scale">
        <Check class="w-4 h-4 mr-1" /> Finish
      </Button>
    </div>
  </div>
</template>
