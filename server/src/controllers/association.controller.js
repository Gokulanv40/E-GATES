const pool = require('../config/db');

// Audit logging helper
const logAudit = async (userId, action, entityType, entityId, details, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, entityType, entityId || null, JSON.stringify(details || {}), ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error in association controller:', err.message);
  }
};

const associationController = {
  /**
   * Create a new association
   * Super Admin only
   */
  async create(req, res, next) {
    try {
      const { name, city, address } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Association name is required'
        });
      }

      const logo = req.file ? req.file.path.replace(/\\/g, '/') : null;

      const result = await pool.query(
        `INSERT INTO associations (name, city, address, logo, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [name.trim(), city ? city.trim() : null, address ? address.trim() : null, logo]
      );

      const association = result.rows[0];

      await logAudit(
        req.user.id,
        'ASSOCIATION_CREATE',
        'associations',
        association.id,
        { name: association.name },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Association created successfully',
        data: association
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk create multiple associations
   * Super Admin only
   */
  async createBulk(req, res, next) {
    try {
      const { associations } = req.body;

      if (!Array.isArray(associations) || associations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'An array of associations with names is required'
        });
      }

      const created = [];
      for (const item of associations) {
        if (!item || !item.name || !item.name.trim()) continue;

        const result = await pool.query(
          `INSERT INTO associations (name, city, address, is_active)
           VALUES ($1, $2, $3, true)
           RETURNING *`,
          [
            item.name.trim(),
            item.city ? item.city.trim() : null,
            item.address ? item.address.trim() : null
          ]
        );

        if (result.rows.length > 0) {
          created.push(result.rows[0]);
          await logAudit(
            req.user.id,
            'ASSOCIATION_BULK_CREATE',
            'associations',
            result.rows[0].id,
            { name: result.rows[0].name },
            req.ip
          );
        }
      }

      res.status(201).json({
        success: true,
        message: `Successfully created ${created.length} associations`,
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List associations
   * Non-SA sees active only (useful for registration dropdown)
   * SA sees all associations
   */
  async list(req, res, next) {
    try {
      const isSuperAdmin = req.user && req.user.role === 'super_admin';
      const { search, is_active } = req.query;

      let queryText = `
        SELECT a.id, a.name, a.city, a.address, a.logo, a.is_active, a.created_at,
               COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'approved' AND u.role = 'member') as member_count,
               COUNT(DISTINCT adm.id) as admin_count,
               COALESCE(STRING_AGG(DISTINCT adm.name, ', '), 'None Assigned') as admin_names
        FROM associations a
        LEFT JOIN users u ON u.association_id = a.id
        LEFT JOIN users adm ON adm.association_id = a.id AND adm.role = 'admin' AND adm.status = 'approved'
      `;

      const conditions = [];
      const params = [];

      if (!isSuperAdmin) {
        conditions.push('a.is_active = true');
      } else if (is_active !== undefined) {
        params.push(is_active === 'true');
        conditions.push(`a.is_active = $${params.length}`);
      }

      if (search) {
        params.push(`%${search.trim()}%`);
        conditions.push(`(a.name ILIKE $${params.length} OR a.city ILIKE $${params.length})`);
      }

      if (conditions.length > 0) {
        queryText += ` WHERE ${conditions.join(' AND ')}`;
      }

      queryText += ' GROUP BY a.id ORDER BY a.name ASC';

      const result = await pool.query(queryText, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single association with member count and admin details
   */
  async getById(req, res, next) {
    try {
      const assocId = parseInt(req.params.id, 10);

      const assocResult = await pool.query('SELECT * FROM associations WHERE id = $1', [assocId]);
      if (assocResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Association not found'
        });
      }

      const association = assocResult.rows[0];

      // Get member count
      const memberCountResult = await pool.query(
        "SELECT COUNT(*) FROM users WHERE association_id = $1 AND status = 'approved' AND role = 'member'",
        [assocId]
      );
      const memberCount = parseInt(memberCountResult.rows[0].count, 10);

      // Get association admins
      const adminResult = await pool.query(
        "SELECT id, name, email, phone, member_code FROM users WHERE association_id = $1 AND role = 'admin' AND status = 'approved'",
        [assocId]
      );

      res.json({
        success: true,
        data: {
          ...association,
          member_count: memberCount,
          admins: adminResult.rows
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update association details and logo
   * Super Admin only
   */
  async update(req, res, next) {
    try {
      const assocId = parseInt(req.params.id, 10);
      const { name, city, address, is_active } = req.body;

      // Check existence
      const check = await pool.query('SELECT * FROM associations WHERE id = $1', [assocId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Association not found'
        });
      }

      const current = check.rows[0];
      const logo = req.file ? req.file.path.replace(/\\/g, '/') : current.logo;
      const activeState = is_active !== undefined ? is_active === 'true' || is_active === true : current.is_active;

      const updateResult = await pool.query(
        `UPDATE associations
         SET name = COALESCE($1, name),
             city = COALESCE($2, city),
             address = COALESCE($3, address),
             logo = $4,
             is_active = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          name ? name.trim() : null,
          city ? city.trim() : null,
          address ? address.trim() : null,
          logo,
          activeState,
          assocId
        ]
      );

      const updated = updateResult.rows[0];

      await logAudit(
        req.user.id,
        'ASSOCIATION_UPDATE',
        'associations',
        assocId,
        { updatedFields: Object.keys(req.body) },
        req.ip
      );

      res.json({
        success: true,
        message: 'Association updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Toggle association is_active status
   * Super Admin only
   */
  async toggle(req, res, next) {
    try {
      const assocId = parseInt(req.params.id, 10);

      const result = await pool.query(
        `UPDATE associations
         SET is_active = NOT is_active,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [assocId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Association not found'
        });
      }

      const association = result.rows[0];

      await logAudit(
        req.user.id,
        'ASSOCIATION_TOGGLE_ACTIVE',
        'associations',
        assocId,
        { is_active: association.is_active },
        req.ip
      );

      res.json({
        success: true,
        message: `Association ${association.is_active ? 'activated' : 'deactivated'} successfully`,
        data: association
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Assign a user as Admin for an association
   * Super Admin only
   */
  async assignAdmin(req, res, next) {
    try {
      const assocId = parseInt(req.params.id, 10);
      const { user_id } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const assocCheck = await pool.query('SELECT id, name FROM associations WHERE id = $1', [assocId]);
      if (assocCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Association not found'
        });
      }

      const userCheck = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [user_id]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET role = 'admin',
             association_id = $1,
             status = 'approved',
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, phone, role, association_id, status`,
        [assocId, user_id]
      );

      const updatedUser = updateResult.rows[0];

      await logAudit(
        req.user.id,
        'ASSIGN_ASSOCIATION_ADMIN',
        'users',
        user_id,
        { association_id: assocId },
        req.ip
      );

      // Send notification to user
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user_id,
          'Admin Role Assigned',
          `You have been designated as an Administrator for ${assocCheck.rows[0].name}.`,
          'info',
          '/admin/dashboard'
        ]
      );

      res.json({
        success: true,
        message: 'Admin assigned successfully',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const targetAssocId = role === 'super_admin' ? (req.query.association_id || null) : userAssocId;

      let totalAssociations = 0;
      if (role === 'super_admin') {
        const assocCount = await pool.query('SELECT COUNT(*) FROM associations WHERE is_active = true');
        totalAssociations = parseInt(assocCount.rows[0].count, 10);
      }

      let membersQuery = "SELECT COUNT(*) FROM users WHERE status = 'approved' AND role = 'member'";
      let pendingQuery = "SELECT COUNT(*) FROM users WHERE status = 'pending'";
      let pollsQuery = "SELECT COUNT(*) FROM polls WHERE status = 'active' AND end_date > NOW()";
      let sosQuery = "SELECT COUNT(*) FROM sos_alerts WHERE created_at >= NOW() - INTERVAL '30 days'";
      let complaintsQuery = "SELECT COUNT(*) FROM complaints WHERE status IN ('open', 'in_progress')";

      const params = [];
      if (targetAssocId) {
        params.push(targetAssocId);
        membersQuery += ` AND association_id = $1`;
        pendingQuery += ` AND association_id = $1`;
        pollsQuery += ` AND association_id = $1`;
        sosQuery += ` AND association_id = $1`;
        complaintsQuery += ` AND association_id = $1`;
      }

      const [membersRes, pendingRes, pollsRes, sosRes, complaintsRes] = await Promise.all([
        pool.query(membersQuery, params),
        pool.query(pendingQuery, params),
        pool.query(pollsQuery, params),
        pool.query(sosQuery, params),
        pool.query(complaintsQuery, params)
      ]);

      res.json({
        success: true,
        data: {
          total_associations: totalAssociations,
          members: parseInt(membersRes.rows[0].count, 10),
          pending_approvals: parseInt(pendingRes.rows[0].count, 10),
          active_polls: parseInt(pollsRes.rows[0].count, 10),
          sos_alerts: parseInt(sosRes.rows[0].count, 10),
          active_complaints: parseInt(complaintsRes.rows[0].count, 10)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete association
   * Super Admin only
   */
  async remove(req, res, next) {
    try {
      const assocId = parseInt(req.params.id, 10);
      const check = await pool.query('SELECT * FROM associations WHERE id = $1', [assocId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Association not found' });
      }

      await pool.query('DELETE FROM associations WHERE id = $1', [assocId]);

      await logAudit(
        req.user.id,
        'ASSOCIATION_DELETE',
        'associations',
        assocId,
        { name: check.rows[0].name },
        req.ip
      );

      res.json({
        success: true,
        message: 'Association deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = associationController;
