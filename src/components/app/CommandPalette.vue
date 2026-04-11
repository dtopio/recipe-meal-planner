<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useRecipeStore } from '@/stores/recipes'
import { useUiStore } from '@/stores/ui'
import {
  Search, ArrowRight, BookOpen, CalendarDays, ShoppingCart,
  Archive, LayoutDashboard, Settings, Home, BarChart3,
  Plus, Import, ChefHat, Moon, Sun, X,
} from 'lucide-vue-next'

const router = useRouter()
const recipes = useRecipeStore()
const ui = useUiStore()

const open = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// Static navigation actions
const navActions = [
  { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, path: '/dashboard', section: 'Navigation' },
  { id: 'nav-planner', label: 'Go to Planner', icon: CalendarDays, path: '/planner', section: 'Navigation' },
  { id: 'nav-report', label: 'Go to Weekly Report', icon: BarChart3, path: '/weekly-report', section: 'Navigation' },
  { id: 'nav-shopping', label: 'Go to Shopping List', icon: ShoppingCart, path: '/shopping-list', section: 'Navigation' },
  { id: 'nav-pantry', label: 'Go to Pantry', icon: Archive, path: '/pantry', section: 'Navigation' },
  { id: 'nav-recipes', label: 'Go to Recipes', icon: BookOpen, path: '/recipes', section: 'Navigation' },
  { id: 'nav-household', label: 'Go to Household', icon: Home, path: '/household', section: 'Navigation' },
  { id: 'nav-settings', label: 'Go to Settings', icon: Settings, path: '/settings', section: 'Navigation' },
]

const quickActions = [
  { id: 'action-add-recipe', label: 'Add New Recipe', icon: Plus, path: '/recipes/new', section: 'Quick Actions' },
  { id: 'action-import', label: 'Import Recipe from URL', icon: Import, path: '/recipes/import', section: 'Quick Actions' },
  { id: 'action-dark', label: 'Toggle Dark Mode', icon: Moon, action: () => ui.setTheme(ui.themeMode === 'dark' ? 'light' : 'dark'), section: 'Quick Actions' },
]

const filteredResults = computed(() => {
  const q = query.value.toLowerCase().trim()
  const results: Array<{
    id: string
    label: string
    sublabel?: string
    icon: typeof Search
    path?: string
    action?: () => void
    section: string
  }> = []

  // Recipe search results
  if (q.length > 0) {
    const matchedRecipes = recipes.recipes
      .filter(r => r.title.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q)))
      .slice(0, 5)
    for (const recipe of matchedRecipes) {
      results.push({
        id: 'recipe-' + recipe.id,
        label: recipe.title,
        sublabel: recipe.tags.slice(0, 3).join(', '),
        icon: ChefHat,
        path: `/recipes/${recipe.id}`,
        section: 'Recipes',
      })
    }
  }

  // Filter nav actions
  const matchedNav = q.length > 0
    ? navActions.filter(a => a.label.toLowerCase().includes(q))
    : navActions
  results.push(...matchedNav)

  // Filter quick actions
  const matchedQuick = q.length > 0
    ? quickActions.filter(a => a.label.toLowerCase().includes(q))
    : quickActions
  results.push(...matchedQuick)

  return results
})

// Group results by section
const groupedResults = computed(() => {
  const groups: Record<string, typeof filteredResults.value> = {}
  for (const item of filteredResults.value) {
    if (!groups[item.section]) groups[item.section] = []
    groups[item.section].push(item)
  }
  return groups
})

const totalResults = computed(() => filteredResults.value.length)

function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    selectedIndex.value = 0
    nextTick(() => inputRef.value?.focus())
  }
}

function close() {
  open.value = false
}

function executeItem(item: typeof filteredResults.value[0]) {
  close()
  if (item.action) {
    item.action()
  } else if (item.path) {
    router.push(item.path)
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % totalResults.value
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = (selectedIndex.value - 1 + totalResults.value) % totalResults.value
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = filteredResults.value[selectedIndex.value]
    if (item) executeItem(item)
  }
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    toggle()
  }
  if (e.key === 'Escape' && open.value) {
    close()
  }
}

watch(query, () => { selectedIndex.value = 0 })

onMounted(() => window.addEventListener('keydown', handleGlobalKeyDown))
onUnmounted(() => window.removeEventListener('keydown', handleGlobalKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4 bg-black/40 backdrop-blur-sm"
        @click.self="close"
      >
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
          appear
        >
          <div class="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
            <!-- Search input -->
            <div class="flex items-center gap-3 px-4 border-b border-border/40">
              <Search class="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                ref="inputRef"
                v-model="query"
                type="text"
                placeholder="Search recipes, pages, actions..."
                class="flex-1 h-14 bg-transparent text-foreground text-sm placeholder:text-muted-foreground/50 outline-none"
                @keydown="handleKeyDown"
              />
              <kbd class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono text-muted-foreground">ESC</kbd>
            </div>

            <!-- Results -->
            <div class="max-h-80 overflow-y-auto py-2">
              <template v-if="totalResults === 0">
                <div class="px-4 py-8 text-center">
                  <p class="text-sm text-muted-foreground">No results found for "{{ query }}"</p>
                </div>
              </template>

              <template v-else>
                <div v-for="(items, section) in groupedResults" :key="section">
                  <p class="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{{ section }}</p>
                  <button
                    v-for="(item, i) in items"
                    :key="item.id"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    :class="filteredResults.indexOf(item) === selectedIndex ? 'bg-primary/8 text-primary' : 'text-foreground hover:bg-muted/50'"
                    @click="executeItem(item)"
                    @mouseenter="selectedIndex = filteredResults.indexOf(item)"
                  >
                    <component :is="item.icon" class="w-4 h-4 shrink-0 opacity-60" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ item.label }}</p>
                      <p v-if="item.sublabel" class="text-[11px] text-muted-foreground truncate">{{ item.sublabel }}</p>
                    </div>
                    <ArrowRight class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 shrink-0" :class="filteredResults.indexOf(item) === selectedIndex ? 'opacity-40' : ''" />
                  </button>
                </div>
              </template>
            </div>

            <!-- Footer -->
            <div class="border-t border-border/40 px-4 py-2.5 flex items-center justify-between">
              <div class="flex items-center gap-3 text-[10px] text-muted-foreground/50">
                <span><kbd class="px-1 py-0.5 rounded bg-muted font-mono">↑↓</kbd> Navigate</span>
                <span><kbd class="px-1 py-0.5 rounded bg-muted font-mono">↵</kbd> Select</span>
                <span><kbd class="px-1 py-0.5 rounded bg-muted font-mono">Esc</kbd> Close</span>
              </div>
              <p class="text-[10px] text-muted-foreground/40">MealSync</p>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
