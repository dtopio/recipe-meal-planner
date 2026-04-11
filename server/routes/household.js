import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { createId, createInviteCode, nowIso, normalizeMealPeriods } from '../utils.js'
import {
  sendOk,
  sendError,
  asyncHandler,
  requireAuth,
  requireHousehold,
  createSession,
  getHouseholdBundle,
  getHouseholdPreferences,
} from '../helpers.js'

const router = Router()

const createHouseholdSchema = z.object({
  name: z.string().trim().min(2).max(50),
  color: z.string().trim().max(20).optional(),
})

const updateHouseholdSchema = z.object({
  name: z.string().trim().min(2).max(50).optional(),
  color: z.string().trim().max(20).optional(),
}).refine(dto => dto.name !== undefined || dto.color !== undefined, {
  message: 'No changes were provided',
})

const joinHouseholdSchema = z.object({
  inviteCode: z.string().trim().min(4).max(30),
})

const preferencesSchema = z.object({
  dietaryPreferences: z.array(z.enum(['vegetarian', 'halal', 'nut-free', 'dairy-free'])).max(4),
  mealPeriods: z.array(z.string().trim().min(2).max(24)).min(1).max(8),
})

router.get('/', requireAuth, (req, res) => {
  const householdId = req.auth.user.currentHouseholdId
  if (!householdId) {
    return sendOk(res, { household: null, members: [], invite: null, preferences: null })
  }

  sendOk(res, getHouseholdBundle(householdId))
})

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const dto = createHouseholdSchema.parse(req.body)

  if (req.auth.user.currentHouseholdId) {
    return sendError(res, 409, 'Leave your current household before creating a new one', 'ALREADY_IN_HOUSEHOLD')
  }

  const household = {
    id: createId('household'),
    name: dto.name,
    color: dto.color,
    avatarUrl: undefined,
    createdAt: nowIso(),
  }

  const member = {
    id: createId('member'),
    userId: req.auth.user.id,
    householdId: household.id,
    displayName: req.auth.user.displayName,
    avatarUrl: req.auth.user.avatarUrl,
    role: 'admin',
    joinedAt: nowIso(),
  }

  const invite = {
    code: createInviteCode(dto.name),
    householdId: household.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdBy: req.auth.user.id,
  }

  req.auth.user.currentHouseholdId = household.id
  db.data.households.push(household)
  db.data.householdMembers.push(member)
  db.data.invites = db.data.invites.filter(candidate => candidate.householdId !== household.id)
  db.data.invites.push(invite)

  await db.save()
  sendOk(res, getHouseholdBundle(household.id), 'Household created')
}))

router.post('/join', requireAuth, asyncHandler(async (req, res) => {
  const dto = joinHouseholdSchema.parse(req.body)

  if (req.auth.user.currentHouseholdId) {
    return sendError(res, 409, 'Leave your current household before joining a new one', 'ALREADY_IN_HOUSEHOLD')
  }

  const invite = db.data.invites.find(candidate => candidate.code.toUpperCase() === dto.inviteCode.toUpperCase())
  if (!invite || new Date(invite.expiresAt).getTime() <= Date.now()) {
    return sendError(res, 404, 'That invite code is invalid or has expired', 'INVALID_INVITE')
  }

  const existingMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === invite.householdId && candidate.userId === req.auth.user.id
  ))

  if (!existingMember) {
    db.data.householdMembers.push({
      id: createId('member'),
      userId: req.auth.user.id,
      householdId: invite.householdId,
      displayName: req.auth.user.displayName,
      avatarUrl: req.auth.user.avatarUrl,
      role: 'member',
      joinedAt: nowIso(),
    })
  }

  req.auth.user.currentHouseholdId = invite.householdId
  await db.save()
  sendOk(res, getHouseholdBundle(invite.householdId), 'Joined household')
}))

router.post('/invite/regenerate', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const currentMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === req.householdId && candidate.userId === req.auth.user.id
  ))

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can regenerate invite codes', 'FORBIDDEN')
  }

  const household = db.data.households.find(candidate => candidate.id === req.householdId)
  const invite = {
    code: createInviteCode(household?.name || 'Household'),
    householdId: req.householdId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdBy: req.auth.user.id,
  }

  db.data.invites = db.data.invites.filter(candidate => candidate.householdId !== req.householdId)
  db.data.invites.push(invite)
  await db.save()
  sendOk(res, invite, 'Invite code regenerated')
}))

// ── Promote / Demote members ────────────────────────────────────

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

router.patch('/members/:memberId/role', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateRoleSchema.parse(req.body)

  // Only admins can change roles
  const currentMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === req.householdId && candidate.userId === req.auth.user.id
  ))

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can change member roles', 'FORBIDDEN')
  }

  const targetMember = db.data.householdMembers.find(candidate => (
    candidate.id === req.params.memberId && candidate.householdId === req.householdId
  ))

  if (!targetMember) {
    return sendError(res, 404, 'Member not found', 'MEMBER_NOT_FOUND')
  }

  // Prevent demoting yourself if you're the last admin
  if (dto.role === 'member' && targetMember.userId === req.auth.user.id) {
    const adminCount = db.data.householdMembers.filter(candidate => (
      candidate.householdId === req.householdId && candidate.role === 'admin'
    )).length

    if (adminCount <= 1) {
      return sendError(res, 400, 'Cannot demote yourself when you are the only admin. Promote another member first.', 'LAST_ADMIN')
    }
  }

  targetMember.role = dto.role
  await db.save()
  sendOk(res, getHouseholdBundle(req.householdId), `${targetMember.displayName} is now ${dto.role === 'admin' ? 'an admin' : 'a member'}`)
}))

router.patch('/preferences', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = preferencesSchema.parse(req.body)
  const preferences = getHouseholdPreferences(req.householdId)

  preferences.dietaryPreferences = dto.dietaryPreferences
  preferences.mealPeriods = normalizeMealPeriods(dto.mealPeriods)
  await db.save()
  sendOk(res, preferences, 'Household preferences updated')
}))

// ── Update household (rename / color) ───────────────────────────

router.patch('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateHouseholdSchema.parse(req.body)

  const currentMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === req.householdId && candidate.userId === req.auth.user.id
  ))

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can update the household', 'FORBIDDEN')
  }

  const household = db.data.households.find(candidate => candidate.id === req.householdId)
  if (!household) {
    return sendError(res, 404, 'Household not found', 'NOT_FOUND')
  }

  if (dto.name !== undefined) household.name = dto.name
  if (dto.color !== undefined) household.color = dto.color

  await db.save()
  sendOk(res, getHouseholdBundle(req.householdId), 'Household updated')
}))

// ── Kick member ─────────────────────────────────────────────────

router.delete('/members/:memberId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const currentMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === req.householdId && candidate.userId === req.auth.user.id
  ))

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can remove members', 'FORBIDDEN')
  }

  const targetMember = db.data.householdMembers.find(candidate => (
    candidate.id === req.params.memberId && candidate.householdId === req.householdId
  ))

  if (!targetMember) {
    return sendError(res, 404, 'Member not found', 'MEMBER_NOT_FOUND')
  }

  // Can't kick yourself — use /leave instead
  if (targetMember.userId === req.auth.user.id) {
    return sendError(res, 400, 'You cannot remove yourself. Use the leave option instead.', 'CANNOT_KICK_SELF')
  }

  // Remove membership
  db.data.householdMembers = db.data.householdMembers.filter(candidate => candidate.id !== targetMember.id)

  // Clear the kicked user's currentHouseholdId
  const kickedUser = db.data.users.find(candidate => candidate.id === targetMember.userId)
  if (kickedUser && kickedUser.currentHouseholdId === req.householdId) {
    kickedUser.currentHouseholdId = undefined
  }

  await db.save()
  sendOk(res, getHouseholdBundle(req.householdId), `${targetMember.displayName} has been removed`)
}))

// ── Delete household ────────────────────────────────────────────

router.delete('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const currentMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === req.householdId && candidate.userId === req.auth.user.id
  ))

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can delete the household', 'FORBIDDEN')
  }

  const householdId = req.householdId

  // Clear currentHouseholdId for all members
  const memberUserIds = db.data.householdMembers
    .filter(m => m.householdId === householdId)
    .map(m => m.userId)

  for (const userId of memberUserIds) {
    const user = db.data.users.find(u => u.id === userId)
    if (user) user.currentHouseholdId = undefined
  }

  // Cascade delete all household data
  db.data.households = db.data.households.filter(h => h.id !== householdId)
  db.data.householdMembers = db.data.householdMembers.filter(m => m.householdId !== householdId)
  db.data.invites = db.data.invites.filter(i => i.householdId !== householdId)
  db.data.householdPreferences = db.data.householdPreferences.filter(p => p.householdId !== householdId)
  db.data.recipes = db.data.recipes.filter(r => r.householdId !== householdId)
  db.data.mealAssignments = db.data.mealAssignments.filter(m => m.householdId !== householdId)
  db.data.shoppingItems = db.data.shoppingItems.filter(s => s.householdId !== householdId)
  db.data.pantryItems = db.data.pantryItems.filter(p => p.householdId !== householdId)

  await db.save()
  sendOk(res, true, 'Household deleted')
}))

router.post('/leave', requireAuth, asyncHandler(async (req, res) => {
  const householdId = req.auth.user.currentHouseholdId
  if (!householdId) {
    return sendOk(res, true)
  }

  const currentMember = db.data.householdMembers.find(candidate => (
    candidate.householdId === householdId && candidate.userId === req.auth.user.id
  ))

  db.data.householdMembers = db.data.householdMembers.filter(candidate => !(
    candidate.householdId === householdId && candidate.userId === req.auth.user.id
  ))

  req.auth.user.currentHouseholdId = undefined

  const remainingMembers = db.data.householdMembers.filter(candidate => candidate.householdId === householdId)
  if (remainingMembers.length === 0) {
    db.data.households = db.data.households.filter(candidate => candidate.id !== householdId)
    db.data.invites = db.data.invites.filter(candidate => candidate.householdId !== householdId)
    db.data.householdPreferences = db.data.householdPreferences.filter(candidate => candidate.householdId !== householdId)
    db.data.recipes = db.data.recipes.filter(candidate => candidate.householdId !== householdId)
    db.data.mealAssignments = db.data.mealAssignments.filter(candidate => candidate.householdId !== householdId)
    db.data.shoppingItems = db.data.shoppingItems.filter(candidate => candidate.householdId !== householdId)
    db.data.pantryItems = db.data.pantryItems.filter(candidate => candidate.householdId !== householdId)
  } else if (currentMember?.role === 'admin' && !remainingMembers.some(candidate => candidate.role === 'admin')) {
    remainingMembers[0].role = 'admin'
  }

  await db.save()
  sendOk(res, true, 'Left household')
}))

export default router
