import { createClient } from '@supabase/supabase-js'
import { createSeedData } from './seed.js'
import { normalizeHealthTargets, normalizeMealPeriods } from './utils.js'
import { logger } from './logger.js'

const MAX_CACHE_ENTRIES = 200
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

const COLLECTIONS = [
  'users', 'households', 'householdMembers', 'invites',
  'householdPreferences', 'recipes', 'mealAssignments',
  'shoppingItems', 'pantryItems', 'recipeReviews', 'sessions', 'meta',
]

export class SupabaseDatabase {
  data = null
  #supabase = null
  #cleanupTimer = null

  /** @type {Map<string, object>} Token → session for O(1) auth lookups */
  sessionIndex = new Map()

  constructor(supabaseUrl, supabaseKey) {
    try {
      this.#supabase = createClient(supabaseUrl, supabaseKey)
      logger.info('Supabase client created', { url: supabaseUrl })
    } catch (error) {
      logger.error('Failed to create Supabase client', { error: error.message })
      throw error
    }
  }

  async load() {
    try {
      const { data: rows, error } = await this.#supabase
        .from('collections')
        .select('name, data')

      if (error) {
        logger.error('Failed to load from Supabase', { error: error.message })
        throw error
      }

      if (rows && rows.length > 0) {
        const result = {}
        for (const row of rows) {
          try {
            result[row.name] = JSON.parse(row.data)
          } catch {
            result[row.name] = row.name === 'meta' ? {} : []
          }
        }
        this.data = normalizeData(result)
      } else {
        this.data = createSeedData()
        await this.#saveAllToSupabase()
      }

      this.#cleanupExpiredSessions()
      this.#evictStaleCaches()
      this.#rebuildSessionIndex()

      this.#cleanupTimer = setInterval(() => {
        this.#cleanupExpiredSessions()
        this.#rebuildSessionIndex()
        this.save()
      }, SESSION_CLEANUP_INTERVAL_MS)
      this.#cleanupTimer.unref()

      logger.info('Connected to Supabase database')
      return this.data
    } catch (error) {
      logger.error('Failed to load Supabase database', { error: error.message })
      throw error
    }
  }

  async #saveAllToSupabase() {
    const operations = []
    for (const name of COLLECTIONS) {
      const value = name === 'meta' ? this.data.meta : this.data[name]
      operations.push({
        name,
        data: JSON.stringify(value || (name === 'meta' ? {} : [])),
      })
    }

    for (const op of operations) {
      const { error } = await this.#supabase
        .from('collections')
        .upsert({ name: op.name, data: op.data }, { onConflict: 'name' })

      if (error) {
        logger.error('Failed to save collection to Supabase', {
          collection: op.name,
          error: error.message,
        })
        throw error
      }
    }
  }

  #rebuildSessionIndex() {
    this.sessionIndex.clear()
    for (const session of this.data.sessions) {
      this.sessionIndex.set(session.accessToken, session)
    }
  }

  async save() {
    if (!this.data) {
      this.data = createSeedData()
    }

    try {
      await this.#saveAllToSupabase()
    } catch (error) {
      logger.error('Database write failed', { error: error.message })
    }
  }

  close() {
    if (this.#cleanupTimer) clearInterval(this.#cleanupTimer)
  }

  #cleanupExpiredSessions() {
    const now = Date.now()
    const before = this.data.sessions.length
    this.data.sessions = this.data.sessions.filter(
      session => new Date(session.expiresAt).getTime() > now
    )
    const removed = before - this.data.sessions.length
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} expired session(s)`)
    }
  }

  #evictStaleCaches() {
    const cutoff = Date.now() - MAX_CACHE_AGE_MS

    for (const cacheKey of ['nutritionCache', 'aiSummaryCache', 'aiAskCache']) {
      const cache = this.data.meta[cacheKey]
      if (!cache || typeof cache !== 'object') continue

      const entries = Object.entries(cache)
      let removed = 0

      for (const [key, value] of entries) {
        const timestamp = value?.estimatedAt || value?.generatedAt
        if (timestamp && new Date(timestamp).getTime() < cutoff) {
          delete cache[key]
          removed++
        }
      }

      const remaining = Object.entries(cache)
      if (remaining.length > MAX_CACHE_ENTRIES) {
        const sorted = remaining.sort((a, b) => {
          const timeA = new Date(a[1]?.estimatedAt || a[1]?.generatedAt || 0).getTime()
          const timeB = new Date(b[1]?.estimatedAt || b[1]?.generatedAt || 0).getTime()
          return timeA - timeB
        })
        const toRemove = sorted.slice(0, sorted.length - MAX_CACHE_ENTRIES)
        for (const [key] of toRemove) {
          delete cache[key]
          removed++
        }
      }

      if (removed > 0) {
        logger.info(`Evicted ${removed} stale ${cacheKey} entry/entries`)
      }
    }
  }
}

function normalizeData(data) {
  return {
    ...data,
    users: (data.users || []).map(user => ({
      ...user,
      healthTargets: normalizeHealthTargets(user.healthTargets),
    })),
    households: data.households || [],
    householdMembers: data.householdMembers || [],
    invites: data.invites || [],
    householdPreferences: (data.householdPreferences || []).map(preferences => ({
      householdId: preferences.householdId,
      dietaryPreferences: Array.isArray(preferences.dietaryPreferences) ? preferences.dietaryPreferences : [],
      mealPeriods: normalizeMealPeriods(preferences.mealPeriods),
    })),
    recipes: data.recipes || [],
    mealAssignments: (data.mealAssignments || []).map(assignment => ({
      ...assignment,
      repeatWeekly: Boolean(assignment.repeatWeekly),
      recurrenceId: assignment.recurrenceId || undefined,
    })),
    shoppingItems: data.shoppingItems || [],
    pantryItems: (data.pantryItems || []).map(item => ({
      ...item,
      expiresAt: item.expiresAt || undefined,
    })),
    recipeReviews: data.recipeReviews || [],
    sessions: data.sessions || [],
    meta: {
      ...(data.meta || {}),
      nutritionCache: data.meta?.nutritionCache || {},
      aiSummaryCache: data.meta?.aiSummaryCache || {},
      aiAskCache: data.meta?.aiAskCache || {},
    },
  }
}
