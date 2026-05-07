import { Router } from 'express'
import { z } from 'zod'
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
import * as db from '../db/index.js'

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

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const householdId = req.auth.user.currentHouseholdId
  if (!householdId) {
    return sendOk(res, { household: null, members: [], invite: null, preferences: null })
  }

  sendOk(res, await getHouseholdBundle(householdId))
}))

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

  await db.createHousehold(household)
  await db.createMember(member)
  await db.deleteInviteByHousehold(household.id)
  await db.createInvite(invite)
  await db.updateUser(req.auth.user.id, { currentHouseholdId: household.id })

  sendOk(res, await getHouseholdBundle(household.id), 'Household created')
}))

router.post('/join', requireAuth, asyncHandler(async (req, res) => {
  const dto = joinHouseholdSchema.parse(req.body)

  if (req.auth.user.currentHouseholdId) {
    return sendError(res, 409, 'Leave your current household before joining a new one', 'ALREADY_IN_HOUSEHOLD')
  }

  const invite = await db.getInviteByCode(dto.inviteCode)
  if (!invite || new Date(invite.expiresAt).getTime() <= Date.now()) {
    return sendError(res, 404, 'That invite code is invalid or has expired', 'INVALID_INVITE')
  }

  const existingMember = await db.getMemberByUserAndHousehold(req.auth.user.id, invite.householdId)

  if (!existingMember) {
    await db.createMember({
      id: createId('member'),
      userId: req.auth.user.id,
      householdId: invite.householdId,
      displayName: req.auth.user.displayName,
      avatarUrl: req.auth.user.avatarUrl,
      role: 'member',
      joinedAt: nowIso(),
    })
  }

  await db.updateUser(req.auth.user.id, { currentHouseholdId: invite.householdId })
  sendOk(res, await getHouseholdBundle(invite.householdId), 'Joined household')
}))

router.post('/invite/regenerate', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const currentMember = await db.getMemberByUserAndHousehold(req.auth.user.id, req.householdId)

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can regenerate invite codes', 'FORBIDDEN')
  }

  const household = await db.getHouseholdById(req.householdId)
  const invite = {
    code: createInviteCode(household?.name || 'Household'),
    householdId: req.householdId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    createdBy: req.auth.user.id,
  }

  await db.deleteInviteByHousehold(req.householdId)
  await db.createInvite(invite)
  sendOk(res, invite, 'Invite code regenerated')
}))

// ── Promote / Demote members ────────────────────────────────────

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
})

router.patch('/members/:memberId/role', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateRoleSchema.parse(req.body)

  const currentMember = await db.getMemberByUserAndHousehold(req.auth.user.id, req.householdId)

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can change member roles', 'FORBIDDEN')
  }

  const members = await db.getMembersByHousehold(req.householdId)
  const targetMember = members.find(candidate => candidate.id === req.params.memberId)

  if (!targetMember) {
    return sendError(res, 404, 'Member not found', 'MEMBER_NOT_FOUND')
  }

  // Prevent demoting yourself if you're the last admin
  if (dto.role === 'member' && targetMember.userId === req.auth.user.id) {
    const adminCount = members.filter(candidate => candidate.role === 'admin').length

    if (adminCount <= 1) {
      return sendError(res, 400, 'Cannot demote yourself when you are the only admin. Promote another member first.', 'LAST_ADMIN')
    }
  }

  await db.updateMember(req.params.memberId, { role: dto.role })
  sendOk(res, await getHouseholdBundle(req.householdId), `${targetMember.displayName} is now ${dto.role === 'admin' ? 'an admin' : 'a member'}`)
}))

router.patch('/preferences', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = preferencesSchema.parse(req.body)

  const preferences = {
    dietaryPreferences: dto.dietaryPreferences,
    mealPeriods: normalizeMealPeriods(dto.mealPeriods),
  }

  await db.upsertPreferences(req.householdId, preferences)
  sendOk(res, await getHouseholdPreferences(req.householdId), 'Household preferences updated')
}))

// ── Update household (rename / color) ───────────────────────────

router.patch('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const dto = updateHouseholdSchema.parse(req.body)

  const currentMember = await db.getMemberByUserAndHousehold(req.auth.user.id, req.householdId)

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can update the household', 'FORBIDDEN')
  }

  const household = await db.getHouseholdById(req.householdId)
  if (!household) {
    return sendError(res, 404, 'Household not found', 'NOT_FOUND')
  }

  const updates = {}
  if (dto.name !== undefined) updates.name = dto.name
  if (dto.color !== undefined) updates.color = dto.color

  await db.updateHousehold(req.householdId, updates)
  sendOk(res, await getHouseholdBundle(req.householdId), 'Household updated')
}))

// ── Kick member ─────────────────────────────────────────────────

router.delete('/members/:memberId', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const currentMember = await db.getMemberByUserAndHousehold(req.auth.user.id, req.householdId)

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can remove members', 'FORBIDDEN')
  }

  const members = await db.getMembersByHousehold(req.householdId)
  const targetMember = members.find(candidate => candidate.id === req.params.memberId)

  if (!targetMember) {
    return sendError(res, 404, 'Member not found', 'MEMBER_NOT_FOUND')
  }

  // Can't kick yourself — use /leave instead
  if (targetMember.userId === req.auth.user.id) {
    return sendError(res, 400, 'You cannot remove yourself. Use the leave option instead.', 'CANNOT_KICK_SELF')
  }

  await db.deleteMember(req.params.memberId)

  const kickedUser = await db.getUserById(targetMember.userId)
  if (kickedUser && kickedUser.currentHouseholdId === req.householdId) {
    await db.updateUser(targetMember.userId, { currentHouseholdId: undefined })
  }

  sendOk(res, await getHouseholdBundle(req.householdId), `${targetMember.displayName} has been removed`)
}))

// ── Delete household ────────────────────────────────────────────

router.delete('/', requireAuth, requireHousehold, asyncHandler(async (req, res) => {
  const currentMember = await db.getMemberByUserAndHousehold(req.auth.user.id, req.householdId)

  if (!currentMember || currentMember.role !== 'admin') {
    return sendError(res, 403, 'Only household admins can delete the household', 'FORBIDDEN')
  }

  const householdId = req.householdId

  const members = await db.getMembersByHousehold(householdId)
  for (const member of members) {
    const user = await db.getUserById(member.userId)
    if (user && user.currentHouseholdId === householdId) {
      await db.updateUser(member.userId, { currentHouseholdId: undefined })
    }
  }

  await db.deleteHousehold(householdId)
  sendOk(res, true, 'Household deleted')
}))

router.post('/leave', requireAuth, asyncHandler(async (req, res) => {
  const householdId = req.auth.user.currentHouseholdId
  if (!householdId) {
    return sendOk(res, true)
  }

  const currentMember = await db.getMemberByUserAndHousehold(req.auth.user.id, householdId)

  const memberToDelete = await db.getMemberByUserAndHousehold(req.auth.user.id, householdId)
  if (memberToDelete) {
    await db.deleteMember(memberToDelete.id)
  }

  await db.updateUser(req.auth.user.id, { currentHouseholdId: undefined })

  const remainingMembers = await db.getMembersByHousehold(householdId)
  if (remainingMembers.length === 0) {
    await db.deleteHousehold(householdId)
  } else if (currentMember?.role === 'admin' && !remainingMembers.some(m => m.role === 'admin')) {
    await db.updateMember(remainingMembers[0].id, { role: 'admin' })
  }

  sendOk(res, true, 'Left household')
}))

export default router
