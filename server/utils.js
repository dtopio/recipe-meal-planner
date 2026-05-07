import { randomUUID } from 'node:crypto'

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']
export const DEFAULT_MEAL_PERIODS = [...MEAL_TYPES]

export const DEFAULT_HEALTH_TARGETS = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 70,
}

export function createId(prefix = 'id') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function pad(value) {
  return String(value).padStart(2, '0')
}

export function toDateKey(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function startOfWeek(input = new Date()) {
  const date = input instanceof Date ? new Date(input) : new Date(input)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + diff)
  return date
}

export function getWeekDateKeys(weekStart) {
  const start = typeof weekStart === 'string'
    ? parseDateKey(weekStart)
    : startOfWeek(weekStart)

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return toDateKey(date)
  })
}

export function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(dateKey, days) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function nowIso() {
  return new Date().toISOString()
}

export function plusDaysIso(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function daysAgoIso(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export function createInviteCode(householdName) {
  const prefix = householdName
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
    .slice(0, 10) || 'HOUSEHOLD'

  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 4).toUpperCase()}`
}

export function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    currentHouseholdId: user.currentHouseholdId || undefined,
    healthTargets: normalizeHealthTargets(user.healthTargets),
    hasPassword: Boolean(user.password),
  }
}

export function normalizeHealthTargets(targets = {}) {
  return {
    calories: Number.isFinite(Number(targets.calories)) && Number(targets.calories) > 0 ? Number(targets.calories) : DEFAULT_HEALTH_TARGETS.calories,
    protein: Number.isFinite(Number(targets.protein)) && Number(targets.protein) > 0 ? Number(targets.protein) : DEFAULT_HEALTH_TARGETS.protein,
    carbs: Number.isFinite(Number(targets.carbs)) && Number(targets.carbs) > 0 ? Number(targets.carbs) : DEFAULT_HEALTH_TARGETS.carbs,
    fat: Number.isFinite(Number(targets.fat)) && Number(targets.fat) > 0 ? Number(targets.fat) : DEFAULT_HEALTH_TARGETS.fat,
  }
}

export function normalizeMealPeriodName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeMealPeriods(periods = DEFAULT_MEAL_PERIODS) {
  const normalized = Array.from(new Set(
    (Array.isArray(periods) ? periods : [])
      .map(normalizeMealPeriodName)
      .filter(period => period.length >= 2 && period.length <= 24)
  ))

  return normalized.length > 0 ? normalized.slice(0, 8) : [...DEFAULT_MEAL_PERIODS]
}

export function guessShoppingCategory(name) {
  const value = name.toLowerCase()

  if (/lettuce|tomato|onion|garlic|pepper|basil|mushroom|broccoli|avocado|lime|lemon|cucumber|berry|fruit|spinach|carrot|potato|herb/.test(value)) {
    return 'produce'
  }

  if (/milk|yogurt|cheese|cream|egg|butter/.test(value)) {
    return 'dairy'
  }

  if (/chicken|beef|pork|salmon|fish|pancetta|shrimp|meat/.test(value)) {
    return 'meat'
  }

  if (/bread|tortilla|brioche|bun|roll|pita/.test(value)) {
    return 'bakery'
  }

  if (/ice cream|frozen/.test(value)) {
    return 'frozen'
  }

  if (/paper|soap|sponge|wrap|foil|bag|detergent/.test(value)) {
    return 'household'
  }

  return 'pantry'
}

export function normalizeTags(tags = []) {
  return Array.from(new Set(
    tags
      .flatMap(tag => String(tag).split(','))
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean)
  ))
}

export function parseDurationToMinutes(input) {
  if (!input || typeof input !== 'string') return 0

  const match = input.match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?)$/i)
  if (!match) return 0

  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  return (hours * 60) + minutes
}

export function parseServings(input) {
  if (typeof input === 'number' && Number.isFinite(input)) return input

  if (typeof input === 'string') {
    const match = input.match(/(\d+(?:\.\d+)?)/)
    if (match) return Number(match[1])
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      const servings = parseServings(value)
      if (servings > 0) return servings
    }
  }

  return 4
}

export function parseFraction(value) {
  if (!value) return NaN

  const cleaned = value
    .replace(/\u00bd/g, '1/2')
    .replace(/\u00bc/g, '1/4')
    .replace(/\u00be/g, '3/4')
    .trim()

  if (/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return Number(cleaned)
  }

  if (/^\d+\s+\d+\/\d+$/.test(cleaned)) {
    const [whole, fraction] = cleaned.split(/\s+/)
    return Number(whole) + parseFraction(fraction)
  }

  if (/^\d+\/\d+$/.test(cleaned)) {
    const [top, bottom] = cleaned.split('/').map(Number)
    return bottom ? top / bottom : NaN
  }

  return NaN
}

export function parseIngredientLine(line) {
  const raw = String(line || '').trim().replace(/\s+/g, ' ')
  if (!raw) {
    return { quantity: 1, unit: '', name: '' }
  }

  const units = [
    'teaspoon', 'teaspoons', 'tsp',
    'tablespoon', 'tablespoons', 'tbsp',
    'cup', 'cups',
    'ounce', 'ounces', 'oz',
    'pound', 'pounds', 'lb', 'lbs',
    'gram', 'grams', 'g',
    'kilogram', 'kilograms', 'kg',
    'milliliter', 'milliliters', 'ml',
    'liter', 'liters', 'l',
    'clove', 'cloves',
    'can', 'cans',
    'head', 'heads',
    'slice', 'slices',
    'pinch', 'bunch', 'bunches',
  ]

  const match = raw.match(/^([\d\s./\u00bc-\u00be]+)\s+([a-zA-Z]+)?\s*(.*)$/)
  if (!match) {
    return { quantity: 1, unit: '', name: raw }
  }

  const quantity = parseFraction(match[1])
  const candidateUnit = (match[2] || '').toLowerCase()
  const remainder = match[3]?.trim() || ''

  if (!Number.isFinite(quantity)) {
    return { quantity: 1, unit: '', name: raw }
  }

  if (units.includes(candidateUnit)) {
    return {
      quantity,
      unit: candidateUnit,
      name: remainder || raw,
    }
  }

  return {
    quantity,
    unit: '',
    name: `${candidateUnit} ${remainder}`.trim() || raw,
  }
}

export function sortByCreatedDesc(items) {
  return [...items].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ))
}

export function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function normalizeIngredientName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function ingredientMatchKey(name, unit = '') {
  return `${normalizeIngredientName(name)}::${String(unit).trim().toLowerCase()}`
}
