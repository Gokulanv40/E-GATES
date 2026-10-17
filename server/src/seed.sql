-- Seed Data for Layout Association Management System

-- 1. Create Sample Association
INSERT INTO associations (id, name, city, address, is_active)
VALUES (
  1,
  'Green Valley Residents Welfare Association',
  'Chennai',
  '123 Anna Nagar East, Chennai, Tamil Nadu 600102',
  true
)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name,
    city = EXCLUDED.city,
    address = EXCLUDED.address,
    is_active = EXCLUDED.is_active;

-- Reset sequence for associations
SELECT setval('associations_id_seq', (SELECT GREATEST(MAX(id), 1) FROM associations));

-- 2. Default Super Admin (password: SuperAdmin@123)
INSERT INTO users (name, email, phone, password_hash, role, status, member_code)
VALUES (
  'Super Admin',
  'superadmin@association.com',
  '9999999999',
  '$2b$10$Bc71bY2Jpz1s86bhcU3Dz.FkXwZuICoifklnKlYjl9zyEUu7iUudq',
  'super_admin',
  'approved',
  '000001'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status;

-- 3. Default Layout Admin for Sample Association (password: SuperAdmin@123)
INSERT INTO users (name, email, phone, password_hash, role, association_id, status, member_code, door_no, street, layout_name, taluk, district, state)
VALUES (
  'Layout Admin',
  'admin@greenvalley.com',
  '9888888888',
  '$2b$10$Bc71bY2Jpz1s86bhcU3Dz.FkXwZuICoifklnKlYjl9zyEUu7iUudq',
  'admin',
  1,
  'approved',
  '100001',
  '1A',
  'Main Boulevard',
  'Green Valley Layout',
  'Ambattur',
  'Chennai',
  'Tamil Nadu'
)
ON CONFLICT (email) DO NOTHING;

-- 4. Sample SOS Contacts for Association #1 (2 Members + 1 Police)
INSERT INTO sos_contacts (association_id, contact_type, name, phone, designation)
VALUES 
  (1, 'member', 'K. Rajesh (President)', '9840012345', 'Association President'),
  (1, 'member', 'M. Senthil (Secretary)', '9840067890', 'Security Coordinator'),
  (1, 'police', 'K4 Anna Nagar Police Station', '04426210000', 'Local Police Control')
ON CONFLICT DO NOTHING;
