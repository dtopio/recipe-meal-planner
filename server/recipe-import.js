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

export class ImportRecipeError extends Error {
  constructor(message, code = 'RECIPE_IMPORT_FAILED', statusCode = 422) {
    super(message)
    this.name = 'ImportRecipeError'
    this.code = code
    this.statusCode = statusCode
  }
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&#x27;/gi, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&deg;/g, '\u00b0')
    .replace(/&frac14;/g, '1/4')
    .replace(/&frac12;/g, '1/2')
    .replace(/&frac34;/g, '3/4')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value || ''))
    .replace(/\s+/g, ' ')
    .replace(/\s+([:;,.!?])/g, '$1')
    .trim()
}

function stripHtml(value) {
  return normalizeText(
    String(value || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getAttrValue(tag, attrName) {
  const match = String(tag || '').match(new RegExp(`${escapeRegex(attrName)}\\s*=\\s*["']([^"']+)["']`, 'i'))
  return match ? decodeHtmlEntities(match[1]) : ''
}

function classListContains(attrs, className) {
  const classValue = getAttrValue(attrs, 'class')
  return classValue.split(/\s+/).includes(className)
}

function extractElementsByTagAndClass(html, tagName, className) {
  const matches = []
  const pattern = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'gi')

  for (const match of html.matchAll(pattern)) {
    if (classListContains(match[1], className)) {
      matches.push(match[2])
    }
  }

  return matches
}

function extractFirstTextByClass(html, className) {
  const pattern = /<([a-zA-Z0-9:-]+)\b([^>]*)>/gi

  for (const match of html.matchAll(pattern)) {
    if (classListContains(match[2], className)) {
      const contentStart = match.index + match[0].length
      const closePattern = new RegExp(`</${escapeRegex(match[1])}>`, 'ig')
      closePattern.lastIndex = contentStart
      const closeMatch = closePattern.exec(html)
      const content = closeMatch ? html.slice(contentStart, closeMatch.index) : ''
      const text = stripHtml(content)
      if (text) return text
    }
  }

  return ''
}

function extractMetaContent(html, propertyName) {
  const pattern = /<meta\b([^>]*)>/gi

  for (const match of html.matchAll(pattern)) {
    const attrs = match[1]
    const property = getAttrValue(attrs, 'property') || getAttrValue(attrs, 'name')
    if (property === propertyName) {
      return getAttrValue(attrs, 'content')
    }
  }

  return ''
}

function extractPageFallbacks(html) {
  return {
    title: stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),
    description: extractMetaContent(html, 'description') || extractMetaContent(html, 'og:description'),
    imageUrl: extractMetaContent(html, 'og:image'),
  }
}

function parseNutritionNumber(value) {
  if (value === null || value === undefined) return undefined

  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return undefined

  const number = Number(match[0])
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

function normalizeNutritionValues(values = {}) {
  const nutrition = {
    calories: parseNutritionNumber(values.calories),
    protein: parseNutritionNumber(values.protein),
    carbs: parseNutritionNumber(values.carbs),
    fat: parseNutritionNumber(values.fat),
  }

  return Object.values(nutrition).some(value => Number.isFinite(value) && value > 0)
    ? nutrition
    : undefined
}

function extractJsonLdNutrition(recipeNode) {
  const nutrition = recipeNode.nutrition
  if (!nutrition || typeof nutrition !== 'object') return undefined

  return normalizeNutritionValues({
    calories: nutrition.calories || nutrition.Calories || nutrition.energy || nutrition.energyContent,
    protein: nutrition.proteinContent || nutrition.protein || nutrition.Protein,
    carbs: nutrition.carbohydrateContent || nutrition.carbohydrates || nutrition.carbs || nutrition.Carbohydrates,
    fat: nutrition.fatContent || nutrition.fat || nutrition.Fat,
  })
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

function extractAuthor(recipeNode) {
  const author = recipeNode.author
  if (!author) return undefined

  if (typeof author === 'string') {
    return author.trim()
  }

  if (Array.isArray(author)) {
    const first = author.find(a => a?.name || typeof a === 'string')
    if (!first) return undefined
    return typeof first === 'string' ? first.trim() : (first.name?.trim() || undefined)
  }

  if (typeof author === 'object') {
    return author.name?.trim() || undefined
  }

  return undefined
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

async function fetchText(url, accept = 'text/html,application/xhtml+xml') {
  let response
  try {
    response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept,
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch {
    throw new ImportRecipeError('Could not fetch the recipe page. The site may be blocking imports or timing out.', 'RECIPE_FETCH_FAILED', 502)
  }

  if (!response.ok) {
    const error = new ImportRecipeError(`Unable to fetch recipe page (${response.status})`, 'RECIPE_FETCH_FAILED', 502)
    error.status = response.status
    throw error
  }

  // Reject responses that declare a size over our limit
  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new ImportRecipeError('Recipe page is too large to import', 'RECIPE_PAGE_TOO_LARGE', 413)
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
      throw new ImportRecipeError('Recipe page is too large to import', 'RECIPE_PAGE_TOO_LARGE', 413)
    }
    chunks.push(value)
  }

  return new TextDecoder().decode(Buffer.concat(chunks))
}

function validateImportedRecipe(recipe) {
  if (!recipe?.title || recipe.ingredients.length === 0 || recipe.instructions.length === 0) {
    throw new ImportRecipeError('The page did not contain enough recipe information to import', 'RECIPE_INCOMPLETE', 422)
  }

  return recipe
}

function recipeFromJsonLdNode(recipeNode, sourceUrl) {
  const ingredients = (recipeNode.recipeIngredient || [])
    .map(parseIngredientLine)
    .filter(ingredient => ingredient.name)

  const instructions = extractInstructionSteps(recipeNode.recipeInstructions)

  const prepTime = parseDurationToMinutes(recipeNode.prepTime)
  const cookTime = parseDurationToMinutes(recipeNode.cookTime)
  const totalTime = parseDurationToMinutes(recipeNode.totalTime)

  return validateImportedRecipe({
    title: String(recipeNode.name || '').trim(),
    description: typeof recipeNode.description === 'string' ? recipeNode.description.trim() : undefined,
    imageUrl: extractImageUrl(recipeNode.image),
    prepTime: prepTime || Math.max(0, totalTime - cookTime),
    cookTime: cookTime || totalTime || 20,
    servings: parseServings(recipeNode.recipeYield),
    tags: uniqueValues(extractTags(recipeNode)).slice(0, 8),
    ingredients,
    instructions,
    nutrition: extractJsonLdNutrition(recipeNode),
    sourceUrl,
    credits: extractAuthor(recipeNode),
  })
}

function extractWprmImage(html, fallbackImageUrl) {
  const imageClassIndex = html.search(/class=["'][^"']*\bwprm-recipe-image\b/i)
  const searchArea = imageClassIndex >= 0 ? html.slice(imageClassIndex, imageClassIndex + 3000) : html
  const imageTag = searchArea.match(/<img\b[^>]*>/i)?.[0]
  const src = getAttrValue(imageTag, 'src')

  return src || fallbackImageUrl || undefined
}

function readWprmMinutes(html, key) {
  const hours = Number(extractFirstTextByClass(html, `wprm-recipe-${key}_time-hours`).match(/\d+(?:\.\d+)?/)?.[0] || 0)
  const minutes = Number(extractFirstTextByClass(html, `wprm-recipe-${key}_time-minutes`).match(/\d+(?:\.\d+)?/)?.[0] || 0)

  return (Number.isFinite(hours) ? hours * 60 : 0) + (Number.isFinite(minutes) ? minutes : 0)
}

function extractWprmNutritionValue(html, key) {
  const marker = `wprm-nutrition-label-text-nutrition-container-${key}`
  const index = html.indexOf(marker)
  if (index === -1) return undefined

  const nextIndex = html.indexOf('wprm-nutrition-label-text-nutrition-container-', index + marker.length)
  const section = html.slice(index, nextIndex === -1 ? index + 1200 : nextIndex)

  return parseNutritionNumber(extractFirstTextByClass(section, 'wprm-nutrition-label-text-nutrition-value'))
}

function extractWprmNutrition(html) {
  return normalizeNutritionValues({
    calories: extractWprmNutritionValue(html, 'calories'),
    protein: extractWprmNutritionValue(html, 'protein'),
    carbs: extractWprmNutritionValue(html, 'carbohydrates') ?? extractWprmNutritionValue(html, 'carbs'),
    fat: extractWprmNutritionValue(html, 'fat'),
  })
}

function parseWprmRecipe(html, sourceUrl, fallback = {}) {
  const title = extractFirstTextByClass(html, 'wprm-recipe-name') || fallback.title
  const description = extractFirstTextByClass(html, 'wprm-recipe-summary') || fallback.description
  const ingredientItems = extractElementsByTagAndClass(html, 'li', 'wprm-recipe-ingredient')
  const instructionItems = extractElementsByTagAndClass(html, 'li', 'wprm-recipe-instruction')

  if (!title || ingredientItems.length === 0 || instructionItems.length === 0) {
    return null
  }

  const ingredients = ingredientItems
    .map(item => {
      const amount = extractFirstTextByClass(item, 'wprm-recipe-ingredient-amount')
      const unit = extractFirstTextByClass(item, 'wprm-recipe-ingredient-unit')
      const name = extractFirstTextByClass(item, 'wprm-recipe-ingredient-name')
      const notes = extractFirstTextByClass(item, 'wprm-recipe-ingredient-notes')
      const line = [amount, unit, name, notes].filter(Boolean).join(' ') || stripHtml(item)
      return parseIngredientLine(line)
    })
    .filter(ingredient => ingredient.name)

  const instructions = instructionItems
    .map(item => extractFirstTextByClass(item, 'wprm-recipe-instruction-text') || stripHtml(item))
    .filter(Boolean)

  const prepTime = readWprmMinutes(html, 'prep')
  const cookTime = readWprmMinutes(html, 'cook')
  const totalTime = readWprmMinutes(html, 'total')

  return validateImportedRecipe({
    title,
    description,
    imageUrl: extractWprmImage(html, fallback.imageUrl),
    prepTime: prepTime || Math.max(0, totalTime - cookTime),
    cookTime: cookTime || totalTime || 20,
    servings: parseServings(extractFirstTextByClass(html, 'wprm-recipe-servings')),
    tags: uniqueValues(fallback.tags || []).slice(0, 8),
    ingredients,
    instructions,
    nutrition: extractWprmNutrition(html),
    sourceUrl,
    credits: fallback.credits,
  })
}

function getPostSlug(parsedUrl) {
  const parts = parsedUrl.pathname
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)

  const slug = parts.at(-1)
  return slug?.replace(/\.html?$/i, '') || ''
}

function wordpressFallbackFromPost(post) {
  const schemaGraph = post.yoast_head_json?.schema?.['@graph']
  const article = Array.isArray(schemaGraph)
    ? schemaGraph.find(node => node?.['@type'] === 'Article')
    : null

  return {
    title: stripHtml(post.title?.rendered),
    description: stripHtml(post.excerpt?.rendered) || post.yoast_head_json?.description,
    imageUrl: post.yoast_head_json?.og_image?.[0]?.url || article?.thumbnailUrl,
    tags: uniqueValues([
      ...(Array.isArray(article?.articleSection) ? article.articleSection : []),
      ...(Array.isArray(article?.keywords) ? article.keywords : []),
    ]),
    credits: post.yoast_head_json?.author || article?.author?.name,
  }
}

async function importFromWordPressRest(safeUrl, sourceUrl) {
  const parsedUrl = new URL(safeUrl)
  const slug = getPostSlug(parsedUrl)
  if (!slug) return null

  const fields = 'title,content,excerpt,yoast_head_json'
  const endpoints = [
    `${parsedUrl.origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=${fields}`,
    `https://public-api.wordpress.com/wp/v2/sites/${parsedUrl.hostname}/posts?slug=${encodeURIComponent(slug)}&_fields=${fields}`,
  ]

  if (parsedUrl.hostname.startsWith('www.')) {
    endpoints.push(
      `https://public-api.wordpress.com/wp/v2/sites/${parsedUrl.hostname.slice(4)}/posts?slug=${encodeURIComponent(slug)}&_fields=${fields}`
    )
  }

  for (const endpoint of endpoints) {
    try {
      const text = await fetchText(endpoint, 'application/json,text/html;q=0.9')
      const posts = JSON.parse(text)
      const post = Array.isArray(posts) ? posts[0] : null
      const html = post?.content?.rendered

      if (!html) continue

      const recipe = parseWprmRecipe(html, sourceUrl, wordpressFallbackFromPost(post))
      if (recipe) return recipe
    } catch (error) {
      if (error instanceof SyntaxError) continue
      if (error instanceof ImportRecipeError && error.code === 'RECIPE_FETCH_FAILED') continue
      throw error
    }
  }

  return null
}

export async function importRecipeFromUrl(url) {
  const safeUrl = await resolveAndValidate(url)
  let html = ''
  let fetchError = null

  try {
    html = await fetchText(safeUrl)
  } catch (error) {
    fetchError = error
  }

  if (html) {
    const recipeNode = findRecipeNode(collectJsonLdBlocks(html))
    if (recipeNode) {
      return recipeFromJsonLdNode(recipeNode, url)
    }

    const wprmRecipe = parseWprmRecipe(html, url, extractPageFallbacks(html))
    if (wprmRecipe) {
      return wprmRecipe
    }
  }

  const wordpressRecipe = await importFromWordPressRest(safeUrl, url)
  if (wordpressRecipe) {
    return wordpressRecipe
  }

  if (fetchError?.status === 403) {
    throw new ImportRecipeError('This recipe site blocked the import request. Try another recipe URL or add it manually.', 'RECIPE_SITE_BLOCKED', 422)
  }

  if (fetchError) {
    throw fetchError
  }

  throw new ImportRecipeError('No structured recipe data was found at that URL', 'RECIPE_NOT_FOUND', 422)
}
