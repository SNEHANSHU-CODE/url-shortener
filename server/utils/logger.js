/**
 * Simple Logger Utility
 * Provides structured logging with levels
 */

const config = require('../config');

const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const logLevelWeight = {
  ERROR: 4,
  WARN: 3,
  INFO: 2,
  DEBUG: 1,
};

class Logger {
  constructor() {
    this.currentLevel = LogLevel.INFO;
    
    // Set to DEBUG in development, INFO in production
    if (config.nodeEnv === 'development') {
      this.currentLevel = LogLevel.DEBUG;
    }
  }

  shouldLog(level) {
    return logLevelWeight[level] >= logLevelWeight[this.currentLevel];
  }

  format(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (data) {
      return `${prefix} ${message}`, data;
    }
    return `${prefix} ${message}`;
  }

  error(message, data) {
    if (this.shouldLog(LogLevel.ERROR)) {
      if (data instanceof Error) {
        console.error(this.format(LogLevel.ERROR, message), data.stack);
      } else {
        console.error(this.format(LogLevel.ERROR, message), data);
      }
    }
  }

  warn(message, data) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.format(LogLevel.WARN, message), data);
    }
  }

  info(message, data) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.format(LogLevel.INFO, message), data);
    }
  }

  debug(message, data) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.format(LogLevel.DEBUG, message), data);
    }
  }
}

module.exports = new Logger();
