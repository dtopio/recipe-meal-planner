const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production'

function formatMessage(level, message, meta = {}) {
  if (isProduction) {
    return JSON.stringify({
      level,
      msg: message,
      time: new Date().toISOString(),
      ...meta,
    })
  }

  const prefix = {
    info: '\x1b[36mINFO\x1b[0m',
    warn: '\x1b[33mWARN\x1b[0m',
    error: '\x1b[31mERROR\x1b[0m',
  }[level] || level.toUpperCase()

  const metaStr = Object.keys(meta).length > 0
    ? ` ${JSON.stringify(meta)}`
    : ''

  return `${prefix}  ${message}${metaStr}`
}

export const logger = {
  info(message, meta) {
    console.log(formatMessage('info', message, meta))
  },

  warn(message, meta) {
    console.warn(formatMessage('warn', message, meta))
  },

  error(message, meta) {
    console.error(formatMessage('error', message, meta))
  },
}

// Express request logging middleware
let requestCounter = 0

export function requestLogger(req, res, next) {
  const requestId = `req_${Date.now().toString(36)}_${(++requestCounter).toString(36)}`
  const start = Date.now()

  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const duration = Date.now() - start
    const meta = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    }

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.path} ${res.statusCode}`, meta)
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.path} ${res.statusCode}`, meta)
    } else if (req.path !== '/api/health') {
      logger.info(`${req.method} ${req.path} ${res.statusCode}`, meta)
    }
  })

  next()
}
