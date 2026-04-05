<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Link, ArrowLeft, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-vue-next'
import type { Recipe } from '@/types'

const router = useRouter()
const store = useRecipeStore()

const url = ref('')
const step = ref<'input' | 'loading' | 'preview' | 'error' | 'duplicate'>('input')
const importedRecipe = ref<Recipe | null>(null)
const errorMessage = ref('')
const duplicateInfo = ref<{ id: string; title: string } | null>(null)

async function handleImport() {
  if (!url.value.trim()) return
  step.value = 'loading'
  errorMessage.value = ''

  try {
    const recipe = await store.importRecipe({ url: url.value.trim() })
    importedRecipe.value = recipe
    step.value = 'preview'
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Import failed'
    if (msg.startsWith('DUPLICATE:')) {
      const [, id, title] = msg.split(':')
      duplicateInfo.value = { id, title }
      step.value = 'duplicate'
    } else {
      errorMessage.value = msg
      step.value = 'error'
    }
  }
}

function reset() {
  step.value = 'input'
  url.value = ''
  importedRecipe.value = null
  errorMessage.value = ''
  duplicateInfo.value = null
}
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <button @click="router.back()" class="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-5 transition-colors tap-target">
      <ArrowLeft class="w-4 h-4" /> Back
    </button>

    <PageHeader title="Import Recipe" description="Import a recipe from any cooking website" />

    <!-- Step: URL Input -->
    <div v-if="step === 'input'" class="surface-card p-6 space-y-5">
      <div class="text-center pb-4">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Link class="w-7 h-7 text-primary" />
        </div>
        <h3 class="font-semibold text-foreground">Paste a recipe URL</h3>
        <p class="text-sm text-muted-foreground mt-1">We'll try to extract the recipe details automatically</p>
      </div>

      <div class="space-y-2">
        <Label for="recipe-url">Recipe URL</Label>
        <Input
          id="recipe-url"
          v-model="url"
          placeholder="https://www.allrecipes.com/recipe/..."
          type="url"
        />
      </div>

      <Button class="w-full" :disabled="!url.trim()" @click="handleImport">
        <ExternalLink class="w-4 h-4 mr-1.5" /> Import Recipe
      </Button>

      <p class="text-xs text-muted-foreground text-center">
        Supports most popular recipe sites. If import fails, you can always
        <router-link to="/recipes/new" class="text-primary hover:underline">add it manually</router-link>.
      </p>
    </div>

    <!-- Step: Loading -->
    <div v-else-if="step === 'loading'" class="surface-card p-8 text-center">
      <Loader2 class="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
      <h3 class="font-semibold text-foreground mb-2">Importing recipe...</h3>
      <p class="text-sm text-muted-foreground">Fetching and parsing recipe data from the URL</p>
      <div class="mt-6 space-y-2">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 class="w-4 h-4 text-emerald-500" /> Fetching page content
        </div>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 class="w-4 h-4 animate-spin" /> Extracting recipe data
        </div>
        <div class="flex items-center gap-2 text-sm text-muted-foreground/40">
          <div class="w-4 h-4 rounded-full border-2 border-border" /> Validating ingredients
        </div>
      </div>
    </div>

    <!-- Step: Preview -->
    <div v-else-if="step === 'preview' && importedRecipe" class="space-y-4">
      <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle2 class="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <p class="text-sm font-medium text-emerald-700">Recipe imported successfully!</p>
          <p class="text-xs text-emerald-600/70">Review the details below, then save or edit.</p>
        </div>
      </div>

      <div class="surface-card overflow-hidden">
        <img
          v-if="importedRecipe.imageUrl"
          :src="importedRecipe.imageUrl"
          class="w-full h-48 object-cover"
        />
        <div class="p-5 space-y-3">
          <h3 class="text-lg font-bold text-foreground">{{ importedRecipe.title }}</h3>
          <p class="text-sm text-muted-foreground">{{ importedRecipe.description }}</p>
          <div class="flex items-center gap-4 text-sm text-muted-foreground">
            <span>⏱ {{ importedRecipe.prepTime + importedRecipe.cookTime }}m</span>
            <span>🍽 {{ importedRecipe.servings }} servings</span>
            <span>📋 {{ importedRecipe.ingredients.length }} ingredients</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <span v-for="tag in importedRecipe.tags" :key="tag" class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <Button class="flex-1" @click="router.push(`/recipes/${importedRecipe.id}`)">
          View Recipe
        </Button>
        <Button variant="outline" @click="router.push(`/recipes/${importedRecipe.id}/edit`)">
          Edit First
        </Button>
        <Button variant="outline" @click="reset">Import Another</Button>
      </div>
    </div>

    <!-- Step: Duplicate -->
    <div v-else-if="step === 'duplicate'" class="surface-card p-6 text-center space-y-4">
      <div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
        <AlertTriangle class="w-7 h-7 text-amber-500" />
      </div>
      <h3 class="font-semibold text-foreground">Recipe already exists</h3>
      <p class="text-sm text-muted-foreground">
        A recipe from this source is already in your collection:
        <strong>{{ duplicateInfo?.title }}</strong>
      </p>
      <div class="flex gap-3 justify-center">
        <Button variant="outline" @click="router.push(`/recipes/${duplicateInfo?.id}`)">
          View Existing
        </Button>
        <Button @click="reset">Try Different URL</Button>
      </div>
    </div>

    <!-- Step: Error -->
    <div v-else-if="step === 'error'" class="surface-card p-6 text-center space-y-4">
      <div class="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
        <AlertTriangle class="w-7 h-7 text-destructive" />
      </div>
      <h3 class="font-semibold text-foreground">Import failed</h3>
      <p class="text-sm text-muted-foreground">{{ errorMessage || "We couldn't extract a recipe from that URL." }}</p>
      <div class="flex gap-3 justify-center">
        <Button variant="outline" @click="reset">Try Again</Button>
        <Button @click="router.push('/recipes/new')">Add Manually</Button>
      </div>
    </div>
  </div>
</template>
