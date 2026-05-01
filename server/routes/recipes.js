import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { config } from '../config.js'
import { importRecipeFromUrl } from '../recipe-import.js'
import { createId, normalizeTags, nowIso } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  requireAuth,
  requireHousehold,
  paginate,
  getRecipesForHousehold,
  getRecipeForHousehold,
  getRecipeNutrition,
  getRecipeAiSummary,
  getRecipeAiAskResponse,
  clearRecipeCaches,
} from '../helpers.js'

const router = Router()

const createRecipeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().url().max(500).optional(),
  prepTime: z.number().int().min(0).max(1440),
  cookTime: z.number().int().min(0).max(1440),
  servings: z.number().positive().max(100),
  tags: z.array(z.string().max(30)).max(20),
  ingredients: z.array(z.object({
    quantity: z.number().nonnegative().max(10000),
    unit: z.string().max(30),
    name: z.string().trim().min(1).max(100),
  })).min(1).max(100),
  instructions: z.array(z.string().trim().min(1).max(2000)).min(1).max(50),
})

const updateRecipeSchema = createRecipeSchema.partial()

const importRecipeSchema = z.object({
  url: z.string().trim().url(),
})

const recipeAskSchema = z.object({
  question: z.string().trim().min(3).max(500),
})

const recipeReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().max(500).optional(),
})

router.get('/', requireAuth, requireHousehold, (req, res) => {
  const all = getRecipesForHousehold(req.householdId)
  sendOk(res, paginate(all, req.query))
})

router.get('/:recipeId', requireAuth, requireHousehold, (req, res) => {
  const recipe = db.data.recipes.find(candidate => (
    candidate.id === req.params.recipeId &&
    candidate.householdId === req.householdId
  ))

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  sendOk(res, recipe)
})

router.get('/:recipeId/nutrition', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = getRecipeForHousehold(req.householdId, req.params.recipeId)

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  if (!config.usdaApiKey) {
    return sendError(res, 503, 'USDA nutrition support is not configured', 'INTEGRATION_NOT_CONFIGURED')
  }

  const nutrition = await getRecipeNutrition(recipe)
  sendOk(res, nutrition)
}))

router.post('/:recipeId/summary', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = getRecipeForHousehold(req.householdId, req.params.recipeId)

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  if (!config.openrouterApiKey) {
    return sendError(res, 503, 'OpenRouter AI support is not configured', 'INTEGRATION_NOT_CONFIGURED')
  }

  const summary = await getRecipeAiSummary(recipe)
  sendOk(res, summary)
}))

router.post('/:recipeId/ask', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = getRecipeForHousehold(req.householdId, req.params.recipeId)

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  const dto = recipeAskSchema.parse(req.body)
  const answer = await getRecipeAiAskResponse(recipe, dto.question, req.auth.user.healthTargets)
  sendOk(res, answer)
}))

router.post('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = createRecipeSchema.parse(req.body)
  const timestamp = nowIso()

  const recipe = {
    id: createId('recipe'),
    householdId: req.householdId,
    title: dto.title,
    description: dto.description,
    imageUrl: dto.imageUrl,
    prepTime: dto.prepTime,
    cookTime: dto.cookTime,
    servings: dto.servings,
    tags: normalizeTags(dto.tags),
    ingredients: dto.ingredients.map(ingredient => ({
      id: createId('ing'),
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
    })),
    instructions: dto.instructions.map(step => step.trim()),
    sourceUrl: undefined,
    createdBy: req.auth.user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  db.data.recipes.push(recipe)
  await db.save()
  sendOk(res, recipe, 'Recipe created')
}))

router.patch('/:recipeId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateRecipeSchema.parse(req.body)
  const recipe = db.data.recipes.find(candidate => (
    candidate.id === req.params.recipeId &&
    candidate.householdId === req.householdId
  ))

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  if (dto.title !== undefined) recipe.title = dto.title
  if (dto.description !== undefined) recipe.description = dto.description
  if (dto.imageUrl !== undefined) recipe.imageUrl = dto.imageUrl
  if (dto.prepTime !== undefined) recipe.prepTime = dto.prepTime
  if (dto.cookTime !== undefined) recipe.cookTime = dto.cookTime
  if (dto.servings !== undefined) recipe.servings = dto.servings
  if (dto.tags !== undefined) recipe.tags = normalizeTags(dto.tags)
  if (dto.ingredients !== undefined) {
    recipe.ingredients = dto.ingredients.map(ingredient => ({
      id: createId('ing'),
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
    }))
  }
  if (dto.instructions !== undefined) {
    recipe.instructions = dto.instructions.map(step => step.trim())
  }

  recipe.updatedAt = nowIso()
  clearRecipeCaches(recipe.id)
  await db.save()
  sendOk(res, recipe, 'Recipe updated')
}))

router.delete('/:recipeId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = db.data.recipes.find(candidate => (
    candidate.id === req.params.recipeId &&
    candidate.householdId === req.householdId
  ))

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  db.data.recipes = db.data.recipes.filter(candidate => candidate.id !== recipe.id)
  db.data.mealAssignments = db.data.mealAssignments.filter(candidate => candidate.recipeId !== recipe.id)
  db.data.shoppingItems = db.data.shoppingItems.filter(candidate => candidate.sourceRecipeId !== recipe.id)
  clearRecipeCaches(recipe.id)

  await db.save()
  sendOk(res, true, 'Recipe deleted')
}))

// ── Recipe Reviews (ratings + notes) ────────────────────────────

router.get('/:recipeId/reviews', requireAuth, requireHousehold, (req, res) => {
  const recipe = getRecipeForHousehold(req.householdId, req.params.recipeId)
  if (!recipe) return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')

  const reviews = (db.data.recipeReviews || []).filter(r => r.recipeId === recipe.id)
  const users = db.data.users
  const enriched = reviews.map(r => {
    const user = users.find(u => u.id === r.userId)
    return { ...r, userName: user?.displayName || 'Unknown' }
  })

  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null

  sendOk(res, { reviews: enriched, averageRating: avgRating, totalReviews: reviews.length })
})

router.post('/:recipeId/reviews', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = getRecipeForHousehold(req.householdId, req.params.recipeId)
  if (!recipe) return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')

  const dto = recipeReviewSchema.parse(req.body)

  if (!db.data.recipeReviews) db.data.recipeReviews = []

  // Upsert: one review per user per recipe
  const existing = db.data.recipeReviews.find(r => r.recipeId === recipe.id && r.userId === req.auth.user.id)
  if (existing) {
    existing.rating = dto.rating
    existing.note = dto.note || ''
    existing.updatedAt = nowIso()
  } else {
    db.data.recipeReviews.push({
      id: createId('review'),
      recipeId: recipe.id,
      userId: req.auth.user.id,
      rating: dto.rating,
      note: dto.note || '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })
  }

  await db.save()

  const reviews = db.data.recipeReviews.filter(r => r.recipeId === recipe.id)
  const avgRating = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10

  sendOk(res, { averageRating: avgRating, totalReviews: reviews.length }, 'Review saved')
}))

router.delete('/:recipeId/reviews', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = getRecipeForHousehold(req.householdId, req.params.recipeId)
  if (!recipe) return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')

  if (!db.data.recipeReviews) db.data.recipeReviews = []
  db.data.recipeReviews = db.data.recipeReviews.filter(r => !(r.recipeId === recipe.id && r.userId === req.auth.user.id))
  await db.save()
  sendOk(res, true, 'Review removed')
}))

router.post('/import', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = importRecipeSchema.parse(req.body)
  const duplicate = db.data.recipes.find(candidate => (
    candidate.householdId === req.householdId &&
    candidate.sourceUrl?.toLowerCase() === dto.url.toLowerCase()
  ))

  if (duplicate) {
    return sendError(
      res,
      409,
      'That recipe has already been imported',
      'DUPLICATE_RECIPE_SOURCE',
      { existingRecipe: { id: duplicate.id, title: duplicate.title } }
    )
  }

  const imported = await importRecipeFromUrl(dto.url)
  const timestamp = nowIso()
  const recipe = {
    id: createId('recipe'),
    householdId: req.householdId,
    title: imported.title,
    description: imported.description,
    imageUrl: imported.imageUrl,
    prepTime: imported.prepTime,
    cookTime: imported.cookTime,
    servings: imported.servings,
    tags: imported.tags,
    ingredients: imported.ingredients.map(ingredient => ({
      id: createId('ing'),
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
    })),
    instructions: imported.instructions,
    sourceUrl: imported.sourceUrl,
    credits: imported.credits,
    createdBy: req.auth.user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  db.data.recipes.push(recipe)
  await db.save()
  sendOk(res, recipe, 'Recipe imported')
}))

export default router
