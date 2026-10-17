const crypto = require('crypto');
const defaultPool = require('../config/db');

/**
 * Generates a unique 6-digit alphanumeric or numeric member code.
 * Ensures uniqueness against the users table.
 * @param {Object} [dbClient] - Optional pg client or pool for transaction support
 * @returns {Promise<string>} 6-digit member code string
 */
async function generateMemberCode(dbClient = defaultPool) {
  const maxRetries = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Generate a secure 6-digit integer between 100000 and 999999
    const randomCode = crypto.randomInt(100000, 1000000).toString();

    const { rows } = await dbClient.query(
      'SELECT id FROM users WHERE member_code = $1 LIMIT 1',
      [randomCode]
    );

    if (rows.length === 0) {
      return randomCode;
    }
  }

  throw new Error('Failed to generate a unique 6-digit member code after 10 attempts.');
}

module.exports = {
  generateMemberCode,
};
