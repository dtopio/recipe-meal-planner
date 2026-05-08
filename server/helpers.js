import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import * as db from './db/index.js'
import { config } from './config.js'
import { logger } from './logger.js'
import { estimateRecipeNutrition } from './nutrition.js'
import { generateRecipeAskResponse, generateRecipeSummary, generateShoppingSummary } from './ai.js'
import {
  DEFAULT_HEALTH_TARGETS,
  DEFAULT_MEAL_PERIODS,
  MEAL_TYPES,
  addDays,
  createId,
  createInviteCode,
  guessShoppingCategory,
  ingredientMatchKey,
  parseDateKey,
  normalizeTags,
  nowIso,
  normalizeHealthTargets,
  normalizeMealPeriods,
  serializeUser,
  sortByCreatedDesc,
  startOfWeek,
  toDateKey,
} from './utils.js'

// ── Response helpers ─────────────────────────────────────────────

export function sendOk(res, data, message) {
  const payload = { data }
  if (message) payload.message = message
  res.json(payload)
}

// ── Pagination helper ───────────────────────────────────────────

export function paginate(items, query) {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200)
  const offset = Math.max(Number(query.offset) || 0, 0)
  const page = items.slice(offset, offset + limit)

  return {
    items: page,
    total: items.length,
    limit,
    offset,
    hasMore: offset + limit < items.length,
  }
}

export function sendError(res, statusCode, message, code, details) {
  const payload = { message, statusCode }
  if (code) payload.code = code
  if (details) payload.details = details
  res.status(statusCode).json(payload)
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

// ── Auth middleware ──────────────────────────────────────────────

export async function findCurrentUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  const session = await db.getSessionByToken(token)
  if (!session) return null

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.deleteSession(token)
    return null
  }

  const user = await db.getUserById(session.userId)
  if (!user) return null

  return { session, user }
}

export function requireAuth(req, res, next) {
  return asyncHandler(async (req, res, next) => {
    const auth = await findCurrentUser(req)
    if (!auth) {
      return sendError(res, 401, 'You must be signed in to continue', 'UNAUTHORIZED')
    }

    req.auth = auth
    next()
  })(req, res, next)
}

export function requireHousehold(req, res, next) {
  if (!req.auth?.user.currentHouseholdId) {
    return sendError(res, 400, 'No household is selected for this account', 'NO_HOUSEHOLD')
  }

  req.householdId = req.auth.user.currentHouseholdId
  next()
}

// ── Session helpers ─────────────────────────────────────────────

const MAX_SESSIONS_PER_USER = 5

export async function createSession(user) {
  const accessToken = `token_${randomUUID().replace(/-/g, '')}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()

  const session = await db.createSession({
    accessToken,
    userId: user.id,
    expiresAt,
  })

  return {
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    user: serializeUser(user),
  }
}

// ── Household helpers ───────────────────────────────────────────

export async function getHouseholdBundle(householdId) {
  const household = await db.getHouseholdById(householdId)

  if (!household) {
    return {
      household: null,
      members: [],
      invite: null,
    }
  }

  const members = await db.getMembersByHousehold(householdId)
  members.sort((left, right) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime())

  const invite = await db.getInviteByHousehold(householdId)

  return {
    household: {
      ...household,
      memberCount: members.length,
    },
    members,
    invite,
    preferences: await getHouseholdPreferences(householdId),
  }
}

export async function getHouseholdPreferences(householdId) {
  let preferences = await db.getPreferences(householdId)

  if (!preferences) {
    preferences = {
      householdId,
      dietaryPreferences: [],
      mealPeriods: [...DEFAULT_MEAL_PERIODS],
    }
    await db.upsertPreferences(householdId, preferences)
  } else {
    preferences.dietaryPreferences = Array.isArray(preferences.dietaryPreferences) ? preferences.dietaryPreferences : []
    preferences.mealPeriods = normalizeMealPeriods(preferences.mealPeriods)
  }

  return preferences
}

export async function updateHouseholdMemberSnapshots(userId) {
  const user = await db.getUserById(userId)
  if (!user) return

  const members = await db.getMembersByHousehold(user.currentHouseholdId || '')
  for (const member of members) {
    if (member.userId === userId) {
      await db.updateMember(member.id, {
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      })
    }
  }
}

// ── Recipe helpers ──────────────────────────────────────────────

export async function getRecipesForHousehold(householdId) {
  const recipes = await db.getRecipesByHousehold(householdId)
  return sortByCreatedDesc(recipes)
}

export async function getRecipeForHousehold(householdId, recipeId) {
  const recipe = await db.getRecipeById(recipeId)
  return recipe?.householdId === householdId ? recipe : null
}

export function getRecipeCacheKey(recipe) {
  return `${recipe.id}:${recipe.updatedAt}:${recipe.servings}`
}

export async function clearRecipeCaches(recipeId) {
  const keysToDelete = []

  const nutritionCache = await db.getMetaValue('nutritionCache:' + recipeId)
  if (nutritionCache) {
    for (const key of Object.keys(nutritionCache || {})) {
      if (key.startsWith(`${recipeId}:`)) {
        keysToDelete.push('nutritionCache:' + key)
      }
    }
  }

  const aiSummaryCache = await db.getMetaValue('aiSummaryCache:' + recipeId)
  if (aiSummaryCache) {
    for (const key of Object.keys(aiSummaryCache || {})) {
      if (key.startsWith(`${recipeId}:`)) {
        keysToDelete.push('aiSummaryCache:' + key)
      }
    }
  }

  const aiAskCache = await db.getMetaValue('aiAskCache:' + recipeId)
  if (aiAskCache) {
    for (const key of Object.keys(aiAskCache || {})) {
      if (key.startsWith(`${recipeId}:`)) {
        keysToDelete.push('aiAskCache:' + key)
      }
    }
  }

  if (keysToDelete.length > 0) {
    await db.deleteMetaKeys(keysToDelete)
  }
}

// ── Nutrition helpers ───────────────────────────────────────────

export function roundNutrition(value) {
  return Number(value.toFixed(1))
}

export function scaleNutritionValues(values, multiplier) {
  return {
    calories: roundNutrition(values.calories * multiplier),
    protein: roundNutrition(values.protein * multiplier),
    carbs: roundNutrition(values.carbs * multiplier),
    fat: roundNutrition(values.fat * multiplier),
  }
}

export function mergeNutritionValues(left, right) {
  return {
    calories: roundNutrition(left.calories + right.calories),
    protein: roundNutrition(left.protein + right.protein),
    carbs: roundNutrition(left.carbs + right.carbs),
    fat: roundNutrition(left.fat + right.fat),
  }
}

export async function getRecipeNutrition(recipe) {
  if (recipe.nutrition) {
    return createManualNutritionSummary(recipe)
  }

  if (!config.usdaApiKey) {
    const error = new Error('Recipe nutrition is not set and USDA nutrition support is not configured')
    error.code = 'NUTRITION_NOT_CONFIGURED'
    throw error
  }

  const cacheKey = getRecipeCacheKey(recipe)
  const cached = await db.getMetaValue('nutritionCache:' + cacheKey)
  if (cached && cached.perServing && cached.total && !isEmptyNutritionEstimate(cached)) {
    return cached
  }

  const nutrition = await estimateRecipeNutrition(recipe)
  await db.setMetaValue('nutritionCache:' + cacheKey, nutrition)
  return nutrition
}

function createManualNutritionSummary(recipe) {
  const total = normalizeNutritionTotals(recipe.nutrition)
  const servings = Math.max(recipe.servings || 1, 1)

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    servings,
    source: 'Manual',
    estimatedAt: recipe.updatedAt || nowIso(),
    total,
    perServing: {
      calories: roundNutrition(total.calories / servings),
      protein: roundNutrition(total.protein / servings),
      carbs: roundNutrition(total.carbs / servings),
      fat: roundNutrition(total.fat / servings),
    },
    ingredients: [],
  }
}

function normalizeNutritionTotals(value = {}) {
  return {
    calories: Number(value.calories || 0),
    protein: Number(value.protein || 0),
    carbs: Number(value.carbs || 0),
    fat: Number(value.fat || 0),
  }
}

function isEmptyNutritionEstimate(summary) {
  const total = summary?.total
  if (!total) return false

  const hasAnyNutrition = ['calories', 'protein', 'carbs', 'fat']
    .some(key => Number(total[key] || 0) > 0)
  if (hasAnyNutrition) return false

  const ingredients = Array.isArray(summary.ingredients) ? summary.ingredients : []
  return ingredients.length > 0 && ingredients.every(ingredient =>
    !ingredient.matchedFood && Number(ingredient.estimatedWeightGrams || 0) === 0
  )
}

// ── AI helpers ──────────────────────────────────────────────────

export async function getRecipeAiSummary(recipe) {
  if (!config.openrouterApiKey) {
    throw new Error('OpenRouter AI support is not configured')
  }

  const cacheKey = `${getRecipeCacheKey(recipe)}:${config.openrouterModel}`
  const cached = await db.getMetaValue('aiSummaryCache:' + cacheKey)
  if (cached) {
    return cached
  }

  const nutrition = await getRecipeNutrition(recipe)
  const summary = await generateRecipeSummary(recipe, nutrition)
  await db.setMetaValue('aiSummaryCache:' + cacheKey, summary)
  return summary
}

function normalizeQuestion(question) {
  return question.toLowerCase().trim()
}

export async function getRecipeAiAsk(recipe, question) {
  if (!config.openrouterApiKey) {
    throw new Error('OpenRouter AI support is not configured')
  }

  const normalizedQuestion = normalizeQuestion(question)
  const cacheKey = `${getRecipeCacheKey(recipe)}:${normalizedQuestion}`
  const cached = await db.getMetaValue('aiAskCache:' + cacheKey)
  if (cached) {
    return cached
  }

  const nutrition = await getRecipeNutrition(recipe)
  const response = await generateRecipeAskResponse(recipe, question, nutrition)
  await db.setMetaValue('aiAskCache:' + cacheKey, response)
  return response
}

// ── Meal planning helpers ───────────────────────────────────────

export async function getMealSlotsForWeek(householdId, startDate) {
  const endDate = addDays(startDate, 7)
  return getMealSlotsForRange(householdId, startDate, endDate)
}

export async function getMealSlotsForRange(householdId, startDate, endDate) {
  const assignments = await db.getAssignmentsByWeek(householdId, startDate, endDate)
  const recipes = await db.getRecipesByHousehold(householdId)
  const recipeMap = new Map(recipes.map(r => [r.id, r]))

  return assignments.map(assignment => ({
    ...assignment,
    recipe: recipeMap.get(assignment.recipeId),
  }))
}

export async function applyRecurringMealsForWeek(householdId, startDate) {
  const endDate = addDays(startDate, 7)
  const assignments = await db.getAssignmentsByHousehold(householdId)

  const recurringByRecurrence = new Map()
  for (const a of assignments) {
    if (a.repeatWeekly && a.recurrenceId) {
      if (!recurringByRecurrence.has(a.recurrenceId)) {
        recurringByRecurrence.set(a.recurrenceId, a)
      }
    }
  }

  const existingAssignments = await db.getAssignmentsByWeek(householdId, startDate, endDate)
  const existingKeys = new Set(existingAssignments.map(a => `${a.date}:${a.mealType}`))

  const toCreate = []
  for (const [, template] of recurringByRecurrence) {
    for (let offset = 0; offset < 7; offset++) {
      const date = addDays(startDate, offset)
      const dayOfWeek = new Date(date).getDay()
      const templateDayOfWeek = new Date(template.date).getDay()

      if (dayOfWeek === templateDayOfWeek) {
        const key = `${date}:${template.mealType}`
        if (!existingKeys.has(key)) {
          toCreate.push({
            id: createId('meal'),
            householdId,
            date,
            mealType: template.mealType,
            recipeId: template.recipeId,
            notes: template.notes,
            servings: template.servings,
            repeatWeekly: false,
          })
        }
      }
    }
  }

  if (toCreate.length > 0) {
    await db.createAssignments(toCreate)
  }

  const slots = await getMealSlotsForWeek(householdId, startDate)
  return {
    weekStart: startDate,
    createdCount: toCreate.length,
    skippedCount: 0,
    slots,
  }
}

export async function copyWeekPlan(householdId, targetStartDate) {
  const sourceStartDate = addDays(targetStartDate, -7)
  const sourceEndDate = addDays(sourceStartDate, 7)
  const sourceAssignments = await db.getAssignmentsByWeek(householdId, sourceStartDate, sourceEndDate)

  const targetEndDate = addDays(targetStartDate, 7)
  const targetAssignments = await db.getAssignmentsByWeek(householdId, targetStartDate, targetEndDate)
  const targetKeys = new Set(targetAssignments.map(a => `${a.date}:${a.mealType}`))

  const dayOffset = Math.round((parseDateKey(targetStartDate) - parseDateKey(sourceStartDate)) / 86400000)
  const toCreate = []

  for (const assignment of sourceAssignments) {
    const newDate = addDays(assignment.date, dayOffset)
    const key = `${newDate}:${assignment.mealType}`

    if (!targetKeys.has(key)) {
      toCreate.push({
        id: createId('meal'),
        householdId,
        date: newDate,
        mealType: assignment.mealType,
        recipeId: assignment.recipeId,
        notes: assignment.notes,
        servings: assignment.servings,
        repeatWeekly: false,
      })
    }
  }

  if (toCreate.length > 0) {
    await db.createAssignments(toCreate)
  }

  const slots = await getMealSlotsForWeek(householdId, targetStartDate)
  return {
    weekStart: targetStartDate,
    sourceWeekStart: sourceStartDate,
    createdCount: toCreate.length,
    skippedCount: sourceAssignments.length - toCreate.length,
    slots,
  }
}

// ── Shopping helpers ────────────────────────────────────────────

export async function buildShoppingGeneration(householdId, weekStart) {
  const slots = await getMealSlotsForWeek(householdId, weekStart)
  const pantryItems = await db.getPantryItems(householdId)
  const pantryMap = new Map()

  for (const item of pantryItems) {
    const key = ingredientMatchKey(item.name, item.unit)
    pantryMap.set(key, item)
  }

  const ingredients = {}

  for (const slot of slots) {
    if (!slot.recipe) continue

    const scaleFactor = (slot.servings || 1) / (slot.recipe.servings || 1)

    for (const ing of slot.recipe.ingredients || []) {
      const key = ingredientMatchKey(ing.name, ing.unit)
      const scaled = {
        ...ing,
        quantity: (ing.quantity || 0) * scaleFactor,
      }

      if (!ingredients[key]) {
        ingredients[key] = { ...scaled, count: 1 }
      } else {
        ingredients[key].quantity += scaled.quantity
        ingredients[key].count += 1
      }
    }
  }

  const generatedItems = []
  let mergedIngredientCount = 0
  let pantryCoveredCount = 0
  for (const [key, ing] of Object.entries(ingredients)) {
    if (ing.count > 1) mergedIngredientCount += 1
    if (pantryMap.has(key)) {
      pantryCoveredCount += 1
      continue
    }
    generatedItems.push({
      id: createId('shop'),
      householdId,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      category: guessShoppingCategory(ing.name),
      checked: false,
      generated: true,
      sourceWeekStart: weekStart,
      addedAt: nowIso(),
      syncStatus: 'synced',
    })
  }

  return {
    weekStart,
    generatedItems,
    mergedIngredientCount,
    pantryCoveredCount,
  }
}

export async function getShoppingSummaryInput(householdId) {
  const shoppingItems = await db.getShoppingItems(householdId)
  const pantryItems = await db.getPantryItems(householdId)

  return {
    shoppingItems: shoppingItems.filter(s => !s.checked),
    pantryItems: pantryItems.filter(p => {
      if (!p.lowStockThreshold || !p.quantity) return false
      return p.quantity <= p.lowStockThreshold
    }),
  }
}

export async function getShoppingListSummary(householdId, weekStart = '', period = 'all') {
  if (!config.openrouterApiKey) {
    return {
      headline: 'Shopping Summary',
      summary: `You have pending shopping items and low-stock pantry alerts.`,
      alerts: [],
      focus: [],
      model: 'builtin',
      generatedAt: nowIso(),
      weekStart,
      period,
    }
  }

  const input = await getShoppingSummaryInput(householdId)
  const aiResponse = await generateShoppingSummary(input)
  return {
    ...aiResponse,
    weekStart,
    period,
  }
}

export const getShoppingSummary = getShoppingListSummary

export function filterShoppingItemsByPeriod(items, period, weekStart) {
  if (period === 'all') return items

  const start = new Date(weekStart)
  let end
  if (period === 'day') {
    end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  } else if (period === 'week') {
    end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
  } else if (period === 'month') {
    end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
  } else {
    return items
  }

  return items.filter(item => {
    const addedAt = new Date(item.addedAt).getTime()
    return addedAt >= start.getTime() && addedAt < end.getTime()
  })
}

export async function getPeriodNutrition(householdId, {
  period = 'week',
  startDate,
  endDate,
  weekStart = '',
  month = '',
}) {
  const slots = await getMealSlotsForRange(householdId, startDate, endDate)
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const dayMap = new Map()
  const mealTypeCounts = {}
  let plannedMealCount = 0
  let missingNutritionCount = 0
  const missingMeals = []
  const nutritionSources = new Set()

  for (const slot of slots) {
    if (!slot.recipe) continue
    plannedMealCount += 1
    mealTypeCounts[slot.mealType] = (mealTypeCounts[slot.mealType] || 0) + 1

    if (!dayMap.has(slot.date)) {
      dayMap.set(slot.date, {
        date: slot.date,
        total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        meals: [],
        missingMeals: [],
        plannedMealCount: 0,
        missingNutritionCount: 0,
      })
    }
    const day = dayMap.get(slot.date)
    day.plannedMealCount += 1

    try {
      const nutrition = await getRecipeNutrition(slot.recipe)
      nutritionSources.add(nutrition.source)
      const recipeTotal = nutrition.total || nutrition.totals
      if (!recipeTotal) {
        throw new Error('Nutrition estimate did not include totals')
      }
      const multiplier = (slot.servings || slot.recipe.servings || 1) / (slot.recipe.servings || 1)
      const scaled = roundNutritionTotals(scaleNutritionValues(recipeTotal, multiplier))
      total.calories += scaled.calories || 0
      total.protein += scaled.protein || 0
      total.carbs += scaled.carbs || 0
      total.fat += scaled.fat || 0

      day.total.calories += scaled.calories || 0
      day.total.protein += scaled.protein || 0
      day.total.carbs += scaled.carbs || 0
      day.total.fat += scaled.fat || 0
      day.meals.push({
        slotId: slot.id,
        mealType: slot.mealType,
        recipeId: slot.recipeId,
        recipeTitle: slot.recipe.title,
        servings: slot.servings || slot.recipe.servings || 1,
        nutrition: scaled,
      })
    } catch (error) {
      missingNutritionCount += 1
      day.missingNutritionCount += 1
      const missingMeal = {
        slotId: slot.id,
        date: slot.date,
        mealType: slot.mealType,
        recipeId: slot.recipeId,
        recipeTitle: slot.recipe.title,
        servings: slot.servings || slot.recipe.servings || 1,
      }
      missingMeals.push(missingMeal)
      day.missingMeals.push(missingMeal)
      logger.warn('Failed to compute nutrition for slot', { slotId: slot.id, error: error.message })
    }
  }

  const perDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  return {
    period,
    startDate,
    endDate,
    weekStart: weekStart || (period === 'week' ? startDate : undefined),
    month: month || undefined,
    plannedMealCount,
    missingNutritionCount,
    missingMeals,
    mealTypeCounts,
    source: nutritionSources.size > 0 ? Array.from(nutritionSources).join(' + ') : 'Recipe nutrition',
    total: roundNutritionTotals(total),
    perDay: perDay.map(day => ({
      ...day,
      total: roundNutritionTotals(day.total),
    })),
  }
}

export async function getWeekNutrition(householdId, weekStartDate) {
  return getPeriodNutrition(householdId, {
    period: 'week',
    startDate: weekStartDate,
    endDate: addDays(weekStartDate, 7),
    weekStart: weekStartDate,
  })
}

function roundNutritionTotals(totals) {
  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
  }
}
