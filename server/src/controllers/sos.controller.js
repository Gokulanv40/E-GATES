const pool = require('../config/db');
const smsService = require('../services/sms.service');
const { getIO } = require('../services/socket.service');

// Audit logging helper
const logAudit = async (userId, action, entityType, entityId, details, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, entityType, entityId || null, JSON.stringify(details || {}), ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error in sos controller:', err.message);
  }
};

const sosController = {
  /**
   * Trigger SOS emergency alert
   * Member or Admin
   */
  async trigger(req, res, next) {
    try {
      const userId = req.user.id;
      const associationId = req.user.association_id;

      if (!associationId) {
        return res.status(400).json({
          success: false,
          message: 'User must belong to an association to trigger SOS'
        });
      }

      const {
        emergency_type = 'Other',
        latitude,
        longitude,
        is_test = false,
        notes
      } = req.body;

      // Validate emergency type
      const allowedTypes = ['Medical', 'Fire', 'Theft/Intruder', 'Women Safety', 'Other'];
      const validEmergencyType = allowedTypes.includes(emergency_type) ? emergency_type : 'Other';

      // Insert SOS alert record
      const alertInsertQuery = `
        INSERT INTO sos_alerts (
          user_id, association_id, emergency_type, latitude, longitude,
          status, is_test, notes
        ) VALUES ($1, $2, $3, $4, $5, 'triggered', $6, $7)
        RETURNING *
      `;
      const alertResult = await pool.query(alertInsertQuery, [
        userId,
        associationId,
        validEmergencyType,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        Boolean(is_test),
        notes ? notes.trim() : null
      ]);

      const alert = alertResult.rows[0];

      // Fetch user profile info
      const userRes = await pool.query(
        'SELECT id, name, phone, door_no, street, layout_name FROM users WHERE id = $1',
        [userId]
      );
      const userProfile = userRes.rows[0] || {};

      // Fetch association name
      const assocRes = await pool.query('SELECT name FROM associations WHERE id = $1', [associationId]);
      const assocName = assocRes.rows[0]?.name || 'Layout Association';

      // Fetch SOS Contacts for this association
      const contactsRes = await pool.query(
        'SELECT * FROM sos_contacts WHERE association_id = $1 ORDER BY id ASC',
        [associationId]
      );
      const contacts = contactsRes.rows;

      const locationLink = (latitude && longitude)
        ? `https://maps.google.com/?q=${latitude},${longitude}`
        : 'Location unavailable';

      const alertPayload = {
        ...alert,
        user: {
          id: userProfile.id,
          name: userProfile.name,
          phone: userProfile.phone,
          door_no: userProfile.door_no,
          street: userProfile.street,
          layout_name: userProfile.layout_name
        },
        association_name: assocName,
        location_link: locationLink
      };

      // Emit socket event
      try {
        const io = typeof getIO === 'function' ? getIO() : null;
        if (io) {
          io.to(`association_${associationId}`).emit('sos:trigger', alertPayload);
          io.emit('sos:trigger', alertPayload); // Global broadcast fallback
        }
      } catch (socketErr) {
        console.error('Socket emission error for SOS trigger:', socketErr.message);
      }

      // Dispatch SMS to contacts
      const testPrefix = is_test ? '[TEST ALERT - PLEASE IGNORE] ' : 'EMERGENCY ALERT: ';
      const smsBody = `${testPrefix}${validEmergencyType} from ${userProfile.name} (Door: ${userProfile.door_no || 'N/A'}, Phone: ${userProfile.phone}) at ${assocName}. Location: ${locationLink}`;

      for (const contact of contacts) {
        // If this is a test alert, skip alerting the police contact
        if (is_test && contact.contact_type === 'police') {
          continue;
        }

        try {
          if (smsService && typeof smsService.sendSMS === 'function') {
            await smsService.sendSMS(contact.phone, smsBody);
          }
        } catch (smsErr) {
          console.error(`Failed to send SOS SMS to ${contact.name} (${contact.phone}):`, smsErr.message);
        }

        // DB Notification for contacts with an account
        if (contact.user_id) {
          try {
            await pool.query(
              `INSERT INTO notifications (user_id, title, message, type, link)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                contact.user_id,
                `${is_test ? '[TEST] ' : ''}SOS: ${validEmergencyType}`,
                smsBody,
                'error',
                `/admin/sos-alerts`
              ]
            );
          } catch (notifErr) {
            console.error('Notification error for SOS contact:', notifErr.message);
          }
        }
      }

      // Audit log
      await logAudit(
        userId,
        'SOS_TRIGGER',
        'sos_alerts',
        alert.id,
        { emergency_type: validEmergencyType, is_test: Boolean(is_test), latitude, longitude },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: is_test ? 'Test SOS alert triggered' : 'Emergency SOS alert dispatched to contacts',
        data: alertPayload
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Acknowledge SOS Alert
   */
  async acknowledge(req, res, next) {
    try {
      const alertId = parseInt(req.params.id, 10);
      const responderId = req.user.id;
      const { role, association_id: userAssocId } = req.user;

      const alertCheck = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [alertId]);
      if (alertCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'SOS Alert not found'
        });
      }

      const alert = alertCheck.rows[0];

      if (role !== 'super_admin' && alert.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to acknowledge this alert'
        });
      }

      // Calculate response time in seconds
      const createdAt = new Date(alert.created_at);
      const now = new Date();
      const responseTimeSeconds = Math.max(0, Math.round((now - createdAt) / 1000));

      const updateQuery = `
        UPDATE sos_alerts
        SET acknowledged_by = $1,
            acknowledged_at = NOW(),
            response_time_seconds = $2,
            status = 'acknowledged'
        WHERE id = $3
        RETURNING *
      `;
      const updateResult = await pool.query(updateQuery, [responderId, responseTimeSeconds, alertId]);
      const updatedAlert = updateResult.rows[0];

      const responderInfo = {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      };

      const payload = {
        ...updatedAlert,
        responder: responderInfo
      };

      // Emit socket event
      try {
        const io = typeof getIO === 'function' ? getIO() : null;
        if (io) {
          io.to(`association_${alert.association_id}`).emit('sos:acknowledge', payload);
          io.emit('sos:acknowledge', payload);
        }
      } catch (err) {
        console.error('Socket error on sos:acknowledge:', err.message);
      }

      // Notify the member who triggered the alert
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          alert.user_id,
          'SOS Alert Acknowledged',
          `Your SOS Alert has been acknowledged by ${req.user.name}. Help is on the way.`,
          'success'
        ]
      );

      // Audit log
      await logAudit(
        responderId,
        'SOS_ACKNOWLEDGE',
        'sos_alerts',
        alertId,
        { responseTimeSeconds },
        req.ip
      );

      res.json({
        success: true,
        message: 'SOS alert acknowledged',
        data: payload
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Resolve or mark false alarm
   */
  async resolve(req, res, next) {
    try {
      const alertId = parseInt(req.params.id, 10);
      const { status = 'resolved', notes } = req.body;
      const { role, association_id: userAssocId } = req.user;

      const validStatuses = ['resolved', 'false_alarm'];
      const targetStatus = validStatuses.includes(status) ? status : 'resolved';

      const alertCheck = await pool.query('SELECT * FROM sos_alerts WHERE id = $1', [alertId]);
      if (alertCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'SOS alert not found'
        });
      }

      const alert = alertCheck.rows[0];

      if (role !== 'super_admin' && alert.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateQuery = `
        UPDATE sos_alerts
        SET status = $1,
            resolved_at = NOW(),
            notes = COALESCE($2, notes)
        WHERE id = $3
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [targetStatus, notes ? notes.trim() : null, alertId]);
      const updatedAlert = result.rows[0];

      // Emit socket event
      try {
        const io = typeof getIO === 'function' ? getIO() : null;
        if (io) {
          io.to(`association_${alert.association_id}`).emit('sos:resolve', updatedAlert);
          io.emit('sos:resolve', updatedAlert);
        }
      } catch (err) {
        console.error('Socket error on sos:resolve:', err.message);
      }

      // Notify member
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          alert.user_id,
          'SOS Alert Closed',
          `Your SOS Alert has been marked as ${targetStatus}.`,
          'info'
        ]
      );

      // Audit log
      await logAudit(
        req.user.id,
        'SOS_RESOLVE',
        'sos_alerts',
        alertId,
        { status: targetStatus, notes },
        req.ip
      );

      res.json({
        success: true,
        message: `Alert marked as ${targetStatus}`,
        data: updatedAlert
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List SOS alerts
   */
  async listAlerts(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        status,
        emergency_type,
        is_test,
        date_from,
        date_to,
        association_id: queryAssocId,
        page = 1,
        limit = 20
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      const params = [];

      if (role === 'super_admin') {
        if (queryAssocId) {
          params.push(queryAssocId);
          conditions.push(`s.association_id = $${params.length}`);
        }
      } else {
        params.push(userAssocId);
        conditions.push(`s.association_id = $${params.length}`);
      }

      if (status) {
        params.push(status);
        conditions.push(`s.status = $${params.length}`);
      }

      if (emergency_type) {
        params.push(emergency_type);
        conditions.push(`s.emergency_type = $${params.length}`);
      }

      if (is_test !== undefined) {
        params.push(is_test === 'true');
        conditions.push(`s.is_test = $${params.length}`);
      }

      if (date_from) {
        params.push(date_from);
        conditions.push(`s.created_at >= $${params.length}`);
      }

      if (date_to) {
        params.push(date_to);
        conditions.push(`s.created_at <= $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countResult = await pool.query(`SELECT COUNT(*) FROM sos_alerts s ${whereClause}`, params);
      const total = parseInt(countResult.rows[0].count, 10);

      // Data query
      params.push(limitNum);
      const limitIdx = params.length;
      params.push(offset);
      const offsetIdx = params.length;

      const queryText = `
        SELECT s.*,
               u.name as user_name, u.phone as user_phone, u.email as user_email,
               u.member_code as user_member_code, u.door_no as user_door_no,
               u.street as user_street, u.layout_name as user_layout_name,
               ack.name as acknowledged_by_name,
               a.name as association_name
        FROM sos_alerts s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN users ack ON s.acknowledged_by = ack.id
        LEFT JOIN associations a ON s.association_id = a.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const result = await pool.query(queryText, params);

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single SOS alert details
   */
  async getAlert(req, res, next) {
    try {
      const alertId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const query = `
        SELECT s.*,
               u.name as user_name, u.phone as user_phone, u.door_no as user_door_no,
               u.street as user_street, u.layout_name as user_layout_name,
               ack.name as acknowledged_by_name,
               a.name as association_name
        FROM sos_alerts s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN users ack ON s.acknowledged_by = ack.id
        LEFT JOIN associations a ON s.association_id = a.id
        WHERE s.id = $1
      `;
      const result = await pool.query(query, [alertId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'SOS alert not found'
        });
      }

      const alert = result.rows[0];

      if (role !== 'super_admin' && alert.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to SOS alert'
        });
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get SOS contacts for an association
   */
  async getContacts(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const targetAssocId = role === 'super_admin'
        ? (req.query.association_id || userAssocId)
        : userAssocId;

      if (!targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required'
        });
      }

      const result = await pool.query(
        `SELECT sc.*, u.name as linked_user_name, u.email as linked_user_email
         FROM sos_contacts sc
         LEFT JOIN users u ON sc.user_id = u.id
         WHERE sc.association_id = $1
         ORDER BY sc.contact_type ASC, sc.id ASC`,
        [targetAssocId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Set or replace SOS contacts (exactly 2 members + 1 police)
   */
  async setContacts(req, res, next) {
    const client = await pool.connect();
    try {
      const { role, association_id: userAssocId } = req.user;
      const targetAssocId = role === 'super_admin'
        ? (req.body.association_id || userAssocId)
        : userAssocId;

      if (!targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required'
        });
      }

      const { contacts } = req.body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one SOS contact is required'
        });
      }

      // Validate required fields
      for (const c of contacts) {
        if (!c.name || !c.phone) {
          return res.status(400).json({
            success: false,
            message: 'Each contact must have a name and phone number'
          });
        }
      }

      await client.query('BEGIN');

      // Delete existing contacts for this association
      await client.query('DELETE FROM sos_contacts WHERE association_id = $1', [targetAssocId]);

      // Insert new contacts
      const inserted = [];
      for (const c of contacts) {
        const insertQuery = `
          INSERT INTO sos_contacts (association_id, contact_type, user_id, name, phone, designation)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        const resInsert = await client.query(insertQuery, [
          targetAssocId,
          c.contact_type,
          c.user_id ? parseInt(c.user_id, 10) : null,
          c.name.trim(),
          c.phone.trim(),
          c.designation ? c.designation.trim() : null
        ]);
        inserted.push(resInsert.rows[0]);
      }

      await client.query('COMMIT');

      await logAudit(
        req.user.id,
        'SET_SOS_CONTACTS',
        'sos_contacts',
        targetAssocId,
        { contactsCount: inserted.length },
        req.ip
      );

      res.json({
        success: true,
        message: 'SOS contacts configured successfully',
        data: inserted
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  },

  /**
   * Update a single SOS contact
   */
  async updateContact(req, res, next) {
    try {
      const contactId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;
      const { name, phone, designation, user_id } = req.body;

      const check = await pool.query('SELECT * FROM sos_contacts WHERE id = $1', [contactId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      const existing = check.rows[0];
      if (role !== 'super_admin' && existing.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const updateQuery = `
        UPDATE sos_contacts
        SET name = COALESCE($1, name),
            phone = COALESCE($2, phone),
            designation = COALESCE($3, designation),
            user_id = COALESCE($4, user_id)
        WHERE id = $5
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [
        name ? name.trim() : null,
        phone ? phone.trim() : null,
        designation ? designation.trim() : null,
        user_id ? parseInt(user_id, 10) : null,
        contactId
      ]);

      res.json({
        success: true,
        message: 'Contact updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * SOS Analytics and summary report
   */
  async getReport(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const targetAssocId = role === 'super_admin'
        ? (req.query.association_id || null)
        : userAssocId;

      let whereClause = '';
      const params = [];
      if (targetAssocId) {
        params.push(targetAssocId);
        whereClause = 'WHERE association_id = $1';
      }

      // Total alerts & average response time
      const statsQuery = `
        SELECT
          COUNT(*) as total_alerts,
          COUNT(*) FILTER (WHERE is_test = true) as test_alerts,
          COUNT(*) FILTER (WHERE is_test = false) as real_alerts,
          ROUND(AVG(response_time_seconds) FILTER (WHERE response_time_seconds IS NOT NULL)) as avg_response_time_seconds
        FROM sos_alerts
        ${whereClause}
      `;
      const statsRes = await pool.query(statsQuery, params);

      // By Emergency Type
      const byTypeQuery = `
        SELECT emergency_type, COUNT(*) as count
        FROM sos_alerts
        ${whereClause}
        GROUP BY emergency_type
        ORDER BY count DESC
      `;
      const byTypeRes = await pool.query(byTypeQuery, params);

      // By Status
      const byStatusQuery = `
        SELECT status, COUNT(*) as count
        FROM sos_alerts
        ${whereClause}
        GROUP BY status
        ORDER BY count DESC
      `;
      const byStatusRes = await pool.query(byStatusQuery, params);

      // Recent alerts
      const recentQuery = `
        SELECT s.id, s.emergency_type, s.status, s.is_test, s.response_time_seconds, s.created_at,
               u.name as user_name, u.door_no
        FROM sos_alerts s
        JOIN users u ON s.user_id = u.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT 10
      `;
      const recentRes = await pool.query(recentQuery, params);

      res.json({
        success: true,
        data: {
          summary: statsRes.rows[0],
          by_type: byTypeRes.rows,
          by_status: byStatusRes.rows,
          recent: recentRes.rows
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add a single SOS contact (e.g. family contact or responder)
   */
  async addSingleContact(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const { contact_type = 'family', name, phone, designation, user_id, association_id } = req.body;
      const targetAssocId = role === 'super_admin' ? (association_id || userAssocId) : userAssocId;

      if (!targetAssocId) {
        return res.status(400).json({ success: false, message: 'Association ID is required' });
      }

      if (!name || !phone) {
        return res.status(400).json({ success: false, message: 'Name and phone are required' });
      }

      const insertQuery = `
        INSERT INTO sos_contacts (association_id, contact_type, user_id, name, phone, designation)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [
        targetAssocId,
        contact_type,
        user_id ? parseInt(user_id, 10) : null,
        name.trim(),
        phone.trim(),
        designation ? designation.trim() : null
      ]);

      res.status(201).json({
        success: true,
        message: 'Contact added successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete single SOS contact
   */
  async deleteContact(req, res, next) {
    try {
      const contactId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM sos_contacts WHERE id = $1', [contactId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Contact not found' });
      }

      if (role !== 'super_admin' && check.rows[0].association_id !== userAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      await pool.query('DELETE FROM sos_contacts WHERE id = $1', [contactId]);

      res.json({
        success: true,
        message: 'SOS contact deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete SOS alert
   * Super Admin only
   */
  async deleteAlert(req, res, next) {
    try {
      const alertId = parseInt(req.params.id, 10);
      const check = await pool.query('SELECT id, user_id, association_id FROM sos_alerts WHERE id = $1', [alertId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Alert not found' });
      }

      await pool.query('DELETE FROM sos_alerts WHERE id = $1', [alertId]);

      await logAudit(
        req.user.id,
        'SOS_DELETE',
        'sos_alerts',
        alertId,
        { alertId },
        req.ip
      );

      res.json({
        success: true,
        message: 'SOS Alert record deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = sosController;
