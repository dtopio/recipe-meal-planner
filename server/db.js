import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { createSeedData } from './seed.js'
import { normalizeHealthTargets, normalizeMealPeriods } from './utils.js'
import { logger } from './logger.js'
import { config } from './config.js'
import { SupabaseDatabase } from './supabase-db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDirectory = path.join(__dirname, 'data')
const dbFile = path.join(dataDirectory, 'mealsync.db')
const legacyJsonFile = path.join(dataDirectory, 'db.json')

const MAX_CACHE_ENTRIES = 200
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

// Each collection is stored as a single JSON row keyed by name.
// This gives us ACID writes and file locking from SQLite while keeping
// the same in-memory data model the rest of the codebase uses.
const COLLECTIONS = [
  'users', 'households', 'householdMembers', 'invites',
  'householdPreferences', 'recipes', 'mealAssignments',
  'shoppingItems', 'pantryItems', 'recipeReviews', 'sessions', 'meta',
]

class SqliteDatabase {
  data = null
  #sqlite = null
  #saveStmt = null
  #cleanupTimer = null

  /** @type {Map<string, object>} Token → session for O(1) auth lookups */
  sessionIndex = new Map()

  async load() {
    mkdirSync(dataDirectory, { recursive: true })

    this.#sqlite = new Database(dbFile)

    // Enable WAL mode for better concurrent read performance
    this.#sqlite.pragma('journal_mode = WAL')
    this.#sqlite.pragma('busy_timeout = 5000')

    // Create the collections table if it doesn't exist
    this.#sqlite.exec(`
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        data TEXT NOT NULL
      )
    `)

    this.#saveStmt = this.#sqlite.prepare(
      'INSERT OR REPLACE INTO collections (name, data) VALUES (?, ?)'
    )

    // Try to load from SQLite first
    const existing = this.#loadFromSqlite()

    if (existing) {
      this.data = normalizeData(existing)
    } else {
      // Try to migrate from legacy db.json
      const migrated = await this.#migrateFromJson()
      if (migrated) {
        this.data = normalizeData(migrated)
        logger.info('Migrated data from db.json to SQLite')
      } else {
        this.data = createSeedData()
      }
      this.#saveAllToSqlite()
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

  #loadFromSqlite() {
    const row = this.#sqlite.prepare('SELECT COUNT(*) as count FROM collections').get()
    if (row.count === 0) return null

    const result = {}
    const rows = this.#sqlite.prepare('SELECT name, data FROM collections').all()
    for (const row of rows) {
      try {
        result[row.name] = JSON.parse(row.data)
      } catch {
        result[row.name] = row.name === 'meta' ? {} : []
      }
    }

    return result
  }

  async #migrateFromJson() {
    if (!existsSync(legacyJsonFile)) return null

    try {
      const raw = await readFile(legacyJsonFile, 'utf8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  #saveAllToSqlite() {
    const saveAll = this.#sqlite.transaction(() => {
      for (const name of COLLECTIONS) {
        const value = name === 'meta' ? this.data.meta : this.data[name]
        this.#saveStmt.run(name, JSON.stringify(value || (name === 'meta' ? {} : [])))
      }
    })
    saveAll()
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
      this.#saveAllToSqlite()
    } catch (error) {
      logger.error('Database write failed', { error: error.message })
    }
  }

  close() {
    if (this.#cleanupTimer) clearInterval(this.#cleanupTimer)
    if (this.#sqlite) this.#sqlite.close()
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

logger.info('Database config check', {
  supabaseUrlSet: !!config.supabaseUrl,
  supabaseUrl: config.supabaseUrl || 'NOT SET',
  supabaseKeySet: !!config.supabaseKey,
})

let db
if (config.supabaseUrl) {
  logger.info('Using Supabase database', { url: config.supabaseUrl })
  db = new SupabaseDatabase(config.supabaseUrl, config.supabaseKey)
} else {
  logger.info('Using SQLite database (no SUPABASE_URL env var found)')
  db = new SqliteDatabase()
}

export { db }

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
