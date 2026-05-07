import { Router } from 'express'
import { z } from 'zod'
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
  getRecipeAiAsk,
  clearRecipeCaches,
} from '../helpers.js'
import * as db from '../db/index.js'

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

router.get('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const all = await getRecipesForHousehold(req.householdId)
  sendOk(res, paginate(all, req.query))
}))

router.get('/:recipeId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = await db.getRecipeById(req.params.recipeId)

  if (!recipe || recipe.householdId !== req.householdId) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  sendOk(res, recipe)
}))

router.get('/:recipeId/nutrition', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = await getRecipeForHousehold(req.householdId, req.params.recipeId)

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
  const recipe = await getRecipeForHousehold(req.householdId, req.params.recipeId)

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
  const recipe = await getRecipeForHousehold(req.householdId, req.params.recipeId)

  if (!recipe) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  const dto = recipeAskSchema.parse(req.body)
  const answer = await getRecipeAiAsk(recipe, dto.question, req.auth.user.healthTargets)
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
    credits: undefined,
    createdBy: req.auth.user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  await db.createRecipe(recipe)
  sendOk(res, recipe, 'Recipe created')
}))

router.patch('/:recipeId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateRecipeSchema.parse(req.body)
  const recipe = await db.getRecipeById(req.params.recipeId)

  if (!recipe || recipe.householdId !== req.householdId) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  const updates = {}
  if (dto.title !== undefined) updates.title = dto.title
  if (dto.description !== undefined) updates.description = dto.description
  if (dto.imageUrl !== undefined) updates.imageUrl = dto.imageUrl
  if (dto.prepTime !== undefined) updates.prepTime = dto.prepTime
  if (dto.cookTime !== undefined) updates.cookTime = dto.cookTime
  if (dto.servings !== undefined) updates.servings = dto.servings
  if (dto.tags !== undefined) updates.tags = normalizeTags(dto.tags)
  if (dto.ingredients !== undefined) {
    updates.ingredients = dto.ingredients.map(ingredient => ({
      id: createId('ing'),
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
    }))
  }
  if (dto.instructions !== undefined) {
    updates.instructions = dto.instructions.map(step => step.trim())
  }

  updates.updatedAt = nowIso()
  await db.updateRecipe(req.params.recipeId, updates)
  await clearRecipeCaches(recipe.id)

  const updatedRecipe = await db.getRecipeById(req.params.recipeId)
  sendOk(res, updatedRecipe, 'Recipe updated')
}))

router.delete('/:recipeId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = await db.getRecipeById(req.params.recipeId)

  if (!recipe || recipe.householdId !== req.householdId) {
    return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')
  }

  await db.deleteRecipe(req.params.recipeId)
  await clearRecipeCaches(recipe.id)

  sendOk(res, true, 'Recipe deleted')
}))

// ── Recipe Reviews (ratings + notes) ────────────────────────────

router.get('/:recipeId/reviews', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = await getRecipeForHousehold(req.householdId, req.params.recipeId)
  if (!recipe) return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')

  const reviews = await db.getReviewsByRecipe(recipe.id)
  const enriched = await Promise.all(reviews.map(async r => {
    const user = await db.getUserById(r.userId)
    return { ...r, userName: user?.displayName || 'Unknown' }
  }))

  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null

  sendOk(res, { reviews: enriched, averageRating: avgRating, totalReviews: reviews.length })
}))

router.post('/:recipeId/reviews', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = await getRecipeForHousehold(req.householdId, req.params.recipeId)
  if (!recipe) return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')

  const dto = recipeReviewSchema.parse(req.body)
  const timestamp = nowIso()

  const existing = await db.getReviewByUserAndRecipe(req.auth.user.id, recipe.id)
  if (existing) {
    await db.updateReview(existing.id, {
      rating: dto.rating,
      note: dto.note || '',
      updatedAt: timestamp,
    })
  } else {
    await db.createReview({
      id: createId('review'),
      recipeId: recipe.id,
      userId: req.auth.user.id,
      rating: dto.rating,
      note: dto.note || '',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }

  const reviews = await db.getReviewsByRecipe(recipe.id)
  const avgRating = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10

  sendOk(res, { averageRating: avgRating, totalReviews: reviews.length }, 'Review saved')
}))

router.delete('/:recipeId/reviews', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const recipe = await getRecipeForHousehold(req.householdId, req.params.recipeId)
  if (!recipe) return sendError(res, 404, 'Recipe not found', 'RECIPE_NOT_FOUND')

  await db.deleteReview(req.auth.user.id, recipe.id)
  sendOk(res, true, 'Review removed')
}))

router.post('/import', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = importRecipeSchema.parse(req.body)
  const duplicate = await db.getRecipeBySourceUrl(req.householdId, dto.url)

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

  await db.createRecipe(recipe)
  sendOk(res, recipe, 'Recipe imported')
}))

export default router
