
const Logger = require('pizza-logger');
const config = require('./config');

const logger = new Logger(config);

/**
 * Sanitize function to remove sensitive information from logs
 * @param {Object} data - Data to sanitize
 * @returns {Object} - Sanitized data
 */
const sanitizeLogData = (data) => {
  if (!data) return data;
  
  const sanitized = JSON.parse(JSON.stringify(data));
  if (typeof sanitized === 'object') {
    // Remove sensitive fields from JWT tokens
    if (sanitized.authorization) {
      sanitized.authorization = 'REDACTED';
    }
    
    if (sanitized.password) {
      sanitized.password = 'REDACTED';
    }
    
    if (sanitized.creditCard) {
      sanitized.creditCard = 'REDACTED';
    }

    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeLogData(sanitized[key]);
      }
    }
  }
  
  return sanitized;
};

/**
 * Custom database logger that sanitizes SQL queries
 * @param {string} sqlQuery - The SQL query to log
 */
const dbLogger = (sqlQuery) => {
  let sanitizedQuery = sqlQuery;
  
  if (
    sqlQuery.toUpperCase().includes('INSERT') || 
    sqlQuery.toUpperCase().includes('UPDATE')
  ) {
    sanitizedQuery = sqlQuery.replace(/'[^']*'/g, "'REDACTED'");
  }
  
  logger.dbLogger(sanitizedQuery);
};

/**
 * Custom factory logger that sanitizes order information
 * @param {Object} orderInfo - Order information to log
 */
const factoryLogger = (orderInfo) => {
  const sanitizedOrderInfo = sanitizeLogData(orderInfo);
  logger.factoryLogger(sanitizedOrderInfo);
};

/**
 * Custom error logger that sanitizes error information
 * @param {Error} error - Error to log
 */
const unhandledErrorLogger = (error) => {
  const sanitizedError = {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
  
  logger.unhandledErrorLogger(sanitizedError);
};

module.exports = {
  httpLogger: logger.httpLogger, // Express middleware for HTTP request logging
  dbLogger:                 // Custom database query logger
  factoryLogger,                 // Custom factory request logger
  unhandledErrorLogger,          // Custom unhandled exception logger
};