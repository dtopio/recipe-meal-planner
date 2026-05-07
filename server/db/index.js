import postgres from 'postgres'
import { logger } from '../logger.js'

let sql = null

export async function connectDb(databaseUrl) {
  sql = postgres(databaseUrl, {
    ssl: 'require',
    max: 20,
  })

  try {
    await sql`SELECT 1`
    logger.info('Connected to Postgres via Supabase')
  } catch (error) {
    logger.error('Failed to connect to Postgres', { error: error.message })
    throw error
  }
}

export async function closeDb() {
  if (sql) {
    await sql.end()
  }
}

// ────────────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────────────

export async function getUserById(id) {
  const result = await sql`SELECT * FROM users WHERE id = ${id}`
  return result.length > 0 ? toUserObject(result[0]) : null
}

export async function getUserByEmail(email) {
  const result = await sql`SELECT * FROM users WHERE email = ${email}`
  return result.length > 0 ? toUserObject(result[0]) : null
}

export async function createUser(user) {
  const result = await sql`
    INSERT INTO users (id, email, password, display_name, avatar_url, created_at, current_household_id, health_targets)
    VALUES (${user.id}, ${user.email}, ${user.password}, ${user.displayName}, ${user.avatarUrl}, ${user.createdAt}, ${user.currentHouseholdId || null}, ${JSON.stringify(user.healthTargets || {})})
    RETURNING *
  `
  return toUserObject(result[0])
}

export async function updateUser(id, fields) {
  const updates = Object.entries(fields).map(([key, value]) => {
    const col = toSnakeCase(key)
    if (key === 'healthTargets') return [col, JSON.stringify(value)]
    return [col, value]
  })

  const setClauses = updates.map(([col, val], i) => `${col} = $${i + 2}`).join(', ')
  const values = updates.map(([, val]) => val)

  const result = await sql`
    UPDATE users SET ${sql(updates)} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toUserObject(result[0]) : null
}

export async function deleteUser(id) {
  await sql`DELETE FROM users WHERE id = ${id}`
}

// ────────────────────────────────────────────────────
// SESSIONS
// ────────────────────────────────────────────────────

export async function getSessionByToken(token) {
  const result = await sql`SELECT * FROM sessions WHERE access_token = ${token}`
  return result.length > 0 ? toSessionObject(result[0]) : null
}

export async function createSession(session) {
  const result = await sql`
    INSERT INTO sessions (access_token, user_id, expires_at)
    VALUES (${session.accessToken}, ${session.userId}, ${session.expiresAt})
    RETURNING *
  `
  return toSessionObject(result[0])
}

export async function deleteSession(token) {
  await sql`DELETE FROM sessions WHERE access_token = ${token}`
}

export async function deleteSessionsForUser(userId, exceptToken) {
  if (exceptToken) {
    await sql`DELETE FROM sessions WHERE user_id = ${userId} AND access_token != ${exceptToken}`
  } else {
    await sql`DELETE FROM sessions WHERE user_id = ${userId}`
  }
}

export async function deleteExpiredSessions() {
  await sql`DELETE FROM sessions WHERE expires_at < NOW()`
}

// ────────────────────────────────────────────────────
// HOUSEHOLDS
// ────────────────────────────────────────────────────

export async function getHouseholdById(id) {
  const result = await sql`SELECT * FROM households WHERE id = ${id}`
  return result.length > 0 ? toHouseholdObject(result[0]) : null
}

export async function createHousehold(household) {
  const result = await sql`
    INSERT INTO households (id, name, color, avatar_url, created_at)
    VALUES (${household.id}, ${household.name}, ${household.color}, ${household.avatarUrl}, ${household.createdAt})
    RETURNING *
  `
  return toHouseholdObject(result[0])
}

export async function updateHousehold(id, fields) {
  const result = await sql`
    UPDATE households SET ${sql(Object.fromEntries(Object.entries(fields).map(([k, v]) => [toSnakeCase(k), v])))} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toHouseholdObject(result[0]) : null
}

export async function deleteHousehold(id) {
  await sql`DELETE FROM households WHERE id = ${id}`
}

// ────────────────────────────────────────────────────
// HOUSEHOLD MEMBERS
// ────────────────────────────────────────────────────

export async function getMembersByHousehold(householdId) {
  const result = await sql`SELECT * FROM household_members WHERE household_id = ${householdId}`
  return result.map(toMemberObject)
}

export async function getMemberByUserAndHousehold(userId, householdId) {
  const result = await sql`SELECT * FROM household_members WHERE user_id = ${userId} AND household_id = ${householdId}`
  return result.length > 0 ? toMemberObject(result[0]) : null
}

export async function createMember(member) {
  const result = await sql`
    INSERT INTO household_members (id, user_id, household_id, display_name, avatar_url, role, joined_at)
    VALUES (${member.id}, ${member.userId}, ${member.householdId}, ${member.displayName}, ${member.avatarUrl}, ${member.role}, ${member.joinedAt})
    RETURNING *
  `
  return toMemberObject(result[0])
}

export async function updateMember(id, fields) {
  const result = await sql`
    UPDATE household_members SET ${sql(Object.fromEntries(Object.entries(fields).map(([k, v]) => [toSnakeCase(k), v])))} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toMemberObject(result[0]) : null
}

export async function deleteMember(id) {
  await sql`DELETE FROM household_members WHERE id = ${id}`
}

export async function deleteMembersByHousehold(householdId) {
  await sql`DELETE FROM household_members WHERE household_id = ${householdId}`
}

// ────────────────────────────────────────────────────
// INVITES
// ────────────────────────────────────────────────────

export async function getInviteByCode(code) {
  const result = await sql`SELECT * FROM invites WHERE code = ${code}`
  return result.length > 0 ? toInviteObject(result[0]) : null
}

export async function getInviteByHousehold(householdId) {
  const result = await sql`SELECT * FROM invites WHERE household_id = ${householdId}`
  return result.length > 0 ? toInviteObject(result[0]) : null
}

export async function createInvite(invite) {
  const result = await sql`
    INSERT INTO invites (code, household_id, expires_at, created_by)
    VALUES (${invite.code}, ${invite.householdId}, ${invite.expiresAt}, ${invite.createdBy})
    RETURNING *
  `
  return toInviteObject(result[0])
}

export async function deleteInviteByHousehold(householdId) {
  await sql`DELETE FROM invites WHERE household_id = ${householdId}`
}

// ────────────────────────────────────────────────────
// HOUSEHOLD PREFERENCES
// ────────────────────────────────────────────────────

export async function getPreferences(householdId) {
  const result = await sql`SELECT * FROM household_preferences WHERE household_id = ${householdId}`
  return result.length > 0 ? toPreferencesObject(result[0]) : null
}

export async function upsertPreferences(householdId, fields) {
  const result = await sql`
    INSERT INTO household_preferences (household_id, dietary_preferences, meal_periods)
    VALUES (${householdId}, ${fields.dietaryPreferences || '{}':sql.raw('\'{}\'')}, ${fields.mealPeriods || '{}':sql.raw('\'{}\'')})
    ON CONFLICT (household_id) DO UPDATE SET
      dietary_preferences = COALESCE(EXCLUDED.dietary_preferences, household_preferences.dietary_preferences),
      meal_periods = COALESCE(EXCLUDED.meal_periods, household_preferences.meal_periods)
    RETURNING *
  `
  return toPreferencesObject(result[0])
}

// ────────────────────────────────────────────────────
// RECIPES
// ────────────────────────────────────────────────────

export async function getRecipesByHousehold(householdId) {
  const result = await sql`SELECT * FROM recipes WHERE household_id = ${householdId} ORDER BY created_at DESC`
  return result.map(toRecipeObject)
}

export async function getRecipeById(id) {
  const result = await sql`SELECT * FROM recipes WHERE id = ${id}`
  return result.length > 0 ? toRecipeObject(result[0]) : null
}

export async function getRecipeBySourceUrl(householdId, sourceUrl) {
  const result = await sql`SELECT * FROM recipes WHERE household_id = ${householdId} AND source_url = ${sourceUrl}`
  return result.length > 0 ? toRecipeObject(result[0]) : null
}

export async function createRecipe(recipe) {
  const result = await sql`
    INSERT INTO recipes (id, household_id, title, description, image_url, prep_time, cook_time, servings, tags, ingredients, instructions, source_url, credits, created_by, created_at, updated_at)
    VALUES (${recipe.id}, ${recipe.householdId}, ${recipe.title}, ${recipe.description}, ${recipe.imageUrl}, ${recipe.prepTime}, ${recipe.cookTime}, ${recipe.servings}, ${JSON.stringify(recipe.tags || [])}, ${JSON.stringify(recipe.ingredients || [])}, ${JSON.stringify(recipe.instructions || [])}, ${recipe.sourceUrl}, ${recipe.credits}, ${recipe.createdBy}, ${recipe.createdAt}, ${recipe.updatedAt})
    RETURNING *
  `
  return toRecipeObject(result[0])
}

export async function updateRecipe(id, fields) {
  const updates = {}
  for (const [key, value] of Object.entries(fields)) {
    if (['tags', 'ingredients', 'instructions'].includes(key)) {
      updates[toSnakeCase(key)] = JSON.stringify(value)
    } else {
      updates[toSnakeCase(key)] = value
    }
  }
  const result = await sql`
    UPDATE recipes SET ${sql(updates)} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toRecipeObject(result[0]) : null
}

export async function deleteRecipe(id) {
  await sql`DELETE FROM recipes WHERE id = ${id}`
}

// ────────────────────────────────────────────────────
// MEAL ASSIGNMENTS
// ────────────────────────────────────────────────────

export async function getAssignmentsByHousehold(householdId) {
  const result = await sql`SELECT * FROM meal_assignments WHERE household_id = ${householdId}`
  return result.map(toAssignmentObject)
}

export async function getAssignmentsByWeek(householdId, startDate, endDate) {
  const result = await sql`
    SELECT * FROM meal_assignments
    WHERE household_id = ${householdId} AND date >= ${startDate} AND date < ${endDate}
    ORDER BY date, meal_type
  `
  return result.map(toAssignmentObject)
}

export async function getAssignmentById(id) {
  const result = await sql`SELECT * FROM meal_assignments WHERE id = ${id}`
  return result.length > 0 ? toAssignmentObject(result[0]) : null
}

export async function getAssignmentBySlot(householdId, date, mealType) {
  const result = await sql`SELECT * FROM meal_assignments WHERE household_id = ${householdId} AND date = ${date} AND meal_type = ${mealType}`
  return result.map(toAssignmentObject)
}

export async function createAssignment(assignment) {
  const result = await sql`
    INSERT INTO meal_assignments (id, household_id, date, meal_type, recipe_id, notes, servings, repeat_weekly, recurrence_id)
    VALUES (${assignment.id}, ${assignment.householdId}, ${assignment.date}, ${assignment.mealType}, ${assignment.recipeId}, ${assignment.notes}, ${assignment.servings}, ${assignment.repeatWeekly || false}, ${assignment.recurrenceId})
    RETURNING *
  `
  return toAssignmentObject(result[0])
}

export async function createAssignments(assignments) {
  if (assignments.length === 0) return []
  const result = await sql`
    INSERT INTO meal_assignments (id, household_id, date, meal_type, recipe_id, notes, servings, repeat_weekly, recurrence_id)
    VALUES ${sql(assignments.map(a => [a.id, a.householdId, a.date, a.mealType, a.recipeId, a.notes, a.servings, a.repeatWeekly || false, a.recurrenceId]))}
    RETURNING *
  `
  return result.map(toAssignmentObject)
}

export async function updateAssignment(id, fields) {
  const result = await sql`
    UPDATE meal_assignments SET ${sql(Object.fromEntries(Object.entries(fields).map(([k, v]) => [toSnakeCase(k), v])))} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toAssignmentObject(result[0]) : null
}

export async function deleteAssignment(id) {
  await sql`DELETE FROM meal_assignments WHERE id = ${id}`
}

export async function deleteAssignmentsBySlot(householdId, date, mealType) {
  await sql`DELETE FROM meal_assignments WHERE household_id = ${householdId} AND date = ${date} AND meal_type = ${mealType}`
}

export async function deleteAssignmentsByRecipe(recipeId) {
  await sql`DELETE FROM meal_assignments WHERE recipe_id = ${recipeId}`
}

// ────────────────────────────────────────────────────
// SHOPPING ITEMS
// ────────────────────────────────────────────────────

export async function getShoppingItems(householdId) {
  const result = await sql`SELECT * FROM shopping_items WHERE household_id = ${householdId} ORDER BY added_at DESC`
  return result.map(toShoppingItemObject)
}

export async function getShoppingItemById(id) {
  const result = await sql`SELECT * FROM shopping_items WHERE id = ${id}`
  return result.length > 0 ? toShoppingItemObject(result[0]) : null
}

export async function findShoppingItem(householdId, name, unit) {
  const result = await sql`SELECT * FROM shopping_items WHERE household_id = ${householdId} AND name = ${name} AND unit = ${unit} AND checked = false`
  return result.length > 0 ? toShoppingItemObject(result[0]) : null
}

export async function createShoppingItem(item) {
  const result = await sql`
    INSERT INTO shopping_items (id, household_id, name, quantity, unit, category, checked, source_recipe_id, source_recipe_name, added_by, added_at, sync_status, generated, source_week_start)
    VALUES (${item.id}, ${item.householdId}, ${item.name}, ${item.quantity}, ${item.unit}, ${item.category}, ${item.checked || false}, ${item.sourceRecipeId}, ${item.sourceRecipeName}, ${item.addedBy}, ${item.addedAt}, ${item.syncStatus || 'synced'}, ${item.generated}, ${item.sourceWeekStart})
    RETURNING *
  `
  return toShoppingItemObject(result[0])
}

export async function updateShoppingItem(id, fields) {
  const result = await sql`
    UPDATE shopping_items SET ${sql(Object.fromEntries(Object.entries(fields).map(([k, v]) => [toSnakeCase(k), v])))} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toShoppingItemObject(result[0]) : null
}

export async function deleteShoppingItem(id) {
  await sql`DELETE FROM shopping_items WHERE id = ${id}`
}

export async function deleteCheckedItems(householdId, ids) {
  if (ids.length === 0) return
  await sql`DELETE FROM shopping_items WHERE household_id = ${householdId} AND id = ANY(${ids})`
}

export async function deleteShoppingItemsByHousehold(householdId) {
  await sql`DELETE FROM shopping_items WHERE household_id = ${householdId}`
}

export async function deleteGeneratedItemsByWeek(householdId, weekStart) {
  await sql`DELETE FROM shopping_items WHERE household_id = ${householdId} AND generated = true AND source_week_start = ${weekStart}`
}

export async function createShoppingItems(items) {
  if (items.length === 0) return []
  const result = await sql`
    INSERT INTO shopping_items (id, household_id, name, quantity, unit, category, checked, source_recipe_id, source_recipe_name, added_by, added_at, sync_status, generated, source_week_start)
    VALUES ${sql(items.map(i => [i.id, i.householdId, i.name, i.quantity, i.unit, i.category, i.checked || false, i.sourceRecipeId, i.sourceRecipeName, i.addedBy, i.addedAt, i.syncStatus || 'synced', i.generated, i.sourceWeekStart]))}
    RETURNING *
  `
  return result.map(toShoppingItemObject)
}

// ────────────────────────────────────────────────────
// PANTRY ITEMS
// ────────────────────────────────────────────────────

export async function getPantryItems(householdId) {
  const result = await sql`SELECT * FROM pantry_items WHERE household_id = ${householdId} ORDER BY name`
  return result.map(toPantryItemObject)
}

export async function getPantryItemById(id) {
  const result = await sql`SELECT * FROM pantry_items WHERE id = ${id}`
  return result.length > 0 ? toPantryItemObject(result[0]) : null
}

export async function findPantryItem(householdId, name, unit) {
  const result = await sql`SELECT * FROM pantry_items WHERE household_id = ${householdId} AND name = ${name} AND unit = ${unit}`
  return result.length > 0 ? toPantryItemObject(result[0]) : null
}

export async function createPantryItem(item) {
  const result = await sql`
    INSERT INTO pantry_items (id, household_id, name, quantity, unit, category, low_stock_threshold, expires_at, updated_at)
    VALUES (${item.id}, ${item.householdId}, ${item.name}, ${item.quantity}, ${item.unit}, ${item.category}, ${item.lowStockThreshold}, ${item.expiresAt}, ${item.updatedAt})
    RETURNING *
  `
  return toPantryItemObject(result[0])
}

export async function updatePantryItem(id, fields) {
  const result = await sql`
    UPDATE pantry_items SET ${sql(Object.fromEntries(Object.entries(fields).map(([k, v]) => [toSnakeCase(k), v])))} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toPantryItemObject(result[0]) : null
}

export async function deletePantryItem(id) {
  await sql`DELETE FROM pantry_items WHERE id = ${id}`
}

// ────────────────────────────────────────────────────
// RECIPE REVIEWS
// ────────────────────────────────────────────────────

export async function getReviewsByRecipe(recipeId) {
  const result = await sql`SELECT * FROM recipe_reviews WHERE recipe_id = ${recipeId}`
  return result.map(toReviewObject)
}

export async function getReviewByUserAndRecipe(userId, recipeId) {
  const result = await sql`SELECT * FROM recipe_reviews WHERE user_id = ${userId} AND recipe_id = ${recipeId}`
  return result.length > 0 ? toReviewObject(result[0]) : null
}

export async function createReview(review) {
  const result = await sql`
    INSERT INTO recipe_reviews (id, recipe_id, user_id, rating, note, created_at, updated_at)
    VALUES (${review.id}, ${review.recipeId}, ${review.userId}, ${review.rating}, ${review.note}, ${review.createdAt}, ${review.updatedAt})
    RETURNING *
  `
  return toReviewObject(result[0])
}

export async function updateReview(id, fields) {
  const result = await sql`
    UPDATE recipe_reviews SET ${sql(Object.fromEntries(Object.entries(fields).map(([k, v]) => [toSnakeCase(k), v])))} WHERE id = ${id} RETURNING *
  `
  return result.length > 0 ? toReviewObject(result[0]) : null
}

export async function deleteReview(userId, recipeId) {
  await sql`DELETE FROM recipe_reviews WHERE user_id = ${userId} AND recipe_id = ${recipeId}`
}

export async function deleteReviewsByUser(userId) {
  await sql`DELETE FROM recipe_reviews WHERE user_id = ${userId}`
}

// ────────────────────────────────────────────────────
// META (Caches)
// ────────────────────────────────────────────────────

export async function getMetaValue(key) {
  const result = await sql`SELECT value FROM meta WHERE key = ${key}`
  return result.length > 0 ? result[0].value : null
}

export async function setMetaValue(key, value) {
  await sql`
    INSERT INTO meta (key, value) VALUES (${key}, ${JSON.stringify(value)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `
}

export async function deleteMetaKeys(keys) {
  if (keys.length === 0) return
  await sql`DELETE FROM meta WHERE key = ANY(${keys})`
}

// ────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function toUserObject(row) {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    currentHouseholdId: row.current_household_id,
    healthTargets: row.health_targets || {},
  }
}

function toSessionObject(row) {
  return {
    accessToken: row.access_token,
    userId: row.user_id,
    expiresAt: row.expires_at,
  }
}

function toHouseholdObject(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  }
}

function toMemberObject(row) {
  return {
    id: row.id,
    userId: row.user_id,
    householdId: row.household_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at,
  }
}

function toInviteObject(row) {
  return {
    code: row.code,
    householdId: row.household_id,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
  }
}

function toPreferencesObject(row) {
  return {
    householdId: row.household_id,
    dietaryPreferences: row.dietary_preferences || [],
    mealPeriods: row.meal_periods || [],
  }
}

function toRecipeObject(row) {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    prepTime: row.prep_time,
    cookTime: row.cook_time,
    servings: row.servings,
    tags: row.tags || [],
    ingredients: row.ingredients || [],
    instructions: row.instructions || [],
    sourceUrl: row.source_url,
    credits: row.credits,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toAssignmentObject(row) {
  return {
    id: row.id,
    householdId: row.household_id,
    date: row.date,
    mealType: row.meal_type,
    recipeId: row.recipe_id,
    notes: row.notes,
    servings: row.servings,
    repeatWeekly: row.repeat_weekly,
    recurrenceId: row.recurrence_id,
  }
}

function toShoppingItemObject(row) {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    checked: row.checked,
    sourceRecipeId: row.source_recipe_id,
    sourceRecipeName: row.source_recipe_name,
    addedBy: row.added_by,
    addedAt: row.added_at,
    syncStatus: row.sync_status,
    generated: row.generated,
    sourceWeekStart: row.source_week_start,
  }
}

function toPantryItemObject(row) {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    category: row.category,
    lowStockThreshold: row.low_stock_threshold,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
  }
}

function toReviewObject(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    userId: row.user_id,
    rating: row.rating,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
