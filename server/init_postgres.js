const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/association_db'
  });
  
  try {
    await client.connect();
    console.log('[PostgreSQL] Connected to association_db successfully!');

    const schemaSql = fs.readFileSync(path.join(__dirname, 'src/schema.sql'), 'utf8');
    await client.query(schemaSql);
    console.log('[PostgreSQL] Schema applied successfully!');

    const seedSql = fs.readFileSync(path.join(__dirname, 'src/seed.sql'), 'utf8');
    await client.query(seedSql);
    console.log('[PostgreSQL] Seed data applied successfully!');

    const res = await client.query('SELECT id, name, email, role, status FROM users');
    console.log('[PostgreSQL] Users:', res.rows);
  } catch (err) {
    console.error('[PostgreSQL Error]:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
