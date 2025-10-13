// backend/middleware/logger.js
const morgan = require('morgan');

// This is an async function because we are using dynamic import for chalk
async function createLogger() {
  const { default: chalk } = await import('chalk');

  // Custom token for morgan to log the request body
  morgan.token('body', (req) => {
    return JSON.stringify(req.body);
  });

  return morgan((tokens, req, res) => {
    const status = tokens.status(req, res);
    const statusChalk = status >= 500
      ? chalk.red(status)       // Server error
      : status >= 400
      ? chalk.yellow(status)    // Client error
      : status >= 300
      ? chalk.cyan(status)      // Redirection
      : chalk.green(status);    // Success

    return [
      chalk.blue(tokens.method(req, res)),
      chalk.white(tokens.url(req, res)),
      statusChalk,
      chalk.magenta(tokens['response-time'](req, res) + ' ms'),
      // chalk.gray('Body: ' + tokens.body(req, res)), // Uncomment to log request body
    ].join(' | ');
  });
}

module.exports = createLogger;
