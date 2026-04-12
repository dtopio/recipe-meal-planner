import { config } from './config.js'

const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'
const USDA_FOOD_URL = 'https://api.nal.usda.gov/fdc/v1/food'
const FETCH_TIMEOUT_MS = 15_000

const nutrientKeys = {
  calories: new Set(['208', '1008']),
  protein: new Set(['203']),
  carbs: new Set(['205', '1005']),
  fat: new Set(['204', '1004']),
}

const nutrientNames = {
  calories: ['energy'],
  protein: ['protein'],
  carbs: ['carbohydrate'],
  fat: ['total lipid', 'fat'],
}

const unitAliases = {
  gram: 'g',
  grams: 'g',
  g: 'g',
  kilogram: 'kg',
  kilograms: 'kg',
  kg: 'kg',
  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lb: 'lb',
  lbs: 'lb',
  milliliter: 'ml',
  milliliters: 'ml',
  ml: 'ml',
  liter: 'l',
  liters: 'l',
  l: 'l',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  can: 'can',
  cans: 'can',
  clove: 'clove',
  cloves: 'clove',
  head: 'head',
  heads: 'head',
  slice: 'slice',
  slices: 'slice',
  bottle: 'bottle',
  bottles: 'bottle',
  fillet: 'fillet',
  fillets: 'fillet',
  bunch: 'bunch',
  bunches: 'bunch',
  pack: 'pack',
  packs: 'pack',
}

const directGramUnits = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
}

function round(value) {
  return Number(value.toFixed(1))
}

function normalizeUnit(unit = '') {
  return unitAliases[String(unit).trim().toLowerCase()] || String(unit).trim().toLowerCase()
}

function normalizeQuery(name) {
  return String(name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,.*$/g, ' ')
    .replace(/\b(fresh|freshly|grated|shaved|minced|diced|chopped|boneless|skinless|large|small|medium|raw|cooked|extra virgin|ground)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function defaultCountWeight(unit, ingredientName) {
  const value = ingredientName.toLowerCase()

  if (unit === 'clove') return 5
  if (unit === 'can') return 400
  if (unit === 'head') return /lettuce|cabbage/.test(value) ? 600 : 300
  if (unit === 'slice') return 28
  if (unit === 'bottle') return 500
  if (unit === 'fillet') return /salmon|fish/.test(value) ? 170 : 120
  if (unit === 'bunch') return 75
  if (unit === 'pack') return 400
  if (!unit) {
    if (/egg/.test(value)) return 50
    if (/avocado/.test(value)) return 150
    if (/lime|lemon/.test(value)) return 67
    if (/tortilla/.test(value)) return 30
    if (/onion/.test(value)) return 110
    if (/garlic/.test(value)) return 5
    if (/salmon fillet/.test(value)) return 170
    if (/chicken breast/.test(value)) return 174
  }

  return 100
}

function extractNutrients(food) {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }

  for (const item of food.foodNutrients || []) {
    const nutrient = item.nutrient || item
    const number = String(nutrient.number || item.nutrientNumber || '')
    const name = String(nutrient.name || item.nutrientName || '').toLowerCase()
    const unit = String(nutrient.unitName || item.unitName || '').toLowerCase()
    const amount = Number(item.amount ?? item.value ?? 0)

    if (!Number.isFinite(amount) || amount <= 0) {
      continue
    }

    if (
      nutrientKeys.calories.has(number) ||
      (nutrientNames.calories.some(token => name.includes(token)) && unit === 'kcal')
    ) {
      totals.calories = amount
      continue
    }

    if (nutrientKeys.protein.has(number) || nutrientNames.protein.some(token => name.includes(token))) {
      totals.protein = amount
      continue
    }

    if (nutrientKeys.carbs.has(number) || nutrientNames.carbs.some(token => name.includes(token))) {
      totals.carbs = amount
      continue
    }

    if (nutrientKeys.fat.has(number) || nutrientNames.fat.some(token => name.includes(token))) {
      totals.fat = amount
    }
  }

  return totals
}

function portionTerms(portion) {
  return [
    portion.measureUnit?.name,
    portion.modifier,
    portion.portionDescription,
    portion.householdServingFullText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function findPortionWeight(food, unit) {
  const normalizedUnit = normalizeUnit(unit)
  if (!normalizedUnit) {
    return null
  }

  for (const portion of food.foodPortions || []) {
    const terms = portionTerms(portion)
    const portionUnit = normalizeUnit(portion.measureUnit?.name || '')
    if (!terms.includes(normalizedUnit) && portionUnit !== normalizedUnit) {
      continue
    }

    const gramWeight = Number(portion.gramWeight || 0)
    const amount = Number(portion.amount || 1)
    if (gramWeight > 0 && amount > 0) {
      return gramWeight / amount
    }
  }

  return null
}

function estimateWeightInGrams(ingredient, food) {
  const normalizedUnit = normalizeUnit(ingredient.unit)
  const quantity = Number(ingredient.quantity || 0)

  if (normalizedUnit && directGramUnits[normalizedUnit]) {
    return {
      grams: quantity * directGramUnits[normalizedUnit],
      confidence: 'high',
    }
  }

  const portionWeight = findPortionWeight(food, normalizedUnit)
  if (portionWeight) {
    return {
      grams: quantity * portionWeight,
      confidence: 'high',
    }
  }

  if (!normalizedUnit && Array.isArray(food.foodPortions) && food.foodPortions.length > 0) {
    const defaultPortion = Number(food.foodPortions[0]?.gramWeight || 0)
    if (defaultPortion > 0) {
      return {
        grams: quantity * defaultPortion,
        confidence: 'medium',
      }
    }
  }

  return {
    grams: quantity * defaultCountWeight(normalizedUnit, ingredient.name),
    confidence: normalizedUnit ? 'medium' : 'low',
  }
}

function scoreCandidate(candidate, query) {
  const normalizedQuery = normalizeQuery(query).toLowerCase()
  const words = normalizedQuery.split(' ').filter(Boolean)
  const description = String(candidate.description || '').toLowerCase()
  const missingWordCount = words.filter(word => !description.includes(word)).length
  const dataTypeRank = {
    Foundation: 0,
    'SR Legacy': 1,
    'Survey (FNDDS)': 2,
    Branded: 3,
  }[candidate.dataType] ?? 4

  return dataTypeRank * 10 + missingWordCount
}

async function searchFoods(query, searchCache) {
  if (searchCache.has(query)) {
    return searchCache.get(query)
  }

  const response = await fetch(`${USDA_SEARCH_URL}?api_key=${encodeURIComponent(config.usdaApiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      pageSize: 5,
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`USDA lookup failed (${response.status})`)
  }

  const data = await response.json()
  const foods = Array.isArray(data.foods) ? data.foods : []
  searchCache.set(query, foods)
  return foods
}

async function getFoodDetails(fdcId, detailCache) {
  if (detailCache.has(fdcId)) {
    return detailCache.get(fdcId)
  }

  const response = await fetch(`${USDA_FOOD_URL}/${fdcId}?api_key=${encodeURIComponent(config.usdaApiKey)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    return null
  }

  const data = await response.json()
  detailCache.set(fdcId, data)
  return data
}

async function estimateIngredientNutrition(ingredient, searchCache, detailCache) {
  try {
    const query = normalizeQuery(ingredient.name)
    const foods = await searchFoods(query, searchCache)

    if (foods.length === 0) {
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        matchedFood: null,
        estimatedWeightGrams: 0,
        confidence: 'low',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }
    }

    const bestCandidate = [...foods].sort((left, right) => scoreCandidate(left, query) - scoreCandidate(right, query))[0]
    const food = await getFoodDetails(bestCandidate.fdcId, detailCache) || bestCandidate
    const weight = estimateWeightInGrams(ingredient, food)
    const nutrientsPer100g = extractNutrients(food)
    const factor = weight.grams > 0 ? weight.grams / 100 : 0

    return {
      ingredientId: ingredient.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      matchedFood: {
        fdcId: bestCandidate.fdcId,
        description: bestCandidate.description,
        dataType: bestCandidate.dataType,
      },
      estimatedWeightGrams: round(weight.grams),
      confidence: weight.confidence,
      calories: round(nutrientsPer100g.calories * factor),
      protein: round(nutrientsPer100g.protein * factor),
      carbs: round(nutrientsPer100g.carbs * factor),
      fat: round(nutrientsPer100g.fat * factor),
    }
  } catch {
    return {
      ingredientId: ingredient.id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      matchedFood: null,
      estimatedWeightGrams: 0,
      confidence: 'low',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  }
}

function sumNutrition(items) {
  return items.reduce((total, item) => ({
    calories: round(total.calories + item.calories),
    protein: round(total.protein + item.protein),
    carbs: round(total.carbs + item.carbs),
    fat: round(total.fat + item.fat),
  }), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })
}

export async function estimateRecipeNutrition(recipe) {
  if (!config.usdaApiKey) {
    throw new Error('USDA nutrition support is not configured')
  }

  const searchCache = new Map()
  const detailCache = new Map()
  const ingredients = await Promise.all(
    recipe.ingredients.map(ingredient => estimateIngredientNutrition(ingredient, searchCache, detailCache))
  )

  const total = sumNutrition(ingredients)
  const servings = Math.max(recipe.servings || 1, 1)

  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    servings,
    source: 'USDA FoodData Central',
    estimatedAt: new Date().toISOString(),
    total,
    perServing: {
      calories: round(total.calories / servings),
      protein: round(total.protein / servings),
      carbs: round(total.carbs / servings),
      fat: round(total.fat / servings),
    },
    ingredients,
  }
}
