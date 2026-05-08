import { Router } from 'express'
import { z } from 'zod'
import { createId, normalizeMealPeriodName, startOfWeek, toDateKey } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  applyRecurringMealsForWeek,
  copyWeekPlan,
  requireAuth,
  requireHousehold,
  getHouseholdPreferences,
  getMealSlotsForWeek,
  getPeriodNutrition,
  getWeekNutrition,
} from '../helpers.js'
import * as db from '../db/index.js'

const router = Router()

const mealTypeSchema = z.string().trim().min(2).max(24).transform(normalizeMealPeriodName)

const plannerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: mealTypeSchema,
  recipeId: z.string().optional(),
})

const plannerAssignmentSchema = plannerSchema.extend({
  recipeId: z.string().min(1),
})

const plannerSlotUpdateSchema = z.object({
  servings: z.number().positive().max(50).optional(),
  repeatWeekly: z.boolean().optional(),
}).refine(value => value.servings !== undefined || value.repeatWeekly !== undefined, {
  message: 'No planner updates were provided',
})

const plannerWeekActionSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const nutritionQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

router.get('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const weekStartDate = typeof req.query.weekStart === 'string' && req.query.weekStart
    ? req.query.weekStart
    : toDateKey(startOfWeek())

  const recurringSummary = await applyRecurringMealsForWeek(req.householdId, weekStartDate)

  const allWeekSlots = await getMealSlotsForWeek(req.householdId, weekStartDate)

  sendOk(res, {
    weekStart: weekStartDate,
    slots: allWeekSlots,
  })
}))

router.get('/nutrition', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const query = nutritionQuerySchema.parse(req.query)
  const period = query.period || 'week'

  if (period === 'day') {
    const date = query.date || toDateKey(new Date())
    const summary = await getPeriodNutrition(req.householdId, {
      period,
      startDate: date,
      endDate: addDaysToDateKey(date, 1),
    })
    return sendOk(res, summary)
  }

  if (period === 'month') {
    const { startDate, endDate, month } = getMonthRange(query.month)
    const summary = await getPeriodNutrition(req.householdId, {
      period,
      startDate,
      endDate,
      month,
    })
    return sendOk(res, summary)
  }

  const weekStartDate = query.weekStart || toDateKey(startOfWeek())
  const summary = await getWeekNutrition(req.householdId, weekStartDate)
  sendOk(res, summary)
}))

router.post('/copy-last-week', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerWeekActionSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const summary = await copyWeekPlan(req.householdId, weekStart)
  sendOk(res, summary, 'Last week copied into planner')
}))

function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

function getMonthRange(monthKey) {
  const now = new Date()
  const [year, month] = (monthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  return {
    month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  }
}

router.post('/apply-recurring', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerWeekActionSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const summary = await applyRecurringMealsForWeek(req.householdId, weekStart)
  sendOk(res, summary, 'Recurring meals applied')
}))

router.put('/slot', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerAssignmentSchema.parse(req.body)
  const preferences = await getHouseholdPreferences(req.householdId)

  if (!preferences.mealPeriods.includes(dto.mealType)) {
    return sendError(res, 400, 'Meal period is not enabled for this household', 'INVALID_MEAL_PERIOD')
  }

  const recipe = await db.getRecipeById(dto.recipeId)

  if (!recipe || recipe.householdId !== req.householdId) {
    return sendError(res, 404, 'Recipe not found for this household', 'RECIPE_NOT_FOUND')
  }

  const assignment = {
    id: createId('slot'),
    householdId: req.householdId,
    date: dto.date,
    mealType: dto.mealType,
    recipeId: dto.recipeId,
    notes: '',
    servings: recipe.servings,
    repeatWeekly: false,
  }

  await db.createAssignment(assignment)

  sendOk(res, {
    id: assignment.id,
    date: assignment.date,
    mealType: assignment.mealType,
    recipeId: assignment.recipeId,
    recipe,
    notes: assignment.notes,
    servings: assignment.servings,
    repeatWeekly: Boolean(assignment.repeatWeekly),
    recurrenceId: assignment.recurrenceId || undefined,
  }, 'Meal assigned')
}))

router.delete('/slot', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerSchema.omit({ recipeId: true }).parse(req.body)

  await db.deleteAssignmentsBySlot(req.householdId, dto.date, dto.mealType)

  sendOk(res, {
    id: `slot-${dto.date}-${dto.mealType}`,
    date: dto.date,
    mealType: dto.mealType,
    recipeId: undefined,
    recipe: undefined,
    notes: undefined,
  }, 'Meal removed')
}))

router.patch('/slot/:slotId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerSlotUpdateSchema.parse(req.body)
  const assignment = await db.getAssignmentById(req.params.slotId)

  if (!assignment || assignment.householdId !== req.householdId) {
    return sendError(res, 404, 'Meal assignment not found', 'MEAL_ASSIGNMENT_NOT_FOUND')
  }

  const updates = {}

  if (dto.servings !== undefined) {
    updates.servings = dto.servings
  }

  if (dto.repeatWeekly !== undefined) {
    updates.repeatWeekly = dto.repeatWeekly

    if (dto.repeatWeekly && !assignment.recurrenceId) {
      updates.recurrenceId = createId('recur')
    }
  }

  await db.updateAssignment(req.params.slotId, updates)

  const recipe = await db.getRecipeById(assignment.recipeId)
  const updatedAssignment = await db.getAssignmentById(req.params.slotId)

  sendOk(res, {
    id: updatedAssignment.id,
    date: updatedAssignment.date,
    mealType: updatedAssignment.mealType,
    recipeId: updatedAssignment.recipeId,
    recipe,
    notes: updatedAssignment.notes,
    servings: updatedAssignment.servings,
    repeatWeekly: Boolean(updatedAssignment.repeatWeekly),
    recurrenceId: updatedAssignment.recurrenceId || undefined,
  }, dto.servings !== undefined && dto.repeatWeekly === undefined ? 'Meal servings updated' : 'Meal updated')
}))

router.delete('/slot/:slotId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const assignment = await db.getAssignmentById(req.params.slotId)

  if (!assignment || assignment.householdId !== req.householdId) {
    return sendError(res, 404, 'Meal assignment not found', 'MEAL_ASSIGNMENT_NOT_FOUND')
  }

  await db.deleteAssignment(req.params.slotId)

  sendOk(res, true, 'Meal removed')
}))

export default router
