<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Trash2, ArrowLeft, GripVertical } from 'lucide-vue-next'

const router = useRouter()
const store = useRecipeStore()

const form = reactive({
  title: '',
  description: '',
  imageUrl: '',
  prepTime: 15,
  cookTime: 30,
  servings: 4,
  tags: '' as string,
  ingredients: [{ quantity: '', unit: '', name: '' }] as { quantity: string; unit: string; name: string }[],
  instructions: [''] as string[],
})

const saving = ref(false)

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

async function handleSave() {
  saving.value = true
  try {
    const recipe = await store.createRecipe({
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
    })
    router.push(`/recipes/${recipe.id}`)
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
      <ArrowLeft class="w-4 h-4" /> Back to recipes
    </button>

    <PageHeader title="Add New Recipe" description="Create a recipe from scratch" />

    <form @submit.prevent="handleSave">
      <div class="grid gap-8 lg:grid-cols-5">
        <!-- Left column: main fields -->
        <div class="lg:col-span-3 space-y-6">
          <!-- Basics card -->
          <div class="surface-card p-5 lg:p-6 space-y-4">
            <h3 class="text-sm font-bold text-foreground tracking-tight">Basic Info</h3>

            <div class="space-y-2">
              <Label for="title">Recipe Title *</Label>
              <Input id="title" v-model="form.title" placeholder="e.g. Grandma's Chicken Soup" required />
            </div>

            <div class="space-y-2">
              <Label for="description">Description</Label>
              <Textarea id="description" v-model="form.description" placeholder="A brief description of this recipe..." rows="3" />
            </div>

            <div class="space-y-2">
              <Label for="image-url">Image URL</Label>
              <Input id="image-url" v-model="form.imageUrl" placeholder="https://..." />
              <div v-if="form.imageUrl" class="mt-2">
                <img :src="form.imageUrl" class="w-full h-40 object-cover rounded-lg border" alt="Preview" @error="form.imageUrl = ''" />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div class="space-y-2">
                <Label for="prep">Prep (min)</Label>
                <Input id="prep" v-model.number="form.prepTime" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <Label for="cook">Cook (min)</Label>
                <Input id="cook" v-model.number="form.cookTime" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <Label for="servings">Servings</Label>
                <Input id="servings" v-model.number="form.servings" type="number" min="1" />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="tags">Tags</Label>
              <Input id="tags" v-model="form.tags" placeholder="healthy, dinner, quick (comma separated)" />
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
                <Input v-model="ing.name" placeholder="Ingredient name" class="flex-1" />
                <button
                  type="button"
                  @click="removeIngredient(index)"
                  class="p-1.5 rounded hover:bg-destructive/10 transition-colors shrink-0"
                  :disabled="form.ingredients.length === 1"
                >
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
                <span class="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-1.5">
                  {{ index + 1 }}
                </span>
                <Textarea
                  v-model="form.instructions[index]"
                  placeholder="Describe this step..."
                  rows="2"
                  class="flex-1"
                />
                <button
                  type="button"
                  @click="removeInstruction(index)"
                  class="p-1.5 rounded hover:bg-destructive/10 transition-colors shrink-0 mt-1.5"
                  :disabled="form.instructions.length === 1"
                >
                  <Trash2 class="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Right column: sticky actions -->
        <div class="lg:col-span-2">
          <div class="lg:sticky lg:top-20 space-y-4">
            <!-- Preview card -->
            <div class="surface-card p-5 space-y-3">
              <h3 class="text-sm font-bold text-foreground tracking-tight">Preview</h3>
              <div class="rounded-xl overflow-hidden bg-muted aspect-video flex items-center justify-center">
                <img v-if="form.imageUrl" :src="form.imageUrl" class="w-full h-full object-cover" alt="Preview" />
                <span v-else class="text-3xl">🍽</span>
              </div>
              <h4 class="font-semibold text-foreground">{{ form.title || 'Untitled Recipe' }}</h4>
              <p class="text-xs text-muted-foreground">
                {{ form.prepTime + form.cookTime }}m · {{ form.servings }} servings ·
                {{ form.ingredients.filter(i => i.name.trim()).length }} ingredients
              </p>
            </div>

            <!-- Action buttons -->
            <div class="surface-card p-5 space-y-3">
              <Button type="submit" class="w-full shadow-md shadow-primary/10" :disabled="!form.title.trim() || saving">
                <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
                Save Recipe
              </Button>
              <Button type="button" variant="outline" class="w-full" @click="router.back()">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
