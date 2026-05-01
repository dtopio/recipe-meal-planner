// ─── User & Auth ──────────────────────────────────────────────
export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  createdAt: string
  currentHouseholdId?: string
  healthTargets: HealthTargets
}

export interface Session {
  accessToken: string
  expiresAt: string
  user: User
}

export interface LoginDTO {
  email: string
  password: string
}

export interface RegisterDTO {
  displayName: string
  email: string
  password: string
}

// ─── Household ────────────────────────────────────────────────
export interface Household {
  id: string
  name: string
  color?: string
  avatarUrl?: string
  createdAt: string
  memberCount: number
}

export interface HouseholdMember {
  id: string
  userId: string
  householdId: string
  displayName: string
  avatarUrl?: string
  role: 'admin' | 'member'
  joinedAt: string
}

export interface InviteToken {
  code: string
  householdId: string
  expiresAt: string
  createdBy: string
}

export interface CreateHouseholdDTO {
  name: string
  color?: string
}

export interface JoinHouseholdDTO {
  inviteCode: string
}

// ─── Recipe ───────────────────────────────────────────────────
export interface RecipeIngredient {
  id: string
  quantity: number
  unit: string
  name: string
}

export interface Recipe {
  id: string
  householdId: string
  title: string
  description?: string
  imageUrl?: string
  prepTime: number
  cookTime: number
  servings: number
  tags: string[]
  ingredients: RecipeIngredient[]
  instructions: string[]
  sourceUrl?: string
  credits?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type DietaryPreference = 'vegetarian' | 'halal' | 'nut-free' | 'dairy-free'

export const DEFAULT_MEAL_PERIODS = ['breakfast', 'lunch', 'dinner'] as const

export interface RecipeDietaryProfile {
  compatibleWith: DietaryPreference[]
  warnings: string[]
}

export type NutritionConfidence = 'high' | 'medium' | 'low'

export interface NutritionTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface HealthTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export const DEFAULT_HEALTH_TARGETS: HealthTargets = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 70,
}

export interface IngredientNutritionEstimate extends NutritionTotals {
  ingredientId: string
  name: string
  quantity: number
  unit: string
  matchedFood: {
    fdcId: number
    description: string
    dataType: string
  } | null
  estimatedWeightGrams: number
  confidence: NutritionConfidence
}

export interface RecipeNutritionSummary {
  recipeId: string
  recipeTitle: string
  servings: number
  source: string
  estimatedAt: string
  total: NutritionTotals
  perServing: NutritionTotals
  ingredients: IngredientNutritionEstimate[]
}

export interface RecipeAiSummary {
  headline: string
  summary: string
  bestFor: string[]
  watchouts: string[]
  model: string
  generatedAt: string
}

export interface RecipeAiAskResponse {
  headline: string
  verdict: 'good-fit' | 'mixed' | 'not-ideal'
  answer: string
  bestTimes: string[]
  watchouts: string[]
  model: string
  generatedAt: string
  question: string
}

export interface CreateRecipeDTO {
  title: string
  description?: string
  imageUrl?: string
  prepTime: number
  cookTime: number
  servings: number
  tags: string[]
  ingredients: Omit<RecipeIngredient, 'id'>[]
  instructions: string[]
}

export interface UpdateRecipeDTO extends Partial<CreateRecipeDTO> {
  id: string
}

export interface ImportRecipeDTO {
  url: string
}

export interface RecipeReview {
  id: string
  recipeId: string
  userId: string
  userName: string
  rating: number
  note: string
  createdAt: string
  updatedAt: string
}

export interface RecipeReviewSummary {
  reviews: RecipeReview[]
  averageRating: number | null
  totalReviews: number
}

export type RecipeTag = string

// ─── Planner ──────────────────────────────────────────────────
export type MealType = string

export interface MealSlot {
  id: string
  date: string // YYYY-MM-DD
  mealType: MealType
  recipeId?: string
  recipe?: Recipe
  notes?: string
  servings?: number
  repeatWeekly?: boolean
  recurrenceId?: string
}

export interface MealAssignment {
  slotId: string
  recipeId: string
  date: string
  mealType: MealType
}

export interface WeekPlan {
  weekStart: string
  slots: MealSlot[]
}

export interface PlannerBatchActionSummary {
  weekStart: string
  sourceWeekStart?: string
  createdCount: number
  skippedCount: number
  slots: MealSlot[]
}

export interface WeeklyNutritionMeal {
  slotId: string
  mealType: MealType
  recipeId: string
  recipeTitle: string
  servings: number
  nutrition: NutritionTotals
}

export interface WeeklyNutritionDay {
  date: string
  total: NutritionTotals
  meals: WeeklyNutritionMeal[]
}

export interface WeeklyNutritionSummary {
  weekStart: string
  plannedMealCount: number
  source: string
  total: NutritionTotals
  perDay: WeeklyNutritionDay[]
}

// ─── Shopping ─────────────────────────────────────────────────
export type ShoppingCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'pantry'
  | 'frozen'
  | 'bakery'
  | 'household'
  | 'other'

export const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  'produce',
  'dairy',
  'meat',
  'pantry',
  'frozen',
  'bakery',
  'household',
  'other',
]

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: 'Produce',
  dairy: 'Dairy & Eggs',
  meat: 'Meat & Seafood',
  pantry: 'Pantry',
  frozen: 'Frozen',
  bakery: 'Bakery',
  household: 'Household',
  other: 'Other',
}

export const CATEGORY_EMOJI: Record<ShoppingCategory, string> = {
  produce: '🥬',
  dairy: '🥛',
  meat: '🥩',
  pantry: '🫙',
  frozen: '🧊',
  bakery: '🍞',
  household: '🧹',
  other: '📦',
}

export interface ShoppingListItem {
  id: string
  householdId: string
  name: string
  quantity: number
  unit: string
  category: ShoppingCategory
  checked: boolean
  sourceRecipeId?: string
  sourceRecipeName?: string
  addedBy: string
  addedAt: string
  syncStatus: 'synced' | 'pending' | 'error'
  generated?: boolean
  sourceWeekStart?: string
}

export type ShoppingPeriod = 'all' | 'day' | 'week' | 'month'

export interface ShoppingList {
  id: string
  householdId: string
  items: ShoppingListItem[]
  createdAt: string
  updatedAt: string
}

export interface AddShoppingItemDTO {
  name: string
  quantity: number
  unit: string
  category: ShoppingCategory
}

export interface ShoppingGenerationSummary {
  weekStart: string
  createdCount: number
  mergedIngredientCount: number
  pantryCoveredCount: number
  generatedItems: ShoppingListItem[]
}

export interface ShoppingAiSummary {
  headline: string
  summary: string
  alerts: string[]
  focus: string[]
  model: string
  generatedAt: string
  weekStart: string
  period: ShoppingPeriod
}

export interface PantryItem {
  id: string
  householdId: string
  name: string
  quantity: number
  unit: string
  category: ShoppingCategory
  lowStockThreshold: number
  expiresAt?: string
  updatedAt: string
}

export interface AddPantryItemDTO {
  name: string
  quantity: number
  unit: string
  category: ShoppingCategory
  lowStockThreshold: number
  expiresAt?: string
}

export interface UpdatePantryItemDTO extends Partial<AddPantryItemDTO> {
  id: string
}

export interface HouseholdPreferences {
  householdId: string
  dietaryPreferences: DietaryPreference[]
  mealPeriods: MealType[]
}

// ─── Sync ─────────────────────────────────────────────────────
export interface SyncEvent {
  type: 'shopping_list_item_updated' | 'shopping_list_item_added' | 'shopping_list_item_removed' | 'meal_plan_updated'
  payload: unknown
  timestamp: string
  userId: string
}

// ─── UI ───────────────────────────────────────────────────────
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

// ─── Utility types ────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
  details?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
