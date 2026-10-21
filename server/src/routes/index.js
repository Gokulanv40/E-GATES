const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

/**
 * Safely load a route module supporting both `name.routes.js` and `name.js`,
 * with a fallback stub if the specific module is still being generated.
 */
function safeLoadRoute(candidates, moduleName) {
  const fileList = Array.isArray(candidates) ? candidates : [candidates];
  for (const fileName of fileList) {
    const fullPath = path.join(__dirname, fileName);
    if (fs.existsSync(fullPath)) {
      return require(fullPath);
    }
  }

  // Graceful fallback router for pending modules
  const fallback = express.Router();
  fallback.all('*', (req, res) => {
    res.status(501).json({
      success: false,
      message: `The ${moduleName} module is currently being configured.`,
    });
  });
  return fallback;
}

// 1. Auth routes
const authRoutes = safeLoadRoute(['auth.routes.js', 'auth.js'], 'Authentication');
router.use('/auth', authRoutes);

// 2. Users routes
const userRoutes = safeLoadRoute(['user.routes.js', 'users.routes.js', 'users.js', 'user.js'], 'Users');
router.use('/users', userRoutes);

// 3. Associations routes
const associationRoutes = safeLoadRoute(['association.routes.js', 'associations.routes.js', 'associations.js', 'association.js'], 'Associations');
router.use('/associations', associationRoutes);

// 4. SOS routes
const sosRoutes = safeLoadRoute(['sos.routes.js', 'sos.js'], 'SOS Emergency');
router.use('/sos', sosRoutes);

// 5. News routes
const newsRoutes = safeLoadRoute(['news.routes.js', 'news.js'], 'News');
router.use('/news', newsRoutes);

// 6. Voting routes
const votingRoutes = safeLoadRoute(['voting.routes.js', 'voting.js'], 'Voting');
router.use('/voting', votingRoutes);

// 7. Complaints routes
const complaintRoutes = safeLoadRoute(['complaint.routes.js', 'complaints.routes.js', 'complaints.js', 'complaint.js'], 'Complaints');
router.use('/complaints', complaintRoutes);

// 8. Maintenance routes
const maintenanceRoutes = safeLoadRoute(['maintenance.routes.js', 'maintenance.js'], 'Maintenance');
router.use('/maintenance', maintenanceRoutes);

// 9. Events routes
const eventRoutes = safeLoadRoute(['event.routes.js', 'events.routes.js', 'events.js', 'event.js'], 'Events');
router.use('/events', eventRoutes);

// 10. Documents routes
const documentRoutes = safeLoadRoute(['document.routes.js', 'documents.routes.js', 'documents.js', 'document.js'], 'Documents');
router.use('/documents', documentRoutes);

// 11. Notifications routes
const notificationRoutes = safeLoadRoute(['notification.routes.js', 'notifications.routes.js', 'notifications.js', 'notification.js'], 'Notifications');
router.use('/notifications', notificationRoutes);

// 12. Audit Log routes
const auditRoutes = safeLoadRoute(['audit.routes.js', 'audit.js'], 'Audit Log');
router.use('/audit', auditRoutes);

// 13. Event Captures (Photos & Videos) routes
const eventCaptureRoutes = safeLoadRoute(['eventCapture.routes.js', 'event-captures.routes.js', 'eventCaptures.routes.js'], 'Event Captures');
router.use('/event-captures', eventCaptureRoutes);

module.exports = router;
