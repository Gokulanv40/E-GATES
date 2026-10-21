const { Pool } = require('pg');
const config = require('./env');
const { getEmbeddedDb, saveDb } = require('./embeddedDb');

let useFallback = false;
let loggedFallback = false;

const pgPool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' && !config.databaseUrl.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pgPool.on('connect', () => {
  useFallback = false;
  loggedFallback = false;
});

pgPool.on('error', (err) => {
  if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
    useFallback = true;
    if (!loggedFallback) {
      console.log('[Database Notice]: PostgreSQL not reachable on port 5432. Active embedded database fallback enabled.');
      loggedFallback = true;
    }
  } else {
    console.error('[Database Pool Error]:', err.message);
  }
});

/**
 * Execute query against embedded SQLite database with PG compatibility
 */
async function executeEmbeddedQuery(sql, params = []) {
  const db = await getEmbeddedDb();

  // Convert PostgreSQL specific syntax to SQLite compatible syntax
  let sqliteSql = sql
    .replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*days?'/gi, "datetime('now', '-$1 days')")
    .replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*hours?'/gi, "datetime('now', '-$1 hours')")
    .replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*minutes?'/gi, "datetime('now', '-$1 minutes')")
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/COUNT\s*\(\s*DISTINCT\s+([^)]+)\)\s+FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi, 'COUNT(DISTINCT CASE WHEN $2 THEN $1 END)')
    .replace(/COUNT\s*\(\s*([^)]+)\)\s+FILTER\s*\(\s*WHERE\s+([^)]+)\)/gi, 'COUNT(CASE WHEN $2 THEN $1 END)')
    .replace(/STRING_AGG\s*\(\s*DISTINCT\s+([^,]+)\s*,\s*('[^']+')\s*\)/gi, 'GROUP_CONCAT(DISTINCT $1)')
    .replace(/STRING_AGG\s*\(\s*([^,]+)\s*,\s*('[^']+')\s*\)/gi, 'GROUP_CONCAT($1, $2)')
    .replace(/TIMESTAMPTZ/gi, 'TEXT')
    .replace(/ILIKE/gi, 'LIKE')
    .replace(/\bis_active\s*=\s*true\b/gi, 'is_active = 1')
    .replace(/\bis_active\s*=\s*false\b/gi, 'is_active = 0')
    .replace(/\bTRUE\b/gi, '1')
    .replace(/\bFALSE\b/gi, '0')
    .replace(/::(text|varchar|integer|int|bigint|date)/gi, '')
    .trim();

  // Replace $1, $2, etc with ?1, ?2 so SQLite reuses positional parameters
  sqliteSql = sqliteSql.replace(/\$(\d+)/g, '?$1');

  // Sanitize parameters for SQLite (convert Date to ISO string, boolean to integer)
  const sanitizedParams = (params || []).map((p) => {
    if (p instanceof Date) return p.toISOString();
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });

  const isSelect = /^\s*SELECT/i.test(sqliteSql);
  const isReturning = /RETURNING/i.test(sqliteSql);

  try {
    if (isSelect || isReturning) {
      const stmt = db.prepare(sqliteSql);
      if (sanitizedParams && sanitizedParams.length > 0) {
        stmt.bind(sanitizedParams);
      }
      const rows = [];
      while (stmt.step()) {
        const obj = stmt.getAsObject();
        // Normalize COUNT(*) to count for PG compatibility
        if (obj['COUNT(*)'] !== undefined && obj.count === undefined) {
          obj.count = obj['COUNT(*)'];
        }
        if (obj['count(*)'] !== undefined && obj.count === undefined) {
          obj.count = obj['count(*)'];
        }
        rows.push(obj);
      }
      stmt.free();

      // If it was an insert/update with returning, save to disk
      if (!isSelect) {
        saveDb(db);
      }

      return {
        rows,
        rowCount: rows.length,
      };
    } else {
      // Direct execution for INSERT, UPDATE, DELETE without returning
      if (sanitizedParams && sanitizedParams.length > 0) {
        const stmt = db.prepare(sqliteSql);
        stmt.bind(sanitizedParams);
        stmt.step();
        stmt.free();
      } else {
        db.run(sqliteSql);
      }

      saveDb(db);
      return {
        rows: [],
        rowCount: db.getRowsModified(),
      };
    }
  } catch (err) {
    console.error('[EmbeddedDB Query Error]:', err.message, 'SQL:', sqliteSql);
    throw err;
  }
}

/**
 * Dual-Mode Database Query Wrapper
 */
const db = {
  async query(text, params) {
    if (!useFallback) {
      try {
        return await pgPool.query(text, params);
      } catch (err) {
        // If PostgreSQL connection fails, seamlessly switch to embedded DB
        if (err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
          useFallback = true;
          if (!loggedFallback) {
            console.log('[Database Notice]: Switched to embedded database due to PostgreSQL unavailability.');
            loggedFallback = true;
          }
          return executeEmbeddedQuery(text, params);
        }
        throw err;
      }
    }

    // When in fallback, test PostgreSQL to see if it has become available
    try {
      const res = await pgPool.query(text, params);
      useFallback = false;
      loggedFallback = false;
      console.log('[Database Notice]: Reconnected to PostgreSQL database successfully.');
      return res;
    } catch (pgErr) {
      if (pgErr.code === 'ECONNREFUSED' || pgErr.message.includes('ECONNREFUSED') || pgErr.message.includes('connect')) {
        return executeEmbeddedQuery(text, params);
      }
      useFallback = false;
      throw pgErr;
    }
  },

  async connect() {
    if (useFallback) {
      return {
        query: (text, params) => executeEmbeddedQuery(text, params),
        release: () => {},
      };
    }

    try {
      return await pgPool.connect();
    } catch (err) {
      useFallback = true;
      return {
        query: (text, params) => executeEmbeddedQuery(text, params),
        release: () => {},
      };
    }
  },

  on(event, handler) {
    pgPool.on(event, handler);
  },

  async end() {
    try {
      await pgPool.end();
    } catch (err) {
      // ignore
    }
  },
};

module.exports = db;
