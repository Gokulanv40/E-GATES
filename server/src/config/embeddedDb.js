const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let dbInstance = null;
const dbFilePath = path.resolve(__dirname, '../../data/association.sqlite');

async function getEmbeddedDb() {
  if (dbInstance) return dbInstance;

  // Ensure data folder exists
  const dataDir = path.dirname(dbFilePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();
  let db;

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    initSchemaAndSeed(db);
    saveDb(db);
  }

  dbInstance = db;
  return dbInstance;
}

function saveDb(db) {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFilePath, buffer);
  } catch (err) {
    console.error('[EmbeddedDB Save Error]:', err.message);
  }
}

function initSchemaAndSeed(db) {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS associations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT,
      address TEXT,
      logo TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'member')),
      association_id INTEGER REFERENCES associations(id) ON DELETE SET NULL,
      member_code TEXT UNIQUE,
      door_no TEXT,
      street TEXT,
      layout_name TEXT,
      taluk TEXT,
      district TEXT,
      state TEXT,
      eb_bill_proof TEXT,
      property_tax_receipt TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      rejection_reason TEXT,
      language TEXT DEFAULT 'en',
      reset_token TEXT,
      reset_token_expires TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sos_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      contact_type TEXT NOT NULL CHECK (contact_type IN ('member', 'police')),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      designation TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sos_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      association_id INTEGER NOT NULL REFERENCES associations(id),
      emergency_type TEXT DEFAULT 'Other' CHECK (emergency_type IN ('Medical', 'Fire', 'Theft/Intruder', 'Women Safety', 'Other')),
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved', 'false_alarm')),
      is_test INTEGER DEFAULT 0,
      acknowledged_by INTEGER REFERENCES users(id),
      acknowledged_at TEXT,
      resolved_at TEXT,
      response_time_seconds INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS news_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT,
      voice_message TEXT,
      attachment TEXT,
      image TEXT,
      category TEXT DEFAULT 'General' CHECK (category IN ('Urgent', 'Meeting', 'Maintenance', 'General')),
      is_pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_anonymous INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS poll_vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      company TEXT,
      contact TEXT,
      quotation REAL,
      notes TEXT,
      document TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      vendor_id INTEGER NOT NULL REFERENCES poll_vendors(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(poll_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      attachment TEXT,
      resolved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maintenance_fees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      period TEXT NOT NULL,
      due_date TEXT NOT NULL,
      paid_date TEXT,
      status TEXT DEFAULT 'due' CHECK (status IN ('due', 'paid', 'overdue')),
      payment_reference TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      event_date TEXT NOT NULL,
      end_date TEXT,
      location TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Seed Default Super Admin (password: SuperAdmin@123)
    INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role, status, member_code)
    VALUES (
      1,
      'Super Admin',
      'superadmin@association.com',
      '9999999999',
      '$2b$10$Bc71bY2Jpz1s86bhcU3Dz.FkXwZuICoifklnKlYjl9zyEUu7iUudq',
      'super_admin',
      'approved',
      '000001'
    );

    -- Seed Sample Association
    INSERT OR IGNORE INTO associations (id, name, city, address, is_active)
    VALUES (
      1,
      'Greenfield Layout Residents Welfare Association',
      'Coimbatore',
      '12, Avinashi Road, Civil Aerodrome Post, Coimbatore - 641014',
      1
    );

    -- Seed Sample Admin (password: Admin@123)
    INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role, association_id, status, member_code)
    VALUES (
      2,
      'Layout Admin',
      'admin@greenfield.com',
      '9876543210',
      '$2b$10$iBiP/KaQO9bavF0/BjYwkuWi1u2xf0K6FjYXk7KUI4Fl2NjbBt4Aq',
      'admin',
      1,
      'approved',
      '100001'
    );

    -- Seed Sample SOS Contacts
    INSERT OR IGNORE INTO sos_contacts (association_id, contact_type, name, phone, designation)
    VALUES
      (1, 'member', 'K. Ramachandran (President)', '9443322110', 'President'),
      (1, 'member', 'M. Senthilkumar (Secretary)', '9443322111', 'Secretary'),
      (1, 'police', 'Peelamedu Police Station (SHO)', '04222572100', 'Inspector of Police');
  `;

  db.run(schemaSql);
}

module.exports = {
  getEmbeddedDb,
  saveDb,
};
