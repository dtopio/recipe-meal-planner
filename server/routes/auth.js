import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { hashPassword, verifyPassword } from '../password.js'
import { authLimiter } from '../rate-limit.js'
import { createId, nowIso, normalizeHealthTargets, serializeUser, DEFAULT_HEALTH_TARGETS } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  requireAuth,
  createSession,
  updateHouseholdMemberSnapshots,
} from '../helpers.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email().max(100),
  password: z.string().min(6).max(128),
})

const passwordSchema = z.string().min(8).max(128)
  .refine(val => /[a-z]/.test(val), 'Password must contain a lowercase letter')
  .refine(val => /[A-Z]/.test(val), 'Password must contain an uppercase letter')
  .refine(val => /[0-9]/.test(val), 'Password must contain a number')

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(100),
  password: passwordSchema,
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})

const healthTargetsSchema = z.object({
  calories: z.number().positive().max(10000),
  protein: z.number().positive().max(1000),
  carbs: z.number().positive().max(2000),
  fat: z.number().positive().max(1000),
})

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  healthTargets: healthTargetsSchema.optional(),
}).refine(dto => dto.displayName !== undefined || dto.healthTargets !== undefined, {
  message: 'No profile changes were provided',
})

router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const dto = registerSchema.parse(req.body)

  if (db.data.users.some(user => user.email.toLowerCase() === dto.email.toLowerCase())) {
    return sendError(res, 409, 'An account with that email already exists', 'EMAIL_EXISTS')
  }

  const user = {
    id: createId('user'),
    email: dto.email.toLowerCase(),
    password: await hashPassword(dto.password),
    displayName: dto.displayName,
    avatarUrl: undefined,
    createdAt: nowIso(),
    currentHouseholdId: undefined,
    healthTargets: { ...DEFAULT_HEALTH_TARGETS },
  }

  db.data.users.push(user)
  const session = createSession(user)
  await db.save()
  sendOk(res, session, 'Account created')
}))

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const dto = loginSchema.parse(req.body)
  const user = db.data.users.find(candidate => candidate.email.toLowerCase() === dto.email.toLowerCase())

  if (!user || !(await verifyPassword(dto.password, user.password))) {
    return sendError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  const session = createSession(user)
  await db.save()
  sendOk(res, session, 'Signed in')
}))

router.get('/me', requireAuth, (req, res) => {
  sendOk(res, serializeUser(req.auth.user))
})

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const dto = profileSchema.parse(req.body)

  if (dto.displayName !== undefined) {
    req.auth.user.displayName = dto.displayName
    updateHouseholdMemberSnapshots(req.auth.user.id)
  }

  if (dto.healthTargets !== undefined) {
    req.auth.user.healthTargets = normalizeHealthTargets(dto.healthTargets)
  }

  await db.save()
  sendOk(res, serializeUser(req.auth.user), 'Profile updated')
}))

// ── Change password ─────────────────────────────────────────────

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const dto = changePasswordSchema.parse(req.body)

  if (!(await verifyPassword(dto.currentPassword, req.auth.user.password))) {
    return sendError(res, 401, 'Current password is incorrect', 'INVALID_CREDENTIALS')
  }

  req.auth.user.password = await hashPassword(dto.newPassword)

  // Invalidate all other sessions so stolen tokens can't persist
  const currentToken = req.auth.session.accessToken
  db.data.sessions = db.data.sessions.filter(s => s.accessToken === currentToken)
  db.sessionIndex.clear()
  db.sessionIndex.set(currentToken, req.auth.session)

  await db.save()
  sendOk(res, true, 'Password changed')
}))

// ── Delete account ──────────────────────────────────────────────

router.post('/delete-account', requireAuth, asyncHandler(async (req, res) => {
  const dto = z.object({ password: z.string().min(1) }).parse(req.body)

  if (!(await verifyPassword(dto.password, req.auth.user.password))) {
    return sendError(res, 401, 'Password is incorrect', 'INVALID_CREDENTIALS')
  }

  const userId = req.auth.user.id
  const householdId = req.auth.user.currentHouseholdId

  // Clean up household membership
  if (householdId) {
    db.data.householdMembers = db.data.householdMembers.filter(m => !(
      m.householdId === householdId && m.userId === userId
    ))

    const remaining = db.data.householdMembers.filter(m => m.householdId === householdId)
    if (remaining.length === 0) {
      // Last member — delete entire household data
      db.data.households = db.data.households.filter(h => h.id !== householdId)
      db.data.invites = db.data.invites.filter(i => i.householdId !== householdId)
      db.data.householdPreferences = db.data.householdPreferences.filter(p => p.householdId !== householdId)
      db.data.recipes = db.data.recipes.filter(r => r.householdId !== householdId)
      db.data.mealAssignments = db.data.mealAssignments.filter(m => m.householdId !== householdId)
      db.data.shoppingItems = db.data.shoppingItems.filter(s => s.householdId !== householdId)
      db.data.pantryItems = db.data.pantryItems.filter(p => p.householdId !== householdId)
    } else if (!remaining.some(m => m.role === 'admin')) {
      remaining[0].role = 'admin'
    }
  }

  // Remove user data
  db.data.users = db.data.users.filter(u => u.id !== userId)
  db.data.sessions = db.data.sessions.filter(s => s.userId !== userId)
  db.data.recipeReviews = (db.data.recipeReviews || []).filter(r => r.userId !== userId)

  // Rebuild session index
  db.sessionIndex.clear()
  for (const s of db.data.sessions) db.sessionIndex.set(s.accessToken, s)

  await db.save()
  sendOk(res, true, 'Account deleted')
}))

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const token = req.auth.session.accessToken
  db.data.sessions = db.data.sessions.filter(candidate => candidate.accessToken !== token)
  db.sessionIndex.delete(token)
  await db.save()
  sendOk(res, true, 'Signed out')
}))

export default router
