import { nowIso } from './utils.js'

export function createSeedData() {
  return {
    users: [],
    households: [],
    householdMembers: [],
    invites: [],
    householdPreferences: [],
    recipes: [],
    mealAssignments: [],
    shoppingItems: [],
    pantryItems: [],
    recipeReviews: [],
    sessions: [],
    meta: {
      seededAt: nowIso(),
      seedMode: 'empty',
    },
  }
}
