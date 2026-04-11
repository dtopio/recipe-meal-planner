import { lookup } from 'node:dns/promises'
import {
  normalizeTags,
  parseDurationToMinutes,
  parseIngredientLine,
  parseServings,
  uniqueValues,
} from './utils.js'

const FETCH_TIMEOUT_MS = 15_000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5 MB

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function collectJsonLdBlocks(html) {
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const blocks = []

  for (const match of matches) {
    const text = decodeHtmlEntities(match[1].trim())
    if (!text) continue

    try {
      blocks.push(JSON.parse(text))
    } catch {
      // Skip invalid blocks.
    }
  }

  return blocks
}

function findRecipeNode(value) {
  if (!value) return null

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findRecipeNode(item)
      if (match) return match
    }
    return null
  }

  if (typeof value !== 'object') {
    return null
  }

  const type = value['@type']
  if (
    type === 'Recipe' ||
    (Array.isArray(type) && type.includes('Recipe'))
  ) {
    return value
  }

  if (value['@graph']) {
    const match = findRecipeNode(value['@graph'])
    if (match) return match
  }

  for (const property of Object.values(value)) {
    const match = findRecipeNode(property)
    if (match) return match
  }

  return null
}

function extractImageUrl(image) {
  if (!image) return undefined

  if (typeof image === 'string') {
    return image
  }

  if (Array.isArray(image)) {
    const first = image.find(Boolean)
    return extractImageUrl(first)
  }

  if (typeof image === 'object') {
    return image.url || image.contentUrl || undefined
  }

  return undefined
}

function extractInstructionSteps(instructions) {
  if (!instructions) return []

  if (Array.isArray(instructions)) {
    return instructions.flatMap(step => {
      if (typeof step === 'string') return step.trim()
      if (step?.text) return String(step.text).trim()
      if (Array.isArray(step?.itemListElement)) return extractInstructionSteps(step.itemListElement)
      return []
    }).filter(Boolean)
  }

  if (typeof instructions === 'string') {
    return instructions
      .split(/\r?\n|\.\s+(?=[A-Z])/)
      .map(step => step.trim())
      .filter(Boolean)
  }

  if (typeof instructions === 'object' && instructions.text) {
    return [String(instructions.text).trim()]
  }

  return []
}

function extractTags(recipeNode) {
  return normalizeTags([
    ...(Array.isArray(recipeNode.recipeCategory) ? recipeNode.recipeCategory : [recipeNode.recipeCategory]),
    ...(Array.isArray(recipeNode.recipeCuisine) ? recipeNode.recipeCuisine : [recipeNode.recipeCuisine]),
    ...(Array.isArray(recipeNode.keywords) ? recipeNode.keywords : [recipeNode.keywords]),
  ]).slice(0, 8)
}

function isPrivateIp(ip) {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.|0\.0\.0\.0|::1|fc|fd|fe80)/.test(ip)
}

function validateImportUrl(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Only http and https URLs are supported')
  }

  const hostname = parsed.hostname.toLowerCase()
  const blocked = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    'metadata.google.internal',
  ]

  if (blocked.includes(hostname)) {
    throw new Error('That URL is not allowed')
  }

  // Block private/link-local IP ranges in hostname
  if (isPrivateIp(hostname)) {
    throw new Error('That URL is not allowed')
  }

  return parsed
}

async function resolveAndValidate(url) {
  const parsed = validateImportUrl(url)

  // DNS rebinding protection: resolve the hostname and check the IP
  try {
    const { address } = await lookup(parsed.hostname)
    if (isPrivateIp(address)) {
      throw new Error('That URL is not allowed')
    }
  } catch (error) {
    if (error.message === 'That URL is not allowed') throw error
    throw new Error('Could not resolve that hostname')
  }

  return parsed.href
}

export async function importRecipeFromUrl(url) {
  const safeUrl = await resolveAndValidate(url)
  const response = await fetch(safeUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; MealSyncBot/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch recipe page (${response.status})`)
  }

  // Reject responses that declare a size over our limit
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('Recipe page is too large to import')
  }

  // Stream the body with a byte limit to protect against missing/lying content-length
  const reader = response.body.getReader()
  const chunks = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.length
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel()
      throw new Error('Recipe page is too large to import')
    }
    chunks.push(value)
  }

  const html = new TextDecoder().decode(Buffer.concat(chunks))
  const recipeNode = findRecipeNode(collectJsonLdBlocks(html))

  if (!recipeNode) {
    throw new Error('No structured recipe data was found at that URL')
  }

  const ingredients = (recipeNode.recipeIngredient || [])
    .map(parseIngredientLine)
    .filter(ingredient => ingredient.name)

  const instructions = extractInstructionSteps(recipeNode.recipeInstructions)

  if (!recipeNode.name || ingredients.length === 0 || instructions.length === 0) {
    throw new Error('The page did not contain enough recipe information to import')
  }

  const prepTime = parseDurationToMinutes(recipeNode.prepTime)
  const cookTime = parseDurationToMinutes(recipeNode.cookTime)
  const totalTime = parseDurationToMinutes(recipeNode.totalTime)

  return {
    title: String(recipeNode.name).trim(),
    description: typeof recipeNode.description === 'string' ? recipeNode.description.trim() : undefined,
    imageUrl: extractImageUrl(recipeNode.image),
    prepTime: prepTime || Math.max(0, totalTime - cookTime),
    cookTime: cookTime || totalTime || 20,
    servings: parseServings(recipeNode.recipeYield),
    tags: uniqueValues(extractTags(recipeNode)).slice(0, 8),
    ingredients,
    instructions,
    sourceUrl: url,
  }
}
