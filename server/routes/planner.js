import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { config } from '../config.js'
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
  getWeekNutrition,
} from '../helpers.js'

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

router.get('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const weekStartDate = typeof req.query.weekStart === 'string' && req.query.weekStart
    ? req.query.weekStart
    : toDateKey(startOfWeek())
    
  const recurringSummary = applyRecurringMealsForWeek(req.householdId, weekStartDate)

  if (recurringSummary.createdCount > 0) {
    await db.save()
  }

  // THE FIX: Grab ALL slots for the week, not just the recurring summary!
  const allWeekSlots = await getMealSlotsForWeek(req.householdId, weekStartDate)

  sendOk(res, {
    weekStart: weekStartDate,
    slots: allWeekSlots, // Now sending the full array back to Vue
  })
}))

router.get('/nutrition', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const weekStartDate = typeof req.query.weekStart === 'string' && req.query.weekStart
    ? req.query.weekStart
    : toDateKey(startOfWeek())

  if (!config.usdaApiKey) {
    return sendError(res, 503, 'USDA nutrition support is not configured', 'INTEGRATION_NOT_CONFIGURED')
  }

  const summary = await getWeekNutrition(req.householdId, weekStartDate)
  sendOk(res, summary)
}))

router.post('/copy-last-week', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerWeekActionSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const summary = copyWeekPlan(req.householdId, weekStart)
  await db.save()
  sendOk(res, summary, 'Last week copied into planner')
}))

router.post('/apply-recurring', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerWeekActionSchema.parse(req.body || {})
  const weekStart = dto.weekStart || toDateKey(startOfWeek())
  const summary = applyRecurringMealsForWeek(req.householdId, weekStart)
  await db.save()
  sendOk(res, summary, 'Recurring meals applied')
}))

router.put('/slot', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = plannerAssignmentSchema.parse(req.body)
  const preferences = getHouseholdPreferences(req.householdId)

  if (!preferences.mealPeriods.includes(dto.mealType)) {
    return sendError(res, 400, 'Meal period is not enabled for this household', 'INVALID_MEAL_PERIOD')
  }

  const recipe = db.data.recipes.find(candidate => (
    candidate.id === dto.recipeId &&
    candidate.householdId === req.householdId
  ))

  if (!recipe) {
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
  }

  db.data.mealAssignments.push(assignment)

  await db.save()
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

  db.data.mealAssignments = db.data.mealAssignments.filter(candidate => !(
    candidate.householdId === req.householdId &&
    candidate.date === dto.date &&
    candidate.mealType === dto.mealType
  ))

  await db.save()
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
  const assignment = db.data.mealAssignments.find(candidate => (
    candidate.id === req.params.slotId &&
    candidate.householdId === req.householdId
  ))

  if (!assignment) {
    return sendError(res, 404, 'Meal assignment not found', 'MEAL_ASSIGNMENT_NOT_FOUND')
  }

  if (dto.servings !== undefined) {
    assignment.servings = dto.servings
  }

  if (dto.repeatWeekly !== undefined) {
    assignment.repeatWeekly = dto.repeatWeekly

    if (dto.repeatWeekly && !assignment.recurrenceId) {
      assignment.recurrenceId = createId('recur')
    }
  }

  await db.save()

  const recipe = db.data.recipes.find(candidate => (
    candidate.id === assignment.recipeId &&
    candidate.householdId === req.householdId
  ))

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
  }, dto.servings !== undefined && dto.repeatWeekly === undefined ? 'Meal servings updated' : 'Meal updated')
}))

router.delete('/slot/:slotId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const assignment = db.data.mealAssignments.find(candidate => (
    candidate.id === req.params.slotId &&
    candidate.householdId === req.householdId
  ))

  if (!assignment) {
    return sendError(res, 404, 'Meal assignment not found', 'MEAL_ASSIGNMENT_NOT_FOUND')
  }

  db.data.mealAssignments = db.data.mealAssignments.filter(candidate => candidate.id !== assignment.id)

  await db.save()
  sendOk(res, true, 'Meal removed')
}))

export default router