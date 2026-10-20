-- Run in order (respects FK dependencies)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Associations
CREATE TABLE IF NOT EXISTS associations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  address TEXT,
  logo VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  main_admin_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'admin', 'member')),
  is_main_admin BOOLEAN DEFAULT false,
  association_id INTEGER REFERENCES associations(id) ON DELETE SET NULL,
  member_code VARCHAR(6) UNIQUE,
  door_no VARCHAR(50),
  street VARCHAR(255),
  layout_name VARCHAR(255),
  taluk VARCHAR(255),
  district VARCHAR(255),
  state VARCHAR(255),
  eb_bill_proof VARCHAR(500),
  property_tax_receipt VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  language VARCHAR(5) DEFAULT 'en',
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_door_association ON users(door_no, association_id) WHERE door_no IS NOT NULL;

-- 3. Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SOS Contacts (exactly 3 per association: 2 members + 1 police)
CREATE TABLE IF NOT EXISTS sos_contacts (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  contact_type VARCHAR(20) NOT NULL CHECK (contact_type IN ('member', 'police', 'family', 'ambulance', 'security', 'fire', 'other')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  designation VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SOS Alerts
CREATE TABLE IF NOT EXISTS sos_alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  association_id INTEGER NOT NULL REFERENCES associations(id),
  emergency_type VARCHAR(50) DEFAULT 'Other' CHECK (emergency_type IN ('Medical', 'Fire', 'Theft/Intruder', 'Women Safety', 'Other')),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status VARCHAR(20) DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved', 'false_alarm')),
  is_test BOOLEAN DEFAULT false,
  acknowledged_by INTEGER REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. News Posts
CREATE TABLE IF NOT EXISTS news_posts (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  content TEXT,
  voice_message VARCHAR(500),
  attachment VARCHAR(500),
  image VARCHAR(500),
  category VARCHAR(50) DEFAULT 'General' CHECK (category IN ('Urgent', 'Meeting', 'Maintenance', 'General')),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Polls
CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Poll Vendors
CREATE TABLE IF NOT EXISTS poll_vendors (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  contact VARCHAR(255),
  quotation DECIMAL(12, 2),
  notes TEXT,
  document VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Votes
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  vendor_id INTEGER NOT NULL REFERENCES poll_vendors(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

-- 10. Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  attachment VARCHAR(500),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Maintenance Fees
CREATE TABLE IF NOT EXISTS maintenance_fees (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL,
  period VARCHAR(50) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(20) DEFAULT 'due' CHECK (status IN ('due', 'paid', 'overdue')),
  payment_reference VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Events
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  location VARCHAR(255),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Documents Library
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  association_id INTEGER NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50),
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type VARCHAR(50) DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  link VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INTEGER,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
