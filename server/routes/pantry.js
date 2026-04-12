import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { createId, ingredientMatchKey, nowIso } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  requireAuth,
  requireHousehold,
  paginate,
} from '../helpers.js'

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

router.get('/', requireAuth, requireHousehold, (req, res) => {
  const all = db.data.pantryItems
    .filter(candidate => candidate.householdId === req.householdId)
    .sort((left, right) => left.name.localeCompare(right.name))

  sendOk(res, paginate(all, req.query))
})

router.post('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = pantryItemSchema.parse(req.body)
  const existing = db.data.pantryItems.find(candidate => (
    candidate.householdId === req.householdId &&
    ingredientMatchKey(candidate.name, candidate.unit) === ingredientMatchKey(dto.name, dto.unit)
  ))

  if (existing) {
    existing.quantity = Number((existing.quantity + dto.quantity).toFixed(2))
    existing.lowStockThreshold = dto.lowStockThreshold
    existing.category = dto.category
    existing.expiresAt = dto.expiresAt || undefined
    existing.updatedAt = nowIso()
    await db.save()
    return sendOk(res, existing, 'Pantry item updated')
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

  db.data.pantryItems.push(item)
  await db.save()
  sendOk(res, item, 'Pantry item added')
}))

router.patch('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updatePantryItemSchema.parse(req.body)
  const item = db.data.pantryItems.find(candidate => (
    candidate.id === req.params.itemId &&
    candidate.householdId === req.householdId
  ))

  if (!item) {
    return sendError(res, 404, 'Pantry item not found', 'PANTRY_ITEM_NOT_FOUND')
  }

  if (dto.name !== undefined) item.name = dto.name
  if (dto.quantity !== undefined) item.quantity = dto.quantity
  if (dto.unit !== undefined) item.unit = dto.unit
  if (dto.category !== undefined) item.category = dto.category
  if (dto.lowStockThreshold !== undefined) item.lowStockThreshold = dto.lowStockThreshold
  if (dto.expiresAt !== undefined) item.expiresAt = dto.expiresAt || undefined
  item.updatedAt = nowIso()

  await db.save()
  sendOk(res, item, 'Pantry item updated')
}))

router.delete('/:itemId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  db.data.pantryItems = db.data.pantryItems.filter(candidate => !(
    candidate.id === req.params.itemId &&
    candidate.householdId === req.householdId
  ))

  await db.save()
  sendOk(res, true, 'Pantry item removed')
}))

export default router
