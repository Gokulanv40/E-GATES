const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Close polls that have passed their end_date
 */
async function closeExpiredPolls() {
  try {
    const result = await pool.query(
      `UPDATE polls
       SET status = 'closed'
       WHERE status = 'active' AND end_date <= NOW()
       RETURNING id, title, association_id`
    );

    if (result.rowCount > 0) {
      console.log(`[Cron: Polls] Successfully closed ${result.rowCount} expired poll(s).`);
    }
  } catch (err) {
    console.error('[Cron Error: Expired Polls]:', err.message);
  }
}

/**
 * Mark maintenance fees as overdue if due_date has passed and status is 'due'
 */
async function markOverdueMaintenanceFees() {
  try {
    const result = await pool.query(
      `UPDATE maintenance_fees
       SET status = 'overdue'
       WHERE status = 'due' AND due_date < CURRENT_DATE
       RETURNING id`
    );

    if (result.rowCount > 0) {
      console.log(`[Cron: Maintenance] Marked ${result.rowCount} maintenance fee record(s) as overdue.`);
    }
  } catch (err) {
    console.error('[Cron Error: Overdue Maintenance]:', err.message);
  }
}

/**
 * Initialize all recurring background cron jobs
 */
function initCronJobs() {
  console.log('[Cron] Initializing scheduled tasks...');

  // 1. Check for expired polls every minute (* * * * *)
  cron.schedule('* * * * *', async () => {
    await closeExpiredPolls();
  });

  // 2. Mark overdue maintenance fees daily at midnight (0 0 * * *)
  cron.schedule('0 0 * * *', async () => {
    await markOverdueMaintenanceFees();
  });

  // Run initial check once on server boot
  closeExpiredPolls().catch((err) => console.error('[Cron Init Error (Polls)]:', err.message));
  markOverdueMaintenanceFees().catch((err) => console.error('[Cron Init Error (Maintenance)]:', err.message));

  console.log('[Cron] Background jobs scheduled successfully.');
}

module.exports = {
  initCronJobs,
  closeExpiredPolls,
  markOverdueMaintenanceFees,
};
