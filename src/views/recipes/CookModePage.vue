<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import type { Recipe } from '@/types'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-vue-next'

const props = defineProps<{ recipeId: string }>()
const router = useRouter()
const store = useRecipeStore()

const recipe = ref<Recipe | undefined>()
const currentStep = ref(0)
const completedSteps = ref<Set<number>>(new Set())

onMounted(async () => {
  if (store.recipes.length === 0) await store.loadRecipes()
  recipe.value = store.getRecipe(props.recipeId)
})

const totalSteps = computed(() => recipe.value?.instructions.length || 0)
const progressPercent = computed(() => totalSteps.value ? Math.round((completedSteps.value.size / totalSteps.value) * 100) : 0)

function nextStep() {
  if (currentStep.value < totalSteps.value - 1) currentStep.value++
}
function prevStep() {
  if (currentStep.value > 0) currentStep.value--
}
function toggleComplete(index: number) {
  if (completedSteps.value.has(index)) {
    completedSteps.value.delete(index)
  } else {
    completedSteps.value.add(index)
  }
}
function resetAll() {
  completedSteps.value.clear()
  currentStep.value = 0
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
      <button @click="resetAll" class="p-2.5 rounded-xl hover:bg-muted text-muted-foreground tap-target" aria-label="Reset">
        <RotateCcw class="w-4 h-4" />
      </button>
    </div>

    <!-- Progress bar -->
    <div class="h-1.5 bg-muted">
      <div class="h-full bg-primary rounded-r-full transition-all duration-500 ease-out" :style="{ width: `${progressPercent}%` }" />
    </div>

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
      </div>
    </div>

    <!-- Navigation footer — large tap targets for greasy fingers -->
    <div class="sticky bottom-0 bg-card/90 backdrop-blur-xl border-t border-border/40 p-4 flex items-center justify-between shadow-[0_-1px_3px_rgba(0,0,0,0.03)]">
      <Button variant="outline" :disabled="currentStep === 0" @click="prevStep" class="min-h-[48px] px-5 rounded-xl press-scale">
        <ChevronLeft class="w-4 h-4 mr-1" /> Previous
      </Button>

      <span class="text-sm font-medium text-muted-foreground hidden sm:block">
        {{ completedSteps.size }} of {{ totalSteps }} steps done
      </span>

      <Button v-if="currentStep < totalSteps - 1" @click="nextStep" class="min-h-[48px] px-5 rounded-xl shadow-md shadow-primary/10 press-scale">
        Next <ChevronRight class="w-4 h-4 ml-1" />
      </Button>
      <Button v-else @click="router.back()" class="min-h-[48px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/15 press-scale">
        <Check class="w-4 h-4 mr-1" /> Finish
      </Button>
    </div>
  </div>
</template>
