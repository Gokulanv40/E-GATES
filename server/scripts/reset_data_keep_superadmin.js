const pool = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function cleanDataKeepSuperAdmin() {
  console.log('--- STARTING FRESH DATABASE RESET (KEEPING SUPER ADMIN ONLY) ---');

  const tablesToClear = [
    'event_captures',
    'tenants',
    'family_members',
    'votes',
    'poll_vendors',
    'polls',
    'news_posts',
    'complaints',
    'maintenance_fees',
    'events',
    'documents',
    'sos_alerts',
    'sos_contacts',
    'notifications',
    'audit_log',
    'refresh_tokens',
  ];

  for (const table of tablesToClear) {
    try {
      const res = await pool.query(`DELETE FROM ${table}`);
      console.log(`✓ Cleared table: ${table}`);
    } catch (err) {
      console.warn(`! Table ${table} notice:`, err.message);
    }
  }

  // Clear non-super-admin users
  try {
    const res = await pool.query("DELETE FROM users WHERE role != 'super_admin'");
    console.log(`✓ Cleared non-superadmin users`);
  } catch (err) {
    console.warn(`! Failed to clear users:`, err.message);
  }

  // Detach super admin from any old association
  try {
    await pool.query("UPDATE users SET association_id = NULL WHERE role = 'super_admin'");
    console.log(`✓ Reset Super Admin association link`);
  } catch (err) {
    console.warn(`! Failed to reset super admin association:`, err.message);
  }

  // Clear associations
  try {
    const res = await pool.query('DELETE FROM associations');
    console.log(`✓ Cleared associations`);
  } catch (err) {
    console.warn(`! Failed to clear associations:`, err.message);
  }

  // Clean uploaded media files, keeping .gitkeep in each directory
  const uploadsDir = path.resolve(__dirname, '../uploads');
  if (fs.existsSync(uploadsDir)) {
    const subdirs = ['audio', 'documents', 'events', 'logos', 'news', 'profiles', 'proofs', 'voting'];
    for (const sub of subdirs) {
      const fullSub = path.join(uploadsDir, sub);
      if (fs.existsSync(fullSub)) {
        const files = fs.readdirSync(fullSub);
        for (const file of files) {
          if (file !== '.gitkeep') {
            try {
              fs.unlinkSync(path.join(fullSub, file));
            } catch (e) {
              console.warn(`Could not delete file ${file}:`, e.message);
            }
          }
        }
      }
    }
    console.log(`✓ Cleaned uploaded media files from server/uploads`);
  }

  // Verification query
  const remainingUsers = await pool.query('SELECT id, name, email, role FROM users');
  console.log('\n--- VERIFICATION: REMAINING USERS ---');
  console.table(remainingUsers.rows);

  const assocCount = await pool.query('SELECT COUNT(*) FROM associations');
  console.log('Remaining Associations:', assocCount.rows[0]);

  console.log('\n✓ Clean database reset completed successfully!');
  process.exit(0);
}

cleanDataKeepSuperAdmin().catch((err) => {
  console.error('Fatal error during reset:', err);
  process.exit(1);
});
