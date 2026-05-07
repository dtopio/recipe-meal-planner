import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import { z } from 'zod'
import { connectDb, closeDb } from './db/index.js'
import { config } from './config.js'
import { apiLimiter } from './rate-limit.js'
import { logger, requestLogger } from './logger.js'
import { nowIso } from './utils.js'
import { sendOk, sendError } from './helpers.js'

import authRoutes from './routes/auth.js'
import householdRoutes from './routes/household.js'
import recipeRoutes from './routes/recipes.js'
import plannerRoutes from './routes/planner.js'
import shoppingRoutes from './routes/shopping.js'
import pantryRoutes from './routes/pantry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDirectory = path.resolve(__dirname, '..')
const distDirectory = path.join(rootDirectory, 'dist')

const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production'

const app = express()

// ── Trust proxy (required behind reverse proxies: Render, Railway, nginx, etc.)
if (isProduction) {
  app.set('trust proxy', 1)
}

// ── Security headers ───────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: isProduction
    ? {
        directives: {
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/client'],
          frameSrc: ["'self'", 'https://accounts.google.com/gsi/'],
          connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
        },
      }
    : false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: isProduction ? { maxAge: 63072000, includeSubDomains: true } : false,
}))

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}))

// ── Response compression ───────────────────────────────────────
app.use(compression())

app.use(express.json({ limit: '1mb' }))

// ── HTTPS redirect in production ───────────────────────────────
if (isProduction) {
  app.use((req, res, next) => {
    const host = req.get('host') || ''
    const isLocalPreview = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
    const forwardedProto = req.get('x-forwarded-proto')

    if (!isLocalPreview && forwardedProto && forwardedProto !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`)
    }
    next()
  })
}

// ── Request logging ────────────────────────────────────────────
app.use(requestLogger)

// ── Health check ────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  sendOk(res, {
    status: 'ok',
    timestamp: nowIso(),
  })
})

// ── Rate limiting ───────────────────────────────────────────────

app.use('/api', apiLimiter)

// ── Route modules ───────────────────────────────────────────────

app.use('/api/auth', authRoutes)
app.use('/api/household', householdRoutes)
app.use('/api/recipes', recipeRoutes)
app.use('/api/planner', plannerRoutes)
app.use('/api/shopping', shoppingRoutes)
app.use('/api/pantry', pantryRoutes)

// ── Error handler ───────────────────────────────────────────────

app.use((error, req, res, _next) => {
  if (error instanceof z.ZodError) {
    return sendError(res, 400, error.issues[0]?.message || 'Invalid request', 'VALIDATION_ERROR')
  }

  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: error.message,
    stack: isProduction ? undefined : error.stack,
  })
  sendError(res, 500, 'Unexpected server error', 'INTERNAL_SERVER_ERROR')
})

// ── Start ───────────────────────────────────────────────────────

await connectDb(config.databaseUrl)

if (isProduction) {
  // Static assets with long-term cache (Vite hashes filenames)
  app.use('/assets', express.static(path.join(distDirectory, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }))

  app.use(express.static(distDirectory, {
    maxAge: '1h',
  }))

  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distDirectory, 'index.html'))
  })
} else {
  const { createServer } = await import('vite')
  const vite = await createServer({
    root: rootDirectory,
    appType: 'custom',
    server: {
      middlewareMode: true,
    },
  })

  app.use(vite.middlewares)
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next()
    }

    try {
      const templatePath = path.join(rootDirectory, 'index.html')
      const template = await readFile(templatePath, 'utf8')
      const html = await vite.transformIndexHtml(req.originalUrl, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (error) {
      vite.ssrFixStacktrace(error)
      next(error)
    }
  })
}

const port = Number(process.env.PORT || 3000)
const server = app.listen(port, () => {
  logger.info(`Server listening on http://localhost:${port}`, { mode: isProduction ? 'production' : 'development' })
})

// ── Graceful shutdown ──────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`)
  server.close(async () => {
    await closeDb()
    logger.info('Server closed')
    process.exit(0)
  })

  setTimeout(() => {
    logger.error('Forcing shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
