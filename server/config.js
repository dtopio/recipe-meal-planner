import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDirectory = path.resolve(__dirname, '..')

loadEnvFile(path.join(rootDirectory, '.env.local'))
loadEnvFile(path.join(rootDirectory, '.env'))

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    const unquoted = rawValue.replace(/^['"]|['"]$/g, '')

    if (key && process.env[key] === undefined) {
      process.env[key] = unquoted
    }
  }
}

export const config = {
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  usdaApiKey: optionalSecret('USDA_API_KEY'),
  openrouterApiKey: optionalSecret('OPENROUTER_API_KEY'),
  openrouterModel: process.env.OPENROUTER_MODEL || 'qwen/qwen3.6-plus:free',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
}

function optionalSecret(name) {
  const value = process.env[name]?.trim() || ''
  if (!value) {
    return ''
  }

  const normalized = value.toLowerCase()
  if (
    normalized.startsWith('your-') ||
    normalized.startsWith('replace-') ||
    normalized.includes('placeholder')
  ) {
    return ''
  }

  return value
}
