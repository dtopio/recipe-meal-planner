import { Router } from 'express'
import { z } from 'zod'
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
import * as db from '../db/index.js'
import { config } from '../config.js'
import { logger } from '../logger.js'

const router = Router()

async function verifyGoogleIdToken(idToken) {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
  if (!response.ok) {
    throw new Error('Failed to verify Google ID token')
  }
  const payload = await response.json()
  if (!config.googleClientId) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the server')
  }
  if (payload.aud !== config.googleClientId) {
    throw new Error('Google token audience mismatch')
  }
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    throw new Error('Invalid Google token issuer')
  }
  if (Number(payload.exp) * 1000 < Date.now()) {
    throw new Error('Google token has expired')
  }
  if (payload.email_verified !== 'true' && payload.email_verified !== true) {
    throw new Error('Google account email is not verified')
  }
  return payload
}

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

  const existingUser = await db.getUserByEmail(dto.email)
  if (existingUser) {
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

  await db.createUser(user)
  const session = await createSession(user)
  sendOk(res, session, 'Account created')
}))

router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const dto = loginSchema.parse(req.body)
  const user = await db.getUserByEmail(dto.email)

  if (!user || !(await verifyPassword(dto.password, user.password))) {
    return sendError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  const session = await createSession(user)
  sendOk(res, session, 'Signed in')
}))

router.post('/google', authLimiter, asyncHandler(async (req, res) => {
  const dto = z.object({ credential: z.string().min(10) }).parse(req.body)

  let payload
  try {
    payload = await verifyGoogleIdToken(dto.credential)
  } catch (error) {
    logger.warn('Google sign-in verification failed', { error: error.message })
    return sendError(res, 401, 'Could not verify Google sign-in', 'GOOGLE_AUTH_FAILED')
  }

  const googleId = payload.sub
  const email = String(payload.email || '').toLowerCase()
  if (!googleId || !email) {
    return sendError(res, 400, 'Google account is missing required fields', 'GOOGLE_AUTH_FAILED')
  }

  let user = await db.getUserByGoogleId(googleId)

  if (!user) {
    const existingByEmail = await db.getUserByEmail(email)
    if (existingByEmail) {
      await db.updateUser(existingByEmail.id, { googleId })
      user = await db.getUserById(existingByEmail.id)
    } else {
      user = await db.createUser({
        id: createId('user'),
        email,
        password: null,
        displayName: payload.name || payload.given_name || email.split('@')[0],
        avatarUrl: payload.picture || undefined,
        createdAt: nowIso(),
        currentHouseholdId: undefined,
        healthTargets: { ...DEFAULT_HEALTH_TARGETS },
        googleId,
      })
    }
  }

  const session = await createSession(user)
  sendOk(res, session, 'Signed in with Google')
}))

router.get('/me', requireAuth, (req, res) => {
  sendOk(res, serializeUser(req.auth.user))
})

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const dto = profileSchema.parse(req.body)
  const userId = req.auth.user.id

  const updates = {}
  if (dto.displayName !== undefined) {
    updates.displayName = dto.displayName
    await updateHouseholdMemberSnapshots(userId)
  }

  if (dto.healthTargets !== undefined) {
    updates.healthTargets = normalizeHealthTargets(dto.healthTargets)
  }

  await db.updateUser(userId, updates)
  const updatedUser = await db.getUserById(userId)
  sendOk(res, serializeUser(updatedUser), 'Profile updated')
}))

// ── Change password ─────────────────────────────────────────────

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const dto = changePasswordSchema.parse(req.body)

  if (!(await verifyPassword(dto.currentPassword, req.auth.user.password))) {
    return sendError(res, 401, 'Current password is incorrect', 'INVALID_CREDENTIALS')
  }

  const newPassword = await hashPassword(dto.newPassword)
  const userId = req.auth.user.id
  const currentToken = req.auth.session.accessToken

  await db.updateUser(userId, { password: newPassword })
  await db.deleteSessionsForUser(userId, currentToken)

  sendOk(res, true, 'Password changed')
}))

// ── Delete account ──────────────────────────────────────────────

router.post('/delete-account', requireAuth, asyncHandler(async (req, res) => {
  const dto = z.object({
    password: z.string().min(1).optional(),
    confirmation: z.string().optional(),
  }).parse(req.body)

  if (req.auth.user.password) {
    if (!dto.password || !(await verifyPassword(dto.password, req.auth.user.password))) {
      return sendError(res, 401, 'Password is incorrect', 'INVALID_CREDENTIALS')
    }
  } else if (dto.confirmation !== 'DELETE') {
    return sendError(res, 400, 'Type DELETE to confirm', 'INVALID_CONFIRMATION')
  }

  const userId = req.auth.user.id
  const householdId = req.auth.user.currentHouseholdId

  if (householdId) {
    const members = await db.getMembersByHousehold(householdId)
    const remainingAfterDelete = members.filter(m => m.userId !== userId)

    if (remainingAfterDelete.length === 0) {
      await db.deleteHousehold(householdId)
    } else if (!remainingAfterDelete.some(m => m.role === 'admin')) {
      const firstMember = remainingAfterDelete[0]
      await db.updateMember(firstMember.id, { role: 'admin' })
    }
  }

  await db.deleteUser(userId)
  sendOk(res, true, 'Account deleted')
}))

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  const token = req.auth.session.accessToken
  await db.deleteSession(token)
  sendOk(res, true, 'Signed out')
}))

export default router
