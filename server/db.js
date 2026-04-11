import pg from 'pg'
import { createSeedData } from './seed.js'
import { normalizeHealthTargets, normalizeMealPeriods } from './utils.js'
import { logger } from './logger.js'

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL

const MAX_CACHE_ENTRIES = 200
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const SAVE_DEBOUNCE_MS = 2000

const COLLECTIONS = [
  'users', 'households', 'householdMembers', 'invites',
  'householdPreferences', 'recipes', 'mealAssignments',
  'shoppingItems', 'pantryItems', 'recipeReviews', 'sessions', 'meta',
]

class PostgresDatabase {
  data = null
  #pool = null
  #cleanupTimer = null
  #saveTimer = null
  #saving = false

  /** @type {Map<string, object>} Token → session for O(1) auth lookups */
  sessionIndex = new Map()

  async load() {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required')
    }

    this.#pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    })

    // Verify connection
    try {
      const client = await this.#pool.connect()
      client.release()
      logger.info('Connected to Postgres (Supabase)')
    } catch (error) {
      logger.error('Failed to connect to Postgres', { error: error.message })
      throw error
    }

    // Create the collections table if it doesn't exist
    await this.#pool.query(`
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        data JSONB NOT NULL
      )
    `)

    // Try to load existing data
    const existing = await this.#loadFromPostgres()

    if (existing) {
      this.data = normalizeData(existing)
      logger.info('Loaded data from Postgres')
    } else {
      this.data = createSeedData()
      await this.#saveAllToPostgres()
      logger.info('Seeded fresh database in Postgres')
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

    return this.data
  }

  async #loadFromPostgres() {
    const { rows } = await this.#pool.query('SELECT name, data FROM collections')
    if (rows.length === 0) return null

    const result = {}
    for (const row of rows) {
      result[row.name] = row.data
    }

    return result
  }

  async #saveAllToPostgres() {
    const client = await this.#pool.connect()
    try {
      await client.query('BEGIN')
      for (const name of COLLECTIONS) {
        const value = name === 'meta' ? this.data.meta : this.data[name]
        const json = JSON.stringify(value || (name === 'meta' ? {} : []))
        await client.query(
          `INSERT INTO collections (name, data) VALUES ($1, $2::jsonb)
           ON CONFLICT (name) DO UPDATE SET data = $2::jsonb`,
          [name, json]
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
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

    // Debounce rapid saves
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer)
    }

    if (this.#saving) {
      // Queue another save after current one finishes
      this.#saveTimer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS)
      return
    }

    this.#saving = true
    try {
      await this.#saveAllToPostgres()
    } catch (error) {
      logger.error('Database write failed', { error: error.message })
    } finally {
      this.#saving = false
    }
  }

  close() {
    if (this.#cleanupTimer) clearInterval(this.#cleanupTimer)
    if (this.#saveTimer) clearTimeout(this.#saveTimer)
    if (this.#pool) this.#pool.end()
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

export const db = new PostgresDatabase()

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
