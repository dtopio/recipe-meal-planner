import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { createId, guessShoppingCategory, nowIso, startOfWeek, toDateKey } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  requireAuth,
  requireHousehold,
  paginate,
  buildShoppingGeneration,
  filterShoppingItemsByPeriod,
  getShoppingSummary,
} from '../helpers.js'

const router = Router()

const addShoppingItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().positive().max(10000),
  unit: z.string().max(30),
  category: z.enum(['produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery', 'household', 'other']),
})

const updateShoppingItemSchema = z.object({
  checked: z.boolean(),
})

const recipeIngredientShoppingSchema = z.object({
  recipeId: z.string().max(50),
  recipeName: z.string().trim().min(1).max(200),
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    quantity: z.number().positive().max(10000),
    unit: z.string().max(30),
  })).min(1).max(100),
})

const shoppingGenerationSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period: z.enum(['all', 'day', 'week', 'month']).optional(),
})

router.get('/', requireAuth, requireHousehold, (req, res) => {
  const all = db.data.shoppingItems
    .filter(candidate => candidate.householdId === req.householdId)
    .sort((left, right) => new Date(left.addedAt).getTime() - new Date(right.addedAt).getTime())

  sendOk(res, paginate(all, req.query))
})

router.post('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = addShoppingItemSchema.parse(req.body)
  const existing = db.data.shoppingItems.find(candidate => (
    candidate.householdId === req.householdId &&
    !candidate.checked &&
    candidate.name.toLowerCase() === dto.name.toLowerCase() &&
    candidate.unit.toLowerCase() === dto.unit.toLowerCase()
  ))

  if (existing) {
    existing.quantity += dto.quantity
    existing.category = dto.category
    existing.syncStatus = 'synced'
    await db.save()
    return sendOk(res, existing, 'Shopping item updated')
  }

  const item = {
    id: createId('item'),
    householdId: req.householdId,
    name: dto.name,
    quantity: dto.quantity,
    unit: dto.unit,
    category: dto.category,
    checked: false,
    addedBy: req.auth.user.id,
    addedAt: nowIso(),
    syncStatus: 'synced',
  }

  db.data.shoppingItems.push(item)
  await db.save()
  sendOk(res, item, 'Shopping item added')
}))

router.post('/generate', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = shoppingGenerationSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const summary = buildShoppingGeneration(req.householdId, weekStart)

  db.data.shoppingItems = db.data.shoppingItems.filter(candidate => !(
    candidate.householdId === req.householdId &&
    candidate.generated &&
    candidate.sourceWeekStart === weekStart
  ))

  db.data.shoppingItems.push(...summary.generatedItems)
  await db.save()

  sendOk(res, {
    ...summary,
    createdCount: summary.generatedItems.length,
  }, 'Shopping list generated from meal plan')
}))

router.post('/summary', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = shoppingGenerationSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const period = dto.period || 'all'
  const summary = await getShoppingSummary(req.householdId, weekStart, period)
  sendOk(res, {
    ...summary,
    weekStart,
    period,
  })
}))

router.patch('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateShoppingItemSchema.parse(req.body)
  const item = db.data.shoppingItems.find(candidate => (
    candidate.id === req.params.itemId &&
    candidate.householdId === req.householdId
  ))

  if (!item) {
    return sendError(res, 404, 'Shopping item not found', 'SHOPPING_ITEM_NOT_FOUND')
  }

  item.checked = dto.checked
  item.syncStatus = 'synced'
  await db.save()
  sendOk(res, item, 'Shopping item updated')
}))

router.delete('/checked', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = shoppingGenerationSchema.parse(req.body || {})
  const period = dto.period || 'all'
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const checkedIds = new Set(
    filterShoppingItemsByPeriod(
      db.data.shoppingItems.filter(candidate => candidate.householdId === req.householdId && candidate.checked),
      period,
      weekStart,
    ).map(item => item.id)
  )

  db.data.shoppingItems = db.data.shoppingItems.filter(candidate => !checkedIds.has(candidate.id))

  await db.save()
  sendOk(res, true, 'Completed shopping items cleared')
}))

router.delete('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  db.data.shoppingItems = db.data.shoppingItems.filter(candidate => candidate.householdId !== req.householdId)
  await db.save()
  sendOk(res, true, 'Shopping list cleared')
}))

router.delete('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  db.data.shoppingItems = db.data.shoppingItems.filter(candidate => !(
    candidate.id === req.params.itemId &&
    candidate.householdId === req.householdId
  ))

  await db.save()
  sendOk(res, true, 'Shopping item removed')
}))

router.post('/recipe-ingredients', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = recipeIngredientShoppingSchema.parse(req.body)
  const addedItems = []

  for (const ingredient of dto.ingredients) {
    const existing = db.data.shoppingItems.find(candidate => (
      candidate.householdId === req.householdId &&
      !candidate.checked &&
      candidate.name.toLowerCase() === ingredient.name.toLowerCase() &&
      candidate.unit.toLowerCase() === ingredient.unit.toLowerCase()
    ))

    if (existing) {
      existing.quantity += ingredient.quantity
      existing.syncStatus = 'synced'
      existing.sourceRecipeId = existing.sourceRecipeId || dto.recipeId
      existing.sourceRecipeName = existing.sourceRecipeName || dto.recipeName
      addedItems.push(existing)
      continue
    }

    const item = {
      id: createId('item'),
      householdId: req.householdId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      category: guessShoppingCategory(ingredient.name),
      checked: false,
      sourceRecipeId: dto.recipeId,
      sourceRecipeName: dto.recipeName,
      addedBy: req.auth.user.id,
      addedAt: nowIso(),
      syncStatus: 'synced',
    }

    db.data.shoppingItems.push(item)
    addedItems.push(item)
  }

  await db.save()
  sendOk(res, addedItems, 'Recipe ingredients added')
}))

export default router
