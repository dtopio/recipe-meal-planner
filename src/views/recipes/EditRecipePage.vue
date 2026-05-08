<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Trash2, ArrowLeft, GripVertical } from 'lucide-vue-next'

const props = defineProps<{ recipeId: string }>()
const router = useRouter()
const store = useRecipeStore()
const saving = ref(false)
const loaded = ref(false)

const form = reactive({
  title: '',
  description: '',
  imageUrl: '',
  prepTime: 0,
  cookTime: 0,
  servings: 4,
  tags: '',
  nutrition: {
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  },
  ingredients: [{ quantity: '', unit: '', name: '' }] as { quantity: string; unit: string; name: string }[],
  instructions: [''] as string[],
})

onMounted(async () => {
  if (store.recipes.length === 0) await store.loadRecipes()
  const recipe = store.getRecipe(props.recipeId)
  if (recipe) {
    form.title = recipe.title
    form.description = recipe.description || ''
    form.imageUrl = recipe.imageUrl || ''
    form.prepTime = recipe.prepTime
    form.cookTime = recipe.cookTime
    form.servings = recipe.servings
    form.tags = recipe.tags.join(', ')
    form.nutrition.calories = recipe.nutrition ? String(recipe.nutrition.calories) : ''
    form.nutrition.protein = recipe.nutrition ? String(recipe.nutrition.protein) : ''
    form.nutrition.carbs = recipe.nutrition ? String(recipe.nutrition.carbs) : ''
    form.nutrition.fat = recipe.nutrition ? String(recipe.nutrition.fat) : ''
    form.ingredients = recipe.ingredients.map(i => ({
      quantity: String(i.quantity),
      unit: i.unit,
      name: i.name,
    }))
    form.instructions = [...recipe.instructions]
    loaded.value = true
  }
})

function addIngredient() {
  form.ingredients.push({ quantity: '', unit: '', name: '' })
}
function removeIngredient(index: number) {
  if (form.ingredients.length > 1) form.ingredients.splice(index, 1)
}
function addInstruction() {
  form.instructions.push('')
}
function removeInstruction(index: number) {
  if (form.instructions.length > 1) form.instructions.splice(index, 1)
}

function buildNutritionInput() {
  const values = [
    form.nutrition.calories,
    form.nutrition.protein,
    form.nutrition.carbs,
    form.nutrition.fat,
  ].map(value => String(value).trim())

  if (values.every(value => value === '')) {
    return null
  }

  return {
    calories: Number(form.nutrition.calories) || 0,
    protein: Number(form.nutrition.protein) || 0,
    carbs: Number(form.nutrition.carbs) || 0,
    fat: Number(form.nutrition.fat) || 0,
  }
}

async function handleSave() {
  saving.value = true
  try {
    await store.updateRecipe({
      id: props.recipeId,
      title: form.title,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      prepTime: Number(form.prepTime),
      cookTime: Number(form.cookTime),
      servings: Number(form.servings),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      ingredients: form.ingredients
        .filter(i => i.name.trim())
        .map(i => ({ quantity: Number(i.quantity) || 0, unit: i.unit, name: i.name })),
      instructions: form.instructions.filter(s => s.trim()),
      nutrition: buildNutritionInput(),
    })
    router.push(`/recipes/${props.recipeId}`)
  } catch {
    // error handled in store
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <button @click="router.back()" class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors tap-target">
      <ArrowLeft class="w-4 h-4" /> Back
    </button>

    <PageHeader title="Edit Recipe" :description="form.title" />

    <form v-if="loaded" @submit.prevent="handleSave">
      <div class="grid gap-8 lg:grid-cols-5">
        <div class="lg:col-span-3 space-y-6">
          <div class="surface-card p-5 lg:p-6 space-y-4">
            <h3 class="text-sm font-bold text-foreground tracking-tight">Basic Info</h3>
            <div class="space-y-2">
              <Label for="edit-title">Recipe Title *</Label>
              <Input id="edit-title" v-model="form.title" required />
            </div>
            <div class="space-y-2">
              <Label for="edit-desc">Description</Label>
              <Textarea id="edit-desc" v-model="form.description" rows="3" />
            </div>
            <div class="space-y-2">
              <Label for="edit-img">Image URL</Label>
              <Input id="edit-img" v-model="form.imageUrl" placeholder="https://..." />
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div class="space-y-2">
                <Label>Prep (min)</Label>
                <Input v-model.number="form.prepTime" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <Label>Cook (min)</Label>
                <Input v-model.number="form.cookTime" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <Label>Servings</Label>
                <Input v-model.number="form.servings" type="number" min="1" />
              </div>
            </div>
            <div class="space-y-2">
              <Label>Tags</Label>
              <Input v-model="form.tags" placeholder="healthy, dinner, quick" />
            </div>
          </div>

          <div class="surface-card p-5 lg:p-6 space-y-4">
            <h3 class="text-sm font-bold text-foreground tracking-tight">Whole Recipe Nutrition</h3>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-2">
                <Label>Calories</Label>
                <Input v-model="form.nutrition.calories" type="number" min="0" placeholder="0" />
              </div>
              <div class="space-y-2">
                <Label>Protein (g)</Label>
                <Input v-model="form.nutrition.protein" type="number" min="0" step="0.1" placeholder="0" />
              </div>
              <div class="space-y-2">
                <Label>Carbs (g)</Label>
                <Input v-model="form.nutrition.carbs" type="number" min="0" step="0.1" placeholder="0" />
              </div>
              <div class="space-y-2">
                <Label>Fat (g)</Label>
                <Input v-model="form.nutrition.fat" type="number" min="0" step="0.1" placeholder="0" />
              </div>
            </div>
          </div>

          <!-- Ingredients -->
          <div class="surface-card p-5 lg:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-foreground tracking-tight">Ingredients</h3>
              <Button type="button" variant="outline" size="sm" @click="addIngredient">
                <Plus class="w-3.5 h-3.5 mr-1" /> Add
              </Button>
            </div>
            <div class="space-y-2">
              <div v-for="(ing, index) in form.ingredients" :key="index" class="flex items-center gap-2">
                <GripVertical class="w-4 h-4 text-muted-foreground/40 shrink-0 hidden sm:block" />
                <Input v-model="ing.quantity" placeholder="Qty" class="w-16 shrink-0" />
                <Input v-model="ing.unit" placeholder="Unit" class="w-20 shrink-0" />
                <Input v-model="ing.name" placeholder="Ingredient" class="flex-1" />
                <button type="button" @click="removeIngredient(index)" class="p-1.5 rounded hover:bg-destructive/10" :disabled="form.ingredients.length === 1">
                  <Trash2 class="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          <!-- Instructions -->
          <div class="surface-card p-5 lg:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-foreground tracking-tight">Instructions</h3>
              <Button type="button" variant="outline" size="sm" @click="addInstruction">
                <Plus class="w-3.5 h-3.5 mr-1" /> Add Step
              </Button>
            </div>
            <div class="space-y-3">
              <div v-for="(_, index) in form.instructions" :key="index" class="flex items-start gap-2">
                <span class="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-1.5">{{ index + 1 }}</span>
                <Textarea v-model="form.instructions[index]" rows="2" class="flex-1" />
                <button type="button" @click="removeInstruction(index)" class="p-1.5 rounded hover:bg-destructive/10 mt-1.5" :disabled="form.instructions.length === 1">
                  <Trash2 class="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-2">
          <div class="lg:sticky lg:top-20 space-y-4">
            <div class="surface-card p-5 space-y-3">
              <Button type="submit" class="w-full shadow-md shadow-primary/10" :disabled="!form.title.trim() || saving">
                <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
                Save Changes
              </Button>
              <Button type="button" variant="outline" class="w-full" @click="router.back()">Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
