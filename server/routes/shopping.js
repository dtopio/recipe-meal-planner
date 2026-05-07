import { Router } from 'express'
import { z } from 'zod'
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
import * as db from '../db/index.js'

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

router.get('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const all = await db.getShoppingItems(req.householdId)
  const sorted = all.sort((left, right) => new Date(left.addedAt).getTime() - new Date(right.addedAt).getTime())

  sendOk(res, paginate(sorted, req.query))
}))

router.post('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = addShoppingItemSchema.parse(req.body)
  const existing = await db.findShoppingItem(req.householdId, dto.name, dto.unit)

  if (existing && !existing.checked) {
    await db.updateShoppingItem(existing.id, {
      quantity: existing.quantity + dto.quantity,
      category: dto.category,
      syncStatus: 'synced',
    })
    const updated = await db.getShoppingItemById(existing.id)
    return sendOk(res, updated, 'Shopping item updated')
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

  await db.createShoppingItem(item)
  sendOk(res, item, 'Shopping item added')
}))

router.post('/generate', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = shoppingGenerationSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const summary = await buildShoppingGeneration(req.householdId, weekStart)

  await db.deleteGeneratedItemsByWeek(req.householdId, weekStart)
  await db.createShoppingItems(summary.generatedItems)

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
  sendOk(res, summary)
}))

router.patch('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateShoppingItemSchema.parse(req.body)
  const item = await db.getShoppingItemById(req.params.itemId)

  if (!item || item.householdId !== req.householdId) {
    return sendError(res, 404, 'Shopping item not found', 'SHOPPING_ITEM_NOT_FOUND')
  }

  await db.updateShoppingItem(req.params.itemId, {
    checked: dto.checked,
    syncStatus: 'synced',
  })
  const updated = await db.getShoppingItemById(req.params.itemId)
  sendOk(res, updated, 'Shopping item updated')
}))

router.delete('/checked', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = shoppingGenerationSchema.parse(req.body || {})
  const period = dto.period || 'all'
  const weekStart = dto.weekStart || toDateKey(startOfWeek())

  const allItems = await db.getShoppingItems(req.householdId)
  const checkedItems = allItems.filter(item => item.checked)
  const filtered = filterShoppingItemsByPeriod(checkedItems, period, weekStart)
  const checkedIds = filtered.map(item => item.id)

  await db.deleteCheckedItems(req.householdId, checkedIds)

  sendOk(res, true, 'Completed shopping items cleared')
}))

router.delete('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  await db.deleteShoppingItemsByHousehold(req.householdId)
  sendOk(res, true, 'Shopping list cleared')
}))

router.delete('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const item = await db.getShoppingItemById(req.params.itemId)

  if (!item || item.householdId !== req.householdId) {
    return sendError(res, 404, 'Shopping item not found', 'SHOPPING_ITEM_NOT_FOUND')
  }

  await db.deleteShoppingItem(req.params.itemId)
  sendOk(res, true, 'Shopping item removed')
}))

router.post('/recipe-ingredients', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = recipeIngredientShoppingSchema.parse(req.body)
  const addedItems = []

  for (const ingredient of dto.ingredients) {
    const existing = await db.findShoppingItem(req.householdId, ingredient.name, ingredient.unit)

    if (existing && !existing.checked) {
      await db.updateShoppingItem(existing.id, {
        quantity: existing.quantity + ingredient.quantity,
        syncStatus: 'synced',
        sourceRecipeId: existing.sourceRecipeId || dto.recipeId,
        sourceRecipeName: existing.sourceRecipeName || dto.recipeName,
      })
      const updated = await db.getShoppingItemById(existing.id)
      addedItems.push(updated)
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

    await db.createShoppingItem(item)
    addedItems.push(item)
  }

  sendOk(res, addedItems, 'Recipe ingredients added')
}))

export default router
