import { Router } from 'express'
import { z } from 'zod'
import { createId, ingredientMatchKey, nowIso } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  requireAuth,
  requireHousehold,
  paginate,
} from '../helpers.js'
import * as db from '../db/index.js'

const router = Router()

const pantryItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: z.number().nonnegative().max(10000),
  unit: z.string().max(30),
  category: z.enum(['produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery', 'household', 'other']),
  lowStockThreshold: z.number().nonnegative().max(10000),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const updatePantryItemSchema = pantryItemSchema.partial()

router.get('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const all = await db.getPantryItems(req.householdId)
  const sorted = all.sort((left, right) => left.name.localeCompare(right.name))

  sendOk(res, paginate(sorted, req.query))
}))

router.post('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = pantryItemSchema.parse(req.body)
  const existing = await db.findPantryItem(req.householdId, dto.name, dto.unit)

  if (existing) {
    const newQuantity = Number((existing.quantity + dto.quantity).toFixed(2))
    await db.updatePantryItem(existing.id, {
      quantity: newQuantity,
      lowStockThreshold: dto.lowStockThreshold,
      category: dto.category,
      expiresAt: dto.expiresAt || undefined,
      updatedAt: nowIso(),
    })
    const updated = await db.getPantryItemById(existing.id)
    return sendOk(res, updated, 'Pantry item updated')
  }

  const item = {
    id: createId('pantry'),
    householdId: req.householdId,
    name: dto.name,
    quantity: dto.quantity,
    unit: dto.unit,
    category: dto.category,
    lowStockThreshold: dto.lowStockThreshold,
    expiresAt: dto.expiresAt || undefined,
    updatedAt: nowIso(),
  }

  await db.createPantryItem(item)
  sendOk(res, item, 'Pantry item added')
}))

router.patch('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updatePantryItemSchema.parse(req.body)
  const item = await db.getPantryItemById(req.params.itemId)

  if (!item || item.householdId !== req.householdId) {
    return sendError(res, 404, 'Pantry item not found', 'PANTRY_ITEM_NOT_FOUND')
  }

  const updates = {}
  if (dto.name !== undefined) updates.name = dto.name
  if (dto.quantity !== undefined) updates.quantity = dto.quantity
  if (dto.unit !== undefined) updates.unit = dto.unit
  if (dto.category !== undefined) updates.category = dto.category
  if (dto.lowStockThreshold !== undefined) updates.lowStockThreshold = dto.lowStockThreshold
  if (dto.expiresAt !== undefined) updates.expiresAt = dto.expiresAt || undefined
  updates.updatedAt = nowIso()

  await db.updatePantryItem(req.params.itemId, updates)
  const updated = await db.getPantryItemById(req.params.itemId)
  sendOk(res, updated, 'Pantry item updated')
}))

router.delete('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const item = await db.getPantryItemById(req.params.itemId)

  if (!item || item.householdId !== req.householdId) {
    return sendError(res, 404, 'Pantry item not found', 'PANTRY_ITEM_NOT_FOUND')
  }

  await db.deletePantryItem(req.params.itemId)
  sendOk(res, true, 'Pantry item removed')
}))

export default router
