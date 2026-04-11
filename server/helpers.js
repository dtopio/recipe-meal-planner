import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from './db.js'
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

export function findCurrentUser(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  const session = db.sessionIndex.get(token)
  if (!session) return null

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    db.data.sessions = db.data.sessions.filter(candidate => candidate.accessToken !== token)
    db.sessionIndex.delete(token)
    return null
  }

  const user = db.data.users.find(candidate => candidate.id === session.userId)
  if (!user) return null

  return { session, user }
}

export function requireAuth(req, res, next) {
  const auth = findCurrentUser(req)
  if (!auth) {
    return sendError(res, 401, 'You must be signed in to continue', 'UNAUTHORIZED')
  }

  req.auth = auth
  next()
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

export function createSession(user) {
  const accessToken = `token_${randomUUID().replace(/-/g, '')}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() // 30 days

  // Cap sessions per user instead of wiping all existing ones
  const userSessions = db.data.sessions
    .filter(candidate => candidate.userId === user.id)
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())

  if (userSessions.length >= MAX_SESSIONS_PER_USER) {
    const toRemove = userSessions.slice(0, userSessions.length - MAX_SESSIONS_PER_USER + 1)
    const removeSet = new Set(toRemove.map(s => s.accessToken))
    db.data.sessions = db.data.sessions.filter(s => !removeSet.has(s.accessToken))
    for (const s of toRemove) db.sessionIndex.delete(s.accessToken)
  }

  const session = {
    userId: user.id,
    accessToken,
    expiresAt,
  }

  db.data.sessions.push(session)
  db.sessionIndex.set(accessToken, session)

  return {
    accessToken,
    expiresAt,
    user: serializeUser(user),
  }
}

// ── Household helpers ───────────────────────────────────────────

export function getHouseholdBundle(householdId) {
  const household = db.data.households.find(candidate => candidate.id === householdId) || null

  if (!household) {
    return {
      household: null,
      members: [],
      invite: null,
    }
  }

  const members = db.data.householdMembers
    .filter(candidate => candidate.householdId === householdId)
    .sort((left, right) => new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime())

  const invite = db.data.invites.find(candidate => candidate.householdId === householdId) || null

  return {
    household: {
      ...household,
      memberCount: members.length,
    },
    members,
    invite,
    preferences: getHouseholdPreferences(householdId),
  }
}

export function getHouseholdPreferences(householdId) {
  let preferences = db.data.householdPreferences.find(candidate => candidate.householdId === householdId)

  if (!preferences) {
    preferences = {
      householdId,
      dietaryPreferences: [],
      mealPeriods: [...DEFAULT_MEAL_PERIODS],
    }
    db.data.householdPreferences.push(preferences)
  } else {
    preferences.dietaryPreferences = Array.isArray(preferences.dietaryPreferences) ? preferences.dietaryPreferences : []
    preferences.mealPeriods = normalizeMealPeriods(preferences.mealPeriods)
  }

  return preferences
}

export function updateHouseholdMemberSnapshots(userId) {
  const user = db.data.users.find(candidate => candidate.id === userId)
  if (!user) return

  db.data.householdMembers = db.data.householdMembers.map(member => (
    member.userId === userId
      ? {
          ...member,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        }
      : member
  ))
}

// ── Recipe helpers ──────────────────────────────────────────────

export function getRecipesForHousehold(householdId) {
  return sortByCreatedDesc(
    db.data.recipes.filter(recipe => recipe.householdId === householdId)
  )
}

export function getRecipeForHousehold(householdId, recipeId) {
  return db.data.recipes.find(recipe => recipe.householdId === householdId && recipe.id === recipeId)
}

export function getRecipeCacheKey(recipe) {
  return `${recipe.id}:${recipe.updatedAt}:${recipe.servings}`
}

export function clearRecipeCaches(recipeId) {
  for (const key of Object.keys(db.data.meta.nutritionCache || {})) {
    if (key.startsWith(`${recipeId}:`)) {
      delete db.data.meta.nutritionCache[key]
    }
  }

  for (const key of Object.keys(db.data.meta.aiSummaryCache || {})) {
    if (key.startsWith(`${recipeId}:`)) {
      delete db.data.meta.aiSummaryCache[key]
    }
  }

  for (const key of Object.keys(db.data.meta.aiAskCache || {})) {
    if (key.startsWith(`${recipeId}:`)) {
      delete db.data.meta.aiAskCache[key]
    }
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
  if (!config.usdaApiKey) {
    throw new Error('USDA nutrition support is not configured')
  }

  const cacheKey = getRecipeCacheKey(recipe)
  const cached = db.data.meta.nutritionCache?.[cacheKey]
  if (cached) {
    return cached
  }

  const nutrition = await estimateRecipeNutrition(recipe)
  db.data.meta.nutritionCache[cacheKey] = nutrition
  await db.save()
  return nutrition
}

// ── AI helpers ──────────────────────────────────────────────────

export async function getRecipeAiSummary(recipe) {
  if (!config.openrouterApiKey) {
    throw new Error('OpenRouter AI support is not configured')
  }

  const cacheKey = `${getRecipeCacheKey(recipe)}:${config.openrouterModel}`
  const cached = db.data.meta.aiSummaryCache?.[cacheKey]
  if (cached) {
    return cached
  }

  const nutrition = await getRecipeNutrition(recipe)
  const summary = await generateRecipeSummary(recipe, nutrition)
  db.data.meta.aiSummaryCache[cacheKey] = summary
  await db.save()
  return summary
}

function normalizeQuestion(question) {
  return String(question || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function getRecipeAskCacheKey(recipe, question, healthTargets = null) {
  const targetKey = healthTargets
    ? `${healthTargets.calories}-${healthTargets.protein}-${healthTargets.carbs}-${healthTargets.fat}`
    : 'default-targets'

  return `${getRecipeCacheKey(recipe)}:${normalizeQuestion(question)}:${targetKey}:${config.openrouterModel || 'default'}`
}

export function buildFallbackRecipeAskResponse(recipe, question, nutrition = null, healthTargets = null) {
  const normalizedQuestion = normalizeQuestion(question)
  const totalMinutes = recipe.prepTime + recipe.cookTime
  const ingredientNames = recipe.ingredients.map(ingredient => ingredient.name.toLowerCase())
  const tags = recipe.tags.map(tag => tag.toLowerCase())
  const hasBreakfastSignals = ingredientNames.some(name => /egg|oat|banana|berry|yogurt|toast|bread|pancake|granola/.test(name))
    || tags.some(tag => /breakfast|brunch|sweet/.test(tag))
  const hasHeartySignals = ingredientNames.some(name => /beef|pork|cream|cheese|pasta|rice|potato|curry|stew/.test(name))
    || tags.some(tag => /dinner|comfort|hearty/.test(tag))
  const hasPrepFriendlySignals = totalMinutes <= 45 && recipe.instructions.length <= 8
  const perServing = nutrition?.perServing || null
  const watchouts = []
  const bestTimes = []
  const calorieTarget = healthTargets?.calories || DEFAULT_HEALTH_TARGETS.calories
  const proteinTarget = healthTargets?.protein || DEFAULT_HEALTH_TARGETS.protein
  let verdict = 'mixed'
  let headline = 'Practical fit check'
  let answer = `${recipe.title} can work, but it depends on the meal timing and how much prep you want to do.`

  if (normalizedQuestion.includes('breakfast')) {
    headline = 'Breakfast fit'
    if (hasBreakfastSignals && totalMinutes <= 30) {
      verdict = 'good-fit'
      answer = `${recipe.title} is a good breakfast option because it fits a lighter morning profile and should not take too long to get on the table.`
      bestTimes.push('breakfast', 'weekend brunch')
    } else if (hasHeartySignals || totalMinutes > 45) {
      verdict = 'not-ideal'
      answer = `${recipe.title} is probably too heavy or time-consuming for a normal breakfast unless you are planning a slow brunch.`
      bestTimes.push('brunch', 'dinner')
      watchouts.push('May feel heavy early in the day')
    } else {
      bestTimes.push('breakfast', 'brunch')
      watchouts.push('Better when you have a bit more morning time')
    }
  } else if (normalizedQuestion.includes('lunch')) {
    headline = 'Lunch fit'
    if (totalMinutes <= 35) {
      verdict = 'good-fit'
      answer = `${recipe.title} fits lunch well because the prep is manageable and the portion size should work for a midday meal.`
      bestTimes.push('lunch', 'work-from-home lunch')
    } else {
      answer = `${recipe.title} can work for lunch, but it is better when you have time for a slower prep or when leftovers are available.`
      bestTimes.push('lunch', 'weekend lunch')
      watchouts.push('Not ideal for a rushed midday schedule')
    }
  } else if (normalizedQuestion.includes('dinner')) {
    headline = 'Dinner fit'
    if (hasHeartySignals || totalMinutes >= 20) {
      verdict = 'good-fit'
      answer = `${recipe.title} is a strong dinner option because it has a more substantial profile and suits an evening meal.`
      bestTimes.push('dinner', 'family dinner')
    } else {
      answer = `${recipe.title} can be dinner, but it may feel light unless you pair it with sides or extra portions.`
      bestTimes.push('light dinner', 'lunch')
      watchouts.push('May need a side dish for a fuller dinner')
    }
  } else if (normalizedQuestion.includes('meal prep') || normalizedQuestion.includes('meal-prep') || normalizedQuestion.includes('leftover')) {
    headline = 'Meal prep fit'
    if (hasPrepFriendlySignals && recipe.servings >= 3) {
      verdict = 'good-fit'
      answer = `${recipe.title} looks practical for meal prep because the steps are manageable and the recipe already makes multiple servings.`
      bestTimes.push('meal prep', 'next-day lunch')
    } else {
      answer = `${recipe.title} is usable for meal prep, but it is better if you are fine cooking more often or scaling the recipe up.`
      bestTimes.push('meal prep', 'fresh same-day meal')
      watchouts.push('May need batch scaling for multiple containers')
    }
  } else if (normalizedQuestion.includes('snack')) {
    headline = 'Snack fit'
    if (totalMinutes <= 20 && !hasHeartySignals) {
      verdict = 'good-fit'
      answer = `${recipe.title} could work as a more filling snack because it is relatively quick and not too heavy.`
      bestTimes.push('afternoon snack', 'light bite')
    } else {
      verdict = 'not-ideal'
      answer = `${recipe.title} is probably more of a full meal than a snack because of the prep time or overall heft.`
      bestTimes.push('lunch', 'dinner')
      watchouts.push('More effort than a typical snack')
    }
  } else if (normalizedQuestion.includes('healthy') || normalizedQuestion.includes('health') || normalizedQuestion.includes('weight loss') || normalizedQuestion.includes('weight-loss')) {
    headline = 'Health fit'
    if (perServing && perServing.calories <= 550 && perServing.protein >= 25 && perServing.fat <= 25) {
      verdict = 'good-fit'
      answer = `${recipe.title} looks like a strong health-focused option because it keeps calories reasonable and delivers solid protein per serving.`
      bestTimes.push('balanced lunch', 'balanced dinner')
    } else if (perServing && perServing.calories >= Math.max(calorieTarget * 0.5, 800) && perServing.protein < Math.max(proteinTarget * 0.15, 20)) {
      verdict = 'not-ideal'
      answer = `${recipe.title} is probably not the best fit for a health-focused goal because the calories run high without much protein support.`
      bestTimes.push('occasional dinner')
      watchouts.push('High calories for a regular goal-driven meal')
    } else {
      answer = `${recipe.title} can fit a healthy plan, but it depends on your portion size and how well it lines up with your calorie and protein targets.`
      bestTimes.push('balanced meal')
    }
  } else if (normalizedQuestion.includes('protein')) {
    headline = 'Protein fit'
    if (perServing && perServing.protein >= Math.max(30, proteinTarget * 0.25)) {
      verdict = 'good-fit'
      answer = `${recipe.title} is a solid protein-focused choice because it gives a strong amount of protein per serving.`
      bestTimes.push('post-workout meal', 'high-protein lunch', 'high-protein dinner')
    } else if (perServing && perServing.protein < 15) {
      verdict = 'not-ideal'
      answer = `${recipe.title} is not especially protein-forward on its own, so it may need a side or ingredient swap if protein is your focus.`
      bestTimes.push('light meal')
      watchouts.push('Low protein for a goal-focused meal')
    } else {
      answer = `${recipe.title} has some protein, but it is more moderate than high-protein.`
      bestTimes.push('balanced meal')
    }
  } else {
    if (hasBreakfastSignals) bestTimes.push('breakfast')
    if (hasHeartySignals) bestTimes.push('dinner')
    if (!bestTimes.length) bestTimes.push('lunch')
    answer = `${recipe.title} can fit ${bestTimes.join(' or ')}, depending on portion size and how much time you have to cook.`
  }

  if (totalMinutes > 60) {
    watchouts.push('Longer cook time')
  }

  if (recipe.ingredients.length > 12) {
    watchouts.push('Ingredient list is a bit involved')
  }

  if (perServing && perServing.calories > 750) {
    watchouts.push('Higher-calorie serving')
  }

  return {
    headline,
    verdict,
    answer,
    bestTimes: Array.from(new Set(bestTimes)).slice(0, 3),
    watchouts: Array.from(new Set(watchouts)).slice(0, 3),
    model: 'heuristic',
    generatedAt: nowIso(),
    question: String(question || '').trim(),
  }
}

export async function getRecipeAiAskResponse(recipe, question, healthTargets = null) {
  const nq = normalizeQuestion(question)
  const cacheKey = getRecipeAskCacheKey(recipe, nq, healthTargets)
  const cached = db.data.meta.aiAskCache?.[cacheKey]
  if (cached) {
    return cached
  }

  let nutrition = null
  if (config.usdaApiKey) {
    try {
      nutrition = await getRecipeNutrition(recipe)
    } catch (error) {
      logger.warn('Nutrition lookup failed for recipe ask, continuing without', { error: error.message })
      nutrition = null
    }
  }

  let response

  if (!config.openrouterApiKey) {
    response = buildFallbackRecipeAskResponse(recipe, nq, nutrition, healthTargets)
  } else {
    try {
      response = await generateRecipeAskResponse(recipe, nq, nutrition, healthTargets)
      response.question = nq
    } catch (error) {
      logger.warn('AI recipe ask failed, using heuristic fallback', { error: error.message })
      response = buildFallbackRecipeAskResponse(recipe, nq, nutrition, healthTargets)
    }
  }

  if (response.model === 'heuristic') {
    return response
  }

  db.data.meta.aiAskCache[cacheKey] = response
  await db.save()
  return response
}

// ── Planner helpers ─────────────────────────────────────────────

function buildMealSlot(assignment, recipes) {
  const recipe = recipes.find(candidate => candidate.id === assignment.recipeId)

  return {
    id: assignment.id,
    date: assignment.date,
    mealType: assignment.mealType,
    recipeId: assignment.recipeId,
    recipe,
    notes: assignment.notes,
    servings: assignment.servings || recipe?.servings,
    repeatWeekly: Boolean(assignment.repeatWeekly),
    recurrenceId: assignment.recurrenceId || undefined,
  }
}

function getMealTypeOrder(mealPeriods, mealType) {
  const mealPeriodIndex = mealPeriods.indexOf(mealType)
  return mealPeriodIndex === -1 ? MEAL_TYPES.length + 10 : mealPeriodIndex
}

function sortMealSlots(slots, mealPeriods) {
  return slots.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date)
    }

    const mealTypeOrder = getMealTypeOrder(mealPeriods, left.mealType) - getMealTypeOrder(mealPeriods, right.mealType)
    if (mealTypeOrder !== 0) {
      return mealTypeOrder
    }

    if (left.mealType !== right.mealType) {
      return left.mealType.localeCompare(right.mealType)
    }

    return left.id.localeCompare(right.id)
  })
}

function getWeekOffset(dateKey) {
  const day = parseDateKey(dateKey).getDay()
  return day === 0 ? 6 : day - 1
}

export function getMealSlotsForWeek(householdId, weekStart) {
  const recipes = getRecipesForHousehold(householdId)
  const mealPeriods = getHouseholdPreferences(householdId).mealPeriods
  const weekStartDate = typeof weekStart === 'string' && weekStart
    ? weekStart
    : toDateKey(startOfWeek())
  const weekDates = new Set(Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)))

  return sortMealSlots(
    db.data.mealAssignments
      .filter(candidate => candidate.householdId === householdId && weekDates.has(candidate.date))
      .map(assignment => buildMealSlot(assignment, recipes)),
    mealPeriods,
  )
}

export function copyWeekPlan(householdId, targetWeekStart, sourceWeekStart = addDays(targetWeekStart, -7)) {
  const sourceSlots = getMealSlotsForWeek(householdId, sourceWeekStart)
  const createdAssignments = []
  let skippedCount = 0

  for (const slot of sourceSlots) {
    const targetDate = addDays(targetWeekStart, getWeekOffset(slot.date))
    const exists = db.data.mealAssignments.some(candidate => (
      candidate.householdId === householdId &&
      candidate.date === targetDate &&
      candidate.mealType === slot.mealType &&
      candidate.recipeId === slot.recipeId
    ))

    if (exists) {
      skippedCount++
      continue
    }

    createdAssignments.push({
      id: createId('slot'),
      householdId,
      date: targetDate,
      mealType: slot.mealType,
      recipeId: slot.recipeId,
      notes: slot.notes || '',
      servings: slot.servings,
      repeatWeekly: Boolean(slot.repeatWeekly),
      recurrenceId: slot.recurrenceId || undefined,
    })
  }

  if (createdAssignments.length > 0) {
    db.data.mealAssignments.push(...createdAssignments)
  }

  return {
    weekStart: targetWeekStart,
    sourceWeekStart,
    createdCount: createdAssignments.length,
    skippedCount,
    slots: getMealSlotsForWeek(householdId, targetWeekStart),
  }
}

export function applyRecurringMealsForWeek(householdId, targetWeekStart) {
  const targetWeekDates = new Set(Array.from({ length: 7 }, (_, index) => addDays(targetWeekStart, index)))
  const latestByRecurrence = new Map()

  for (const assignment of db.data.mealAssignments) {
    if (
      assignment.householdId !== householdId ||
      !assignment.recurrenceId ||
      assignment.date >= targetWeekStart
    ) {
      continue
    }

    const previous = latestByRecurrence.get(assignment.recurrenceId)
    if (!previous || assignment.date > previous.date) {
      latestByRecurrence.set(assignment.recurrenceId, assignment)
    }
  }

  const createdAssignments = []
  let skippedCount = 0

  for (const latest of latestByRecurrence.values()) {
    if (!latest.repeatWeekly) {
      continue
    }

    const targetDate = addDays(targetWeekStart, getWeekOffset(latest.date))
    const exists = db.data.mealAssignments.some(candidate => (
      candidate.householdId === householdId &&
      (
        (candidate.recurrenceId && candidate.recurrenceId === latest.recurrenceId && targetWeekDates.has(candidate.date))
        || (
          candidate.date === targetDate &&
          candidate.mealType === latest.mealType &&
          candidate.recipeId === latest.recipeId
        )
      )
    ))

    if (exists) {
      skippedCount++
      continue
    }

    createdAssignments.push({
      id: createId('slot'),
      householdId,
      date: targetDate,
      mealType: latest.mealType,
      recipeId: latest.recipeId,
      notes: latest.notes || '',
      servings: latest.servings,
      repeatWeekly: true,
      recurrenceId: latest.recurrenceId,
    })
  }

  if (createdAssignments.length > 0) {
    db.data.mealAssignments.push(...createdAssignments)
  }

  return {
    weekStart: targetWeekStart,
    createdCount: createdAssignments.length,
    skippedCount,
    slots: getMealSlotsForWeek(householdId, targetWeekStart),
  }
}

export async function getWeekNutrition(householdId, weekStart) {
  const slots = getMealSlotsForWeek(householdId, weekStart).filter(slot => slot.recipe)

  // Fetch all nutrition data in parallel instead of sequentially
  const uniqueRecipes = new Map()
  for (const slot of slots) {
    if (slot.recipe && !uniqueRecipes.has(slot.recipe.id)) {
      uniqueRecipes.set(slot.recipe.id, slot.recipe)
    }
  }

  const nutritionResults = await Promise.all(
    Array.from(uniqueRecipes.values()).map(async recipe => {
      const nutrition = await getRecipeNutrition(recipe)
      return [recipe.id, nutrition]
    })
  )
  const nutritionMap = new Map(nutritionResults)

  const daily = new Map()
  let total = { calories: 0, protein: 0, carbs: 0, fat: 0 }

  for (const slot of slots) {
    const recipe = slot.recipe
    if (!recipe) continue

    const recipeNutrition = nutritionMap.get(recipe.id)
    if (!recipeNutrition) continue

    const multiplier = recipe.servings > 0 && slot.servings
      ? slot.servings / recipe.servings
      : 1
    const contribution = scaleNutritionValues(recipeNutrition.total, multiplier)

    total = mergeNutritionValues(total, contribution)

    const dayEntry = daily.get(slot.date) || {
      date: slot.date,
      total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      meals: [],
    }

    dayEntry.total = mergeNutritionValues(dayEntry.total, contribution)
    dayEntry.meals.push({
      slotId: slot.id,
      mealType: slot.mealType,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      servings: slot.servings || recipe.servings,
      nutrition: contribution,
    })

    daily.set(slot.date, dayEntry)
  }

  return {
    weekStart,
    plannedMealCount: slots.length,
    source: 'USDA FoodData Central',
    total,
    perDay: Array.from(daily.values()).sort((left, right) => left.date.localeCompare(right.date)),
  }
}

// ── Shopping helpers ────────────────────────────────────────────

export function buildShoppingGeneration(householdId, weekStart) {
  const slots = getMealSlotsForWeek(householdId, weekStart).filter(slot => slot.recipe)
  const pantryItems = db.data.pantryItems.filter(item => item.householdId === householdId)
  const pantryQuantities = new Map()
  const ingredientTotals = new Map()

  for (const item of pantryItems) {
    const key = ingredientMatchKey(item.name, item.unit)
    pantryQuantities.set(key, (pantryQuantities.get(key) || 0) + item.quantity)
  }

  for (const slot of slots) {
    const recipe = slot.recipe
    if (!recipe) continue

    const multiplier = recipe.servings > 0 && slot.servings
      ? slot.servings / recipe.servings
      : 1

    for (const ingredient of recipe.ingredients) {
      const key = ingredientMatchKey(ingredient.name, ingredient.unit)
      const current = ingredientTotals.get(key) || {
        name: ingredient.name,
        quantity: 0,
        unit: ingredient.unit,
        category: guessShoppingCategory(ingredient.name),
        recipeNames: new Set(),
      }

      current.quantity += ingredient.quantity * multiplier
      current.recipeNames.add(recipe.title)
      ingredientTotals.set(key, current)
    }
  }

  let pantryCoveredCount = 0
  const generatedItems = []

  for (const ingredient of ingredientTotals.values()) {
    const key = ingredientMatchKey(ingredient.name, ingredient.unit)
    const available = pantryQuantities.get(key) || 0
    const missingQuantity = Math.max(ingredient.quantity - available, 0)

    if (available > 0) {
      pantryCoveredCount++
    }

    if (missingQuantity <= 0) {
      continue
    }

    generatedItems.push({
      id: createId('item'),
      householdId,
      name: ingredient.name,
      quantity: Number(missingQuantity.toFixed(2)),
      unit: ingredient.unit,
      category: ingredient.category,
      checked: false,
      sourceRecipeName: ingredient.recipeNames.size === 1
        ? Array.from(ingredient.recipeNames)[0]
        : `${ingredient.recipeNames.size} planned meals`,
      addedBy: 'system',
      addedAt: nowIso(),
      syncStatus: 'synced',
      generated: true,
      sourceWeekStart: weekStart,
    })
  }

  return {
    weekStart,
    mergedIngredientCount: ingredientTotals.size,
    pantryCoveredCount,
    generatedItems,
  }
}

function getShoppingItemDateKey(item) {
  return toDateKey(item.addedAt)
}

export function filterShoppingItemsByPeriod(items, period, weekStart) {
  if (period === 'all') {
    return items
  }

  const today = toDateKey(new Date())
  const currentWeekStart = weekStart || toDateKey(startOfWeek())
  const currentMonthPrefix = today.slice(0, 7)

  return items.filter(item => {
    const itemDate = getShoppingItemDateKey(item)

    if (period === 'day') {
      return itemDate === today
    }

    if (period === 'week') {
      return itemDate >= currentWeekStart && itemDate <= addDays(currentWeekStart, 6)
    }

    if (period === 'month') {
      return itemDate.startsWith(currentMonthPrefix)
    }

    return true
  })
}

function getShoppingSummaryInput(householdId, weekStart, period = 'all') {
  const preferences = getHouseholdPreferences(householdId)
  const uncheckedItems = filterShoppingItemsByPeriod(
    db.data.shoppingItems
      .filter(item => item.householdId === householdId && !item.checked)
      .sort((left, right) => new Date(left.addedAt).getTime() - new Date(right.addedAt).getTime()),
    period,
    weekStart,
  )
  const pantryLowStockItems = db.data.pantryItems
    .filter(item => item.householdId === householdId && item.quantity <= item.lowStockThreshold)
    .sort((left, right) => left.quantity - right.quantity)
  const categoryCounts = Object.entries(uncheckedItems.reduce((accumulator, item) => {
    accumulator[item.category] = (accumulator[item.category] || 0) + 1
    return accumulator
  }, {}))
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count)

  const weekGeneratedItems = uncheckedItems.filter(item => item.generated && item.sourceWeekStart === weekStart)
  const preferenceAlerts = []

  if (preferences.dietaryPreferences.includes('vegetarian') && uncheckedItems.some(item => item.category === 'meat')) {
    preferenceAlerts.push('Vegetarian household preference is active, but the list still contains meat items.')
  }

  if (preferences.dietaryPreferences.includes('dairy-free') && uncheckedItems.some(item => item.category === 'dairy')) {
    preferenceAlerts.push('Dairy-free household preference is active, but the list still contains dairy items.')
  }

  return {
    weekStart,
    period,
    totalItems: uncheckedItems.length,
    generatedItemCount: weekGeneratedItems.length,
    preferences: preferences.dietaryPreferences,
    categoryCounts,
    items: uncheckedItems.slice(0, 40).map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      sourceRecipeName: item.sourceRecipeName,
      generated: Boolean(item.generated),
    })),
    pantryLowStockItems: pantryLowStockItems.slice(0, 10).map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      threshold: item.lowStockThreshold,
    })),
    preferenceAlerts,
  }
}

function buildFallbackShoppingSummary(input) {
  const topCategories = input.categoryCounts.slice(0, 3).map(entry => entry.category)
  const alerts = []

  if (input.totalItems >= 25) {
    alerts.push('This is a large shop. Split it by aisle or store section before you go.')
  }

  if (input.pantryLowStockItems.length > 0) {
    const lowStockNames = input.pantryLowStockItems.slice(0, 2).map(item => item.name).join(', ')
    alerts.push(`Pantry is running low on ${lowStockNames}.`)
  }

  alerts.push(...input.preferenceAlerts.slice(0, 3 - alerts.length))

  return {
    headline: input.totalItems === 0
      ? 'Shopping list is clear'
      : `${input.totalItems} items ready to shop`,
    summary: input.totalItems === 0
      ? 'There are no unchecked shopping items right now. Generate a list from the planner or add items manually.'
      : `Your active list is concentrated in ${topCategories.join(', ') || 'multiple categories'}. ${input.generatedItemCount > 0 ? `${input.generatedItemCount} items came from the current meal plan.` : 'This list currently mixes manual and generated items.'}`,
    alerts,
    focus: topCategories,
    model: 'heuristic',
    generatedAt: nowIso(),
  }
}

export async function getShoppingSummary(householdId, weekStart, period = 'all') {
  const input = getShoppingSummaryInput(householdId, weekStart, period)

  if (input.totalItems === 0) {
    return buildFallbackShoppingSummary(input)
  }

  if (!config.openrouterApiKey) {
    return buildFallbackShoppingSummary(input)
  }

  try {
    return await generateShoppingSummary(input)
  } catch (error) {
    logger.warn('AI shopping summary failed, using heuristic fallback', { error: error.message })
    return buildFallbackShoppingSummary(input)
  }
}
