// Production logger utility for backend
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const enableLogs = process.env.ENABLE_LOGS === 'true' || !isProduction

const logger = {
  log: (...args) => {
    if (enableLogs) {
      console.log(...args)
    }
  },
  error: (...args) => {
    if (enableLogs) {
      console.error(...args)
    }
  },
  warn: (...args) => {
    if (enableLogs) {
      console.warn(...args)
    }
  },
  info: (...args) => {
    if (enableLogs) {
      console.info(...args)
    }
  },
  debug: (...args) => {
    if (enableLogs) {
      console.debug(...args)
    }
  },
  // Special method for critical errors that should always be logged
  critical: (...args) => {
    console.error('[CRITICAL]', ...args)
  }
}

export default logger 