import { z } from 'zod'
import { config } from './config.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const FETCH_TIMEOUT_MS = 30_000

const summarySchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  bestFor: z.array(z.string()).max(3),
  watchouts: z.array(z.string()).max(3),
})

const recipeAskSchema = z.object({
  headline: z.string().min(1),
  verdict: z.enum(['good-fit', 'mixed', 'not-ideal']),
  answer: z.string().min(1),
  bestTimes: z.array(z.string()).max(3),
  watchouts: z.array(z.string()).max(3),
})

const shoppingSummarySchema = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  alerts: z.array(z.string()).max(3),
  focus: z.array(z.string()).max(3),
})

function extractJson(value) {
  const trimmed = String(value || '').trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error('The AI summary response was not valid JSON')
    }

    return JSON.parse(match[0])
  }
}

async function requestOpenRouterJson(messages, schema) {
  if (!config.openrouterApiKey) {
    throw new Error('OpenRouter AI support is not configured')
  }

  const modelsToTry = Array.from(new Set([
    config.openrouterModel,
    'openrouter/free',
  ]))

  let lastError = new Error('OpenRouter request failed')

  for (const model of modelsToTry) {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.appUrl,
        'X-Title': 'MealSync',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      lastError = new Error(`OpenRouter request failed (${response.status})`)
      continue
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    const parsed = schema.parse(extractJson(content))

    return {
      ...parsed,
      model: data?.model || model,
      generatedAt: new Date().toISOString(),
    }
  }

  throw lastError
}

export async function generateRecipeSummary(recipe, nutrition) {
  return requestOpenRouterJson([
    {
      role: 'system',
      content: 'You are a practical meal-planning assistant. Return JSON only.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Summarize this recipe for a meal-planning app in concise plain language.',
        requiredShape: {
          headline: 'short title',
          summary: '2 sentence summary',
          bestFor: ['up to 3 short use cases'],
          watchouts: ['up to 3 short cautions'],
        },
        recipe: {
          title: recipe.title,
          description: recipe.description,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          tags: recipe.tags,
          ingredients: recipe.ingredients.map(ingredient => ({
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            name: ingredient.name,
          })),
          instructions: recipe.instructions,
        },
        nutrition: {
          perServing: nutrition.perServing,
          total: nutrition.total,
        },
      }),
    },
  ], summarySchema)
}

export async function generateShoppingSummary(input) {
  return requestOpenRouterJson([
    {
      role: 'system',
      content: 'You are a practical grocery-planning assistant. Return JSON only.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Summarize this shopping list for a meal-planning app. Be brief, practical, and action-oriented.',
        requiredShape: {
          headline: 'short title',
          summary: '2 sentence summary',
          alerts: ['up to 3 short alerts'],
          focus: ['up to 3 category or store-focus suggestions'],
        },
        shopping: input,
      }),
    },
  ], shoppingSummarySchema)
}

export async function generateRecipeAskResponse(recipe, question, nutrition, healthTargets = null) {
  return requestOpenRouterJson([
    {
      role: 'system',
      content: 'You are a practical recipe assistant for a meal-planning app. Return JSON only.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Answer whether this recipe is a good fit for the user question, especially for a time of day or meal context. Be direct and practical.',
        requiredShape: {
          headline: 'short title',
          verdict: 'good-fit | mixed | not-ideal',
          answer: '2 sentence answer',
          bestTimes: ['up to 3 short best-fit meal moments'],
          watchouts: ['up to 3 short caveats'],
        },
        question,
        recipe: {
          title: recipe.title,
          description: recipe.description,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          tags: recipe.tags,
          ingredients: recipe.ingredients.map(ingredient => ({
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            name: ingredient.name,
          })),
          instructions: recipe.instructions,
        },
        nutrition: nutrition
          ? {
              perServing: nutrition.perServing,
              total: nutrition.total,
            }
          : null,
        healthTargets,
      }),
    },
  ], recipeAskSchema)
}
