// ─── User & Auth ──────────────────────────────────────────────
export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  createdAt: string
}

export interface Session {
  accessToken: string
  refreshToken: string
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
  createdBy: string
  createdAt: string
  updatedAt: string
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

export type RecipeTag = string

// ─── Planner ──────────────────────────────────────────────────
export type MealType = 'breakfast' | 'lunch' | 'dinner'

export interface MealSlot {
  id: string
  date: string // YYYY-MM-DD
  mealType: MealType
  recipeId?: string
  recipe?: Recipe
  notes?: string
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
}

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
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
