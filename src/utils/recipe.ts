import type {
  DietaryPreference,
  HealthTargets,
  HouseholdPreferences,
  NutritionTotals,
  PantryItem,
  Recipe,
  RecipeDietaryProfile,
} from '@/types'

const vegetarianBreakers = [
  'chicken', 'beef', 'pork', 'salmon', 'fish', 'shrimp', 'anchovy', 'gelatin', 'bacon', 'turkey', 'ham', 'meat',
]

const halalBreakers = [
  'pork', 'bacon', 'ham', 'wine', 'beer', 'rum', 'vodka', 'whiskey', 'gelatin',
]

const nutBreakers = [
  'almond', 'peanut', 'cashew', 'pecan', 'walnut', 'hazelnut', 'pistachio', 'macadamia', 'nut',
]

const dairyBreakers = [
  'milk', 'butter', 'cream', 'cheese', 'yogurt', 'ghee', 'parmesan', 'feta', 'mozzarella',
]

const preferenceWarnings: Record<DietaryPreference, string> = {
  vegetarian: 'Contains meat or seafood ingredients',
  halal: 'Contains pork, alcohol, or other non-halal ingredients',
  'nut-free': 'Contains tree nuts or peanuts',
  'dairy-free': 'Contains dairy ingredients',
}

function getRecipeText(recipe: Recipe): string {
  return [
    recipe.title,
    recipe.description,
    (recipe.tags ?? []).join(' '),
    (recipe.ingredients ?? []).map(ingredient => ingredient?.name ?? '').join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function supportsPreference(recipeText: string, recipe: Recipe, preference: DietaryPreference): boolean {
  const tags = (recipe.tags ?? []).map(tag => (tag ?? '').toLowerCase())

  switch (preference) {
    case 'vegetarian':
      if (tags.includes('vegetarian')) return true
      return !vegetarianBreakers.some(keyword => recipeText.includes(keyword))
    case 'halal':
      if (tags.includes('halal')) return true
      return !halalBreakers.some(keyword => recipeText.includes(keyword))
    case 'nut-free':
      return !nutBreakers.some(keyword => recipeText.includes(keyword))
    case 'dairy-free':
      if (tags.includes('dairy-free')) return true
      return !dairyBreakers.some(keyword => recipeText.includes(keyword))
    default:
      return true
  }
}

export function getRecipeDietaryProfile(recipe: Recipe): RecipeDietaryProfile {
  const recipeText = getRecipeText(recipe)
  const preferences: DietaryPreference[] = ['vegetarian', 'halal', 'nut-free', 'dairy-free']
  const compatibleWith = preferences.filter(preference => supportsPreference(recipeText, recipe, preference))
  const warnings = preferences
    .filter(preference => !compatibleWith.includes(preference))
    .map(preference => preferenceWarnings[preference])

  return {
    compatibleWith,
    warnings,
  }
}

export function getPreferenceConflicts(recipe: Recipe, preferences?: HouseholdPreferences | null): DietaryPreference[] {
  if (!preferences?.dietaryPreferences?.length) return []

  const profile = getRecipeDietaryProfile(recipe)
  return preferences.dietaryPreferences.filter(preference => !profile.compatibleWith.includes(preference))
}

export function isRecipeCompatible(recipe: Recipe, preferences?: HouseholdPreferences | null): boolean {
  return getPreferenceConflicts(recipe, preferences).length === 0
}

export function normalizeIngredientName(value: string | undefined | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function ingredientMatchKey(name: string | undefined | null, unit: string | undefined | null = ''): string {
  return `${normalizeIngredientName(name)}::${(unit ?? '').trim().toLowerCase()}`
}

export function getPantryCoverage(pantryItems: PantryItem[], ingredientName: string, unit: string, quantity: number) {
  const targetKey = ingredientMatchKey(ingredientName, unit)

  const matchedQuantity = pantryItems
    .filter(item => ingredientMatchKey(item.name, item.unit) === targetKey)
    .reduce((total, item) => total + item.quantity, 0)

  return {
    matchedQuantity,
    hasEnough: matchedQuantity >= quantity,
    missingQuantity: Math.max(quantity - matchedQuantity, 0),
  }
}

export function getRecipeHealthFit(nutrition: NutritionTotals, healthTargets: HealthTargets) {
  const calorieShare = getGoalShare(nutrition.calories, healthTargets.calories)
  const proteinShare = getGoalShare(nutrition.protein, healthTargets.protein)
  const carbShare = getGoalShare(nutrition.carbs, healthTargets.carbs)
  const fatShare = getGoalShare(nutrition.fat, healthTargets.fat)

  const highlights: string[] = []
  let verdict: 'good-fit' | 'mixed' | 'not-ideal' = 'mixed'
  let headline = 'Balanced fit'
  let summary = 'This recipe can fit your targets, but it depends on how you use the rest of your day.'

  if (nutrition.protein >= Math.max(25, healthTargets.protein * 0.2)) {
    highlights.push('Strong protein contribution')
  } else if (nutrition.protein < Math.max(18, healthTargets.protein * 0.15)) {
    highlights.push('Protein is light for your goal')
  }

  if (nutrition.calories <= healthTargets.calories * 0.35) {
    highlights.push('Calories stay in a manageable range')
  } else if (nutrition.calories > healthTargets.calories * 0.45) {
    highlights.push('Calories take a large share of the day')
  }

  if (nutrition.fat > healthTargets.fat * 0.45) {
    highlights.push('Fat is relatively high')
  }

  if (nutrition.carbs > healthTargets.carbs * 0.4) {
    highlights.push('Carbs are a bigger share of your daily target')
  }

  if (
    nutrition.calories <= healthTargets.calories * 0.35
    && nutrition.protein >= Math.max(25, healthTargets.protein * 0.2)
    && nutrition.fat <= healthTargets.fat * 0.35
  ) {
    verdict = 'good-fit'
    headline = 'Strong daily fit'
    summary = 'This recipe lines up well with your daily calorie and protein targets for a main meal.'
  } else if (
    (nutrition.calories > healthTargets.calories * 0.5 && nutrition.protein < Math.max(18, healthTargets.protein * 0.15))
    || nutrition.fat > healthTargets.fat * 0.5
  ) {
    verdict = 'not-ideal'
    headline = 'Heavier than ideal'
    summary = 'This recipe can still work, but it uses a large chunk of your targets without giving enough protein back.'
  }

  return {
    verdict,
    headline,
    summary,
    highlights: highlights.slice(0, 4),
    targetShare: {
      calories: calorieShare,
      protein: proteinShare,
      carbs: carbShare,
      fat: fatShare,
    },
  }
}

function getGoalShare(value: number, target: number) {
  if (!target) return 0
  return Math.round((value / target) * 100)
}
