const pool = require('../config/db');
const bcrypt = require('bcrypt');
const smsService = require('../services/sms.service');
const emailService = require('../services/email.service');
const { generateMemberCode } = require('../utils/generateMemberCode');
const exportUtils = require('../utils/exportUtils');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Helper to log audit events
const logAudit = async (userId, action, entityType, entityId, details, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, entityType, entityId || null, JSON.stringify(details || {}), ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error in user controller:', err.message);
  }
};

// Unique member code generator helper
const getUniqueMemberCode = async () => {
  let code = null;
  if (typeof generateMemberCode === 'function') {
    try {
      code = await generateMemberCode();
    } catch (e) {
      // fallback
    }
  }

  // Ensure 6-digit uniqueness in DB
  let isUnique = false;
  let attempts = 0;
  while (!isUnique && attempts < 10) {
    if (!code || attempts > 0) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    }
    const check = await pool.query('SELECT id FROM users WHERE member_code = $1', [code]);
    if (check.rows.length === 0) {
      isUnique = true;
    } else {
      code = null;
      attempts++;
    }
  }
  return code || Math.floor(100000 + Math.random() * 900000).toString();
};

const userController = {
  /**
   * List pending member registrations
   * Super Admin sees all (or filtered by association_id)
   * Admin sees own association only
   */
  async getPending(req, res, next) {
    try {
      const { role, is_main_admin, association_id: userAssocId } = req.user;
      let queryText = `
        SELECT u.id, u.name, u.email, u.phone, u.role, u.is_main_admin, u.association_id, u.profile_photo,
               CASE
                 WHEN u.is_main_admin = true THEN 'Main Association Admin'
                 WHEN u.role = 'admin' THEN 'Layout Admin'
                 ELSE 'Resident Member'
               END as display_role,
               u.door_no, u.street, u.layout_name, u.taluk, u.district, u.state,
               u.eb_bill_proof, u.property_tax_receipt, u.status, u.created_at,
               a.name as association_name
        FROM users u
        LEFT JOIN associations a ON u.association_id = a.id
        WHERE u.status = 'pending'
      `;
      const queryParams = [];

      if (role === 'super_admin') {
        // Super Admin only approves new Association & Main Association Admin registrations
        // Regular user and layout admin registration approvals are canceled for superadmin
        queryText += ' AND u.is_main_admin = true';
        if (req.query.association_id) {
          queryParams.push(req.query.association_id);
          queryText += ` AND u.association_id = $${queryParams.length}`;
        }
      } else {
        // Main Association Admin approves resident members and layout admins
        if (!is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Permission denied. Only the Main Association Admin has authority to review and approve registrations.'
          });
        }
        queryParams.push(userAssocId);
        queryText += ` AND u.association_id = $${queryParams.length} AND (u.is_main_admin IS NOT TRUE OR u.is_main_admin = false)`;
      }

      queryText += ' ORDER BY u.created_at ASC';

      const result = await pool.query(queryText, queryParams);
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Approve a pending user
   * Assigns a 6-digit member_code and notifies user
   */
  async approve(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role, is_main_admin, association_id: adminAssocId } = req.user;

      // Check user exists
      const userCheck = await pool.query(
        'SELECT id, name, email, phone, role, is_main_admin, association_id, status FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const targetUser = userCheck.rows[0];

      // Permission check:
      // Super Admin: only approves new Association & Main Association Admin registrations
      // Regular user & layout admin registration approvals are canceled for Super Admin
      if (role === 'super_admin') {
        if (!targetUser.is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Approval canceled for Super Admin. Resident member and layout administrator registrations must be approved by the Main Association Admin.'
          });
        }
      } else {
        if (!is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Permission denied. Only the Main Association Admin has authority to approve registrations.'
          });
        }

        if (targetUser.association_id !== adminAssocId) {
          return res.status(403).json({
            success: false,
            message: 'You can only approve users within your own layout association.'
          });
        }

        if (targetUser.is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Only the Super Administrator has authority to approve a Main Association Admin account.'
          });
        }
      }

      if (targetUser.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'User is already approved'
        });
      }

      // Generate unique 6-digit member code
      const memberCode = await getUniqueMemberCode();

      // Update user status and member code
      const updateResult = await pool.query(
        `UPDATE users
         SET status = 'approved',
             member_code = $1,
             rejection_reason = NULL,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, phone, role, association_id, member_code, status, updated_at`,
        [memberCode, userId]
      );

      const approvedUser = updateResult.rows[0];

      // If approved user has an association, ensure association is active
      if (approvedUser.association_id) {
        await pool.query(
          'UPDATE associations SET is_active = true WHERE id = $1',
          [approvedUser.association_id]
        );
      }

      // Audit log
      await logAudit(
        req.user.id,
        'USER_APPROVE',
        'users',
        userId,
        { memberCode, approvedBy: req.user.id, role: approvedUser.role },
        req.ip
      );

      // Notification in DB
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          'Account Approved',
          `Congratulations! Your membership account has been approved. Your Member Code is ${memberCode}.`,
          'success',
          '/member/dashboard'
        ]
      );

      // Send email
      try {
        if (emailService && typeof emailService.sendApprovalEmail === 'function') {
          await emailService.sendApprovalEmail(approvedUser.email, {
            name: approvedUser.name,
            memberCode
          });
        } else if (emailService && typeof emailService.sendEmail === 'function') {
          await emailService.sendEmail({
            to: approvedUser.email,
            subject: 'Account Approved - Layout Association',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Welcome to Layout Association Management!</h2>
                <p>Dear ${approvedUser.name},</p>
                <p>Your registration has been approved by the administrator.</p>
                <p><strong>Your Member Code is:</strong> <span style="font-size: 18px; color: #16a34a; font-weight: bold;">${memberCode}</span></p>
                <p>You can now log in to the portal and access all community features.</p>
                <hr/>
                <p style="font-size: 12px; color: #6b7280;">Powered by JishnuInfotech</p>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('Failed to send approval email:', err.message);
      }

      // Send SMS
      try {
        if (smsService && typeof smsService.sendSMS === 'function') {
          await smsService.sendSMS(
            approvedUser.phone,
            `Welcome to Layout Association! Your account is approved. Member Code: ${memberCode}. Login at portal.`
          );
        }
      } catch (err) {
        console.error('Failed to send approval SMS:', err.message);
      }

      res.json({
        success: true,
        message: 'User approved successfully',
        data: approvedUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reject a pending user registration with reason
   */
  async reject(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role, is_main_admin, association_id: adminAssocId } = req.user;
      const { rejection_reason, reason } = req.body;
      const finalReason = (rejection_reason || reason || 'Registration details did not meet association requirements.').trim();

      // Check user exists
      const userCheck = await pool.query(
        'SELECT id, name, email, phone, role, is_main_admin, association_id, status FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const targetUser = userCheck.rows[0];

      // Permission check:
      // Super Admin: only reviews new Association & Main Association Admin registrations
      // Regular user & layout admin registration rejections are canceled for Super Admin
      if (role === 'super_admin') {
        if (!targetUser.is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Rejection canceled for Super Admin. Resident member and layout administrator registrations must be reviewed by the Main Association Admin.'
          });
        }
      } else {
        if (!is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Permission denied. Only the Main Association Admin has authority to reject registrations.'
          });
        }

        if (targetUser.association_id !== adminAssocId) {
          return res.status(403).json({
            success: false,
            message: 'You can only reject users within your own layout association.'
          });
        }

        if (targetUser.is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Only the Super Administrator has authority to reject a Main Association Admin registration.'
          });
        }
      }

      const updateResult = await pool.query(
        `UPDATE users
         SET status = 'rejected',
             rejection_reason = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, phone, role, association_id, status, rejection_reason, updated_at`,
        [finalReason, userId]
      );

      const rejectedUser = updateResult.rows[0];

      // Audit log
      await logAudit(
        req.user.id,
        'USER_REJECT',
        'users',
        userId,
        { reason: finalReason, rejectedBy: req.user.id },
        req.ip
      );

      // Notification
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'Account Registration Status',
          `Your registration request was not approved: ${finalReason}`,
          'error'
        ]
      );

      // Email
      try {
        if (emailService && typeof emailService.sendEmail === 'function') {
          await emailService.sendEmail({
            to: rejectedUser.email,
            subject: 'Registration Update - Layout Association',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Registration Update</h2>
                <p>Dear ${rejectedUser.name},</p>
                <p>We regret to inform you that your registration could not be approved at this time.</p>
                <p><strong>Reason:</strong> ${finalReason}</p>
                <p>Please contact the association administrator if you have any questions.</p>
                <hr/>
                <p style="font-size: 12px; color: #6b7280;">Powered by JishnuInfotech</p>
              </div>
            `
          });
        }
      } catch (err) {
        console.error('Failed to send rejection email:', err.message);
      }

      // SMS
      try {
        if (smsService && typeof smsService.sendSMS === 'function') {
          await smsService.sendSMS(
            rejectedUser.phone,
            `Your Layout Association registration was not approved. Reason: ${finalReason}`
          );
        }
      } catch (err) {
        console.error('Failed to send rejection SMS:', err.message);
      }

      res.json({
        success: true,
        message: 'User rejected successfully',
        data: rejectedUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List users with search, filtering, and pagination
   */
  async list(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      const {
        search,
        status,
        role: filterRole,
        association_id: queryAssocId,
        page = 1,
        limit = 20
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const whereConditions = [];
      const queryParams = [];

      // Association Isolation
      if (role === 'super_admin') {
        if (queryAssocId) {
          queryParams.push(queryAssocId);
          whereConditions.push(`u.association_id = $${queryParams.length}`);
        }
      } else {
        queryParams.push(userAssocId);
        whereConditions.push(`u.association_id = $${queryParams.length}`);
      }

      if (status) {
        queryParams.push(status);
        whereConditions.push(`u.status = $${queryParams.length}`);
      }

      if (filterRole) {
        queryParams.push(filterRole);
        whereConditions.push(`u.role = $${queryParams.length}`);
      }

      if (search) {
        queryParams.push(`%${search.trim()}%`);
        const searchIdx = queryParams.length;
        whereConditions.push(`(
          u.name ILIKE $${searchIdx} OR
          u.email ILIKE $${searchIdx} OR
          u.phone ILIKE $${searchIdx} OR
          u.member_code ILIKE $${searchIdx} OR
          u.door_no ILIKE $${searchIdx}
        )`);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count query
      const countQuery = `SELECT COUNT(*) FROM users u ${whereClause}`;
      const countResult = await pool.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].count, 10);

      // Data query
      queryParams.push(limitNum);
      const limitIdx = queryParams.length;
      queryParams.push(offset);
      const offsetIdx = queryParams.length;

      const dataQuery = `
        SELECT u.id, u.name, u.email, u.phone, u.role, u.is_main_admin, u.association_id, u.profile_photo,
               CASE
                 WHEN u.is_main_admin = true THEN 'Main Association Admin'
                 WHEN u.role = 'admin' THEN 'Layout Admin'
                 WHEN u.role = 'super_admin' THEN 'Super Admin'
                 ELSE 'Resident Member'
               END as display_role,
               u.member_code, u.door_no, u.street, u.layout_name, u.taluk,
               u.district, u.state, u.eb_bill_proof, u.property_tax_receipt,
               u.status, u.language, u.created_at, u.updated_at,
               a.name as association_name
        FROM users u
        LEFT JOIN associations a ON u.association_id = a.id
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const dataResult = await pool.query(dataQuery, queryParams);

      res.json({
        success: true,
        data: dataResult.rows,
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
   * Get single user by ID
   */
  async getById(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const query = `
        SELECT u.id, u.name, u.email, u.phone, u.role, u.is_main_admin, u.association_id, u.profile_photo,
               CASE
                 WHEN u.is_main_admin = true THEN 'Main Association Admin'
                 WHEN u.role = 'admin' THEN 'Layout Admin'
                 WHEN u.role = 'super_admin' THEN 'Super Admin'
                 ELSE 'Resident Member'
               END as display_role,
               u.member_code, u.door_no, u.street, u.layout_name, u.taluk,
               u.district, u.state, u.eb_bill_proof, u.property_tax_receipt,
               u.status, u.rejection_reason, u.language, u.created_at, u.updated_at,
               a.name as association_name
        FROM users u
        LEFT JOIN associations a ON u.association_id = a.id
        WHERE u.id = $1
      `;
      const result = await pool.query(query, [targetId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = result.rows[0];

      // Enforce isolation
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to user profile'
        });
      }

      if (requesterRole === 'admin' && user.association_id !== requesterAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access across associations'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update user details
   */
  async update(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      // Check user existence
      const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const existingUser = userCheck.rows[0];

      // Enforce isolation
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to update this user'
        });
      }

      if (requesterRole === 'admin' && existingUser.association_id !== requesterAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot update users outside your association'
        });
      }

      const {
        name,
        email,
        phone,
        password,
        door_no,
        street,
        layout_name,
        taluk,
        district,
        state,
        language,
        role: updatedRole
      } = req.body;

      // Check email uniqueness if changed
      let emailToSave = null;
      if (email && email.trim().toLowerCase() !== existingUser.email) {
        const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [
          email.trim().toLowerCase(),
          targetId
        ]);
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Email address already in use by another account'
          });
        }
        emailToSave = email.trim().toLowerCase();
      }

      // Hash password if provided
      let passwordHashToSave = null;
      if (password && password.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        passwordHashToSave = await bcrypt.hash(password.trim(), salt);
      }

      // Role change restriction: super_admin or Main Association Admin of the same association can change user role
      let roleToSave = existingUser.role;
      if (updatedRole && updatedRole !== existingUser.role) {
        if (
          requesterRole !== 'super_admin' &&
          !(requesterRole === 'admin' && req.user.is_main_admin && existingUser.association_id === req.user.association_id)
        ) {
          return res.status(403).json({
            success: false,
            message: 'Only super admin or Main Association Admin can modify user roles'
          });
        }
        roleToSave = updatedRole;
      }

      // Handle proof document uploads if provided
      const ebBillProof = req.files && req.files.eb_bill_proof && req.files.eb_bill_proof[0]
        ? req.files.eb_bill_proof[0].path.replace(/\\/g, '/')
        : null;

      const propertyTaxReceipt = req.files && req.files.property_tax_receipt && req.files.property_tax_receipt[0]
        ? req.files.property_tax_receipt[0].path.replace(/\\/g, '/')
        : null;

      // Handle profile photo / avatar upload if provided
      let profilePhoto = null;
      if (req.files) {
        const photoFile = (req.files.profile_photo && req.files.profile_photo[0]) || (req.files.avatar && req.files.avatar[0]);
        if (photoFile) {
          profilePhoto = photoFile.path.replace(/\\/g, '/');
          const idx = profilePhoto.indexOf('/uploads/');
          if (idx !== -1) profilePhoto = profilePhoto.substring(idx);
        }
      }

      const updateQuery = `
        UPDATE users
        SET name = COALESCE($1, name),
            email = COALESCE($2, email),
            phone = COALESCE($3, phone),
            password_hash = COALESCE($4, password_hash),
            door_no = COALESCE($5, door_no),
            street = COALESCE($6, street),
            layout_name = COALESCE($7, layout_name),
            taluk = COALESCE($8, taluk),
            district = COALESCE($9, district),
            state = COALESCE($10, state),
            language = COALESCE($11, language),
            role = $12,
            eb_bill_proof = COALESCE($13, eb_bill_proof),
            property_tax_receipt = COALESCE($14, property_tax_receipt),
            profile_photo = COALESCE($15, profile_photo),
            updated_at = NOW()
        WHERE id = $16
        RETURNING id, name, email, phone, role, is_main_admin, association_id, member_code,
                  door_no, street, layout_name, taluk, district, state,
                  eb_bill_proof, property_tax_receipt, profile_photo, created_at,
                  language, status, updated_at
      `;

      const values = [
        name ? name.trim() : null,
        emailToSave,
        phone ? phone.trim() : null,
        passwordHashToSave,
        door_no ? door_no.trim() : null,
        street ? street.trim() : null,
        layout_name ? layout_name.trim() : null,
        taluk ? taluk.trim() : null,
        district ? district.trim() : null,
        state ? state.trim() : null,
        language || null,
        roleToSave,
        ebBillProof,
        propertyTaxReceipt,
        profilePhoto,
        targetId
      ];

      const result = await pool.query(updateQuery, values);
      const updatedUser = result.rows[0];

      await logAudit(
        requesterId,
        'USER_UPDATE',
        'users',
        targetId,
        { updatedFields: Object.keys(req.body) },
        req.ip
      );

      res.json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Change user role / designation
   * Allows:
   *  - Promoting an admin or resident member to Main Association Admin
   *  - Changing Main Association Admin to Layout Admin or Resident Member
   *  - Promoting Resident Member to Layout Admin
   *  - Demoting Layout Admin to Resident Member
   */
  async changeRole(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { new_role, previous_admin_role, new_main_admin_id } = req.body;
      const { id: requesterId, role: requesterRole, is_main_admin: requesterIsMainAdmin, association_id: requesterAssocId } = req.user;

      if (!['main_admin', 'admin', 'member'].includes(new_role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified. Must be one of: main_admin, admin, member'
        });
      }

      // Check target user
      const userCheck = await pool.query(
        'SELECT id, name, email, phone, role, is_main_admin, association_id, member_code, status FROM users WHERE id = $1',
        [targetId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Target user not found'
        });
      }

      const targetUser = userCheck.rows[0];

      // Disallow changing root super admin
      if (
        targetUser.role === 'super_admin' ||
        targetUser.member_code === '#000001' ||
        targetUser.email === 'superadmin@association.com'
      ) {
        return res.status(403).json({
          success: false,
          message: 'Root Super Administrator role cannot be modified'
        });
      }

      // Authorization check
      if (requesterRole === 'super_admin') {
        // Super admin can change anyone except root super admin
      } else if (requesterRole === 'admin') {
        if (!requesterIsMainAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Permission denied. Only the Main Association Admin has authority to change user roles.'
          });
        }
        if (targetUser.association_id !== requesterAssocId) {
          return res.status(403).json({
            success: false,
            message: 'You can only manage users within your own layout association.'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const targetAssocId = targetUser.association_id;
      if (!targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'User does not belong to any association'
        });
      }

      let updatedTargetUser;

      if (new_role === 'main_admin') {
        // 1. If association had another main admin, demote them to previous_admin_role (default: admin)
        const demoteRole = previous_admin_role === 'member' ? 'member' : 'admin';

        await pool.query(
          `UPDATE users
           SET is_main_admin = false,
               role = $1,
               updated_at = NOW()
           WHERE association_id = $2 AND id != $3 AND is_main_admin = true`,
          [demoteRole, targetAssocId, targetId]
        );

        // 2. Promote target user to Main Association Admin
        const targetRes = await pool.query(
          `UPDATE users
           SET role = 'admin',
               is_main_admin = true,
               updated_at = NOW()
           WHERE id = $1
           RETURNING id, name, email, phone, role, is_main_admin, association_id, member_code, status`,
          [targetId]
        );
        updatedTargetUser = targetRes.rows[0];

        // 3. Update association main_admin_id
        await pool.query(
          'UPDATE associations SET main_admin_id = $1, updated_at = NOW() WHERE id = $2',
          [targetId, targetAssocId]
        );
      } else {
        // Target is being set to 'admin' (Layout Admin) or 'member' (Resident Member)
        const targetRole = new_role;

        // If targetUser was the Main Admin:
        if (targetUser.is_main_admin) {
          // If a new_main_admin_id is provided, transfer Main Admin leadership to that user
          if (new_main_admin_id && parseInt(new_main_admin_id, 10) !== targetId) {
            const newAdminId = parseInt(new_main_admin_id, 10);
            await pool.query(
              `UPDATE users
               SET role = 'admin',
                   is_main_admin = true,
                   updated_at = NOW()
               WHERE id = $1 AND association_id = $2`,
              [newAdminId, targetAssocId]
            );
            await pool.query(
              'UPDATE associations SET main_admin_id = $1, updated_at = NOW() WHERE id = $2',
              [newAdminId, targetAssocId]
            );
          } else {
            // Find another active admin in the association to be main_admin, or clear
            const altAdmin = await pool.query(
              `SELECT id FROM users
               WHERE association_id = $1 AND id != $2 AND role = 'admin' AND status = 'approved'
               ORDER BY id ASC LIMIT 1`,
              [targetAssocId, targetId]
            );
            if (altAdmin.rows.length > 0) {
              const newAdminId = altAdmin.rows[0].id;
              await pool.query(
                `UPDATE users SET is_main_admin = true, updated_at = NOW() WHERE id = $1`,
                [newAdminId]
              );
              await pool.query(
                'UPDATE associations SET main_admin_id = $1, updated_at = NOW() WHERE id = $2',
                [newAdminId, targetAssocId]
              );
            } else {
              await pool.query(
                'UPDATE associations SET main_admin_id = NULL, updated_at = NOW() WHERE id = $1',
                [targetAssocId]
              );
            }
          }
        }

        const targetRes = await pool.query(
          `UPDATE users
           SET role = $1,
               is_main_admin = false,
               updated_at = NOW()
           WHERE id = $2
           RETURNING id, name, email, phone, role, is_main_admin, association_id, member_code, status`,
          [targetRole, targetId]
        );
        updatedTargetUser = targetRes.rows[0];
      }

      await logAudit(
        requesterId,
        'USER_ROLE_CHANGE',
        'users',
        targetId,
        {
          previous_role: targetUser.role,
          previous_is_main_admin: targetUser.is_main_admin,
          new_role: updatedTargetUser.role,
          new_is_main_admin: updatedTargetUser.is_main_admin,
          changedBy: requesterId
        },
        req.ip
      );

      res.json({
        success: true,
        message: `User role successfully updated to ${
          updatedTargetUser.is_main_admin
            ? 'Main Association Admin'
            : updatedTargetUser.role === 'admin'
            ? 'Layout Admin'
            : 'Resident Member'
        }`,
        data: updatedTargetUser
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete or remove user
   */
  async remove(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, is_main_admin, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id, role, is_main_admin, email, member_code FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const target = userCheck.rows[0];

      // Protect Primary / Root Super Admin (#000001 or superadmin@association.com)
      if (
        target.role === 'super_admin' &&
        (target.email === 'superadmin@association.com' || target.member_code === '000001')
      ) {
        return res.status(403).json({
          success: false,
          message: 'Primary Super Administrator account cannot be deleted.'
        });
      }

      // Prevent user from deleting their own account
      if (target.id === requesterId) {
        return res.status(403).json({
          success: false,
          message: 'You cannot delete your own account.'
        });
      }

      if (requesterRole !== 'super_admin') {
        if (!is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Permission denied. Only the Main Association Admin has authority to remove users.'
          });
        }

        if (target.association_id !== requesterAssocId) {
          return res.status(403).json({
            success: false,
            message: 'Cannot delete users outside your association'
          });
        }

        if (target.is_main_admin) {
          return res.status(403).json({
            success: false,
            message: 'Only the Super Administrator has authority to delete a Main Association Admin account.'
          });
        }
      }

      await pool.query('DELETE FROM users WHERE id = $1', [targetId]);

      await logAudit(
        requesterId,
        'USER_DELETE',
        'users',
        targetId,
        { deletedUserId: targetId },
        req.ip
      );

      res.json({
        success: true,
        message: 'User removed successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create another super admin
   * Super Admin only
   */
  async createSuperAdmin(req, res, next) {
    try {
      const { name, email, phone, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      // Check email uniqueness
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email already exists'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const memberCode = await getUniqueMemberCode();

      const insertQuery = `
        INSERT INTO users (
          name, email, phone, password_hash, role, status, member_code
        ) VALUES ($1, $2, $3, $4, 'super_admin', 'approved', $5)
        RETURNING id, name, email, phone, role, status, member_code, created_at
      `;
      const result = await pool.query(insertQuery, [
        name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        passwordHash,
        memberCode
      ]);

      const newAdmin = result.rows[0];

      await logAudit(
        req.user.id,
        'SUPERADMIN_CREATE',
        'users',
        newAdmin.id,
        { email: newAdmin.email, name: newAdmin.name },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Super Admin created successfully',
        data: newAdmin
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create an association admin
   * Super Admin or Main Association Admin
   */
  async createAdmin(req, res, next) {
    try {
      const {
        name,
        email,
        phone,
        password,
        door_no,
        street,
        layout_name,
        taluk,
        district,
        state
      } = req.body;

      const targetAssocId = req.user.role === 'admin'
        ? req.user.association_id
        : (req.body.association_id ? parseInt(req.body.association_id, 10) : req.user.association_id);

      if (req.user.role === 'admin' && !req.user.is_main_admin) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only the Main Association Admin has authority to add administrators.'
        });
      }

      if (!name || !email || !password || !targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, password, and association are required'
        });
      }

      // Verify association exists
      const assocCheck = await pool.query('SELECT id, name, main_admin_id FROM associations WHERE id = $1', [targetAssocId]);
      if (assocCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Selected association does not exist'
        });
      }

      // Check email uniqueness
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim().toLowerCase()]);
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email already exists'
        });
      }

      // Handle uploaded files
      const ebBillProof = req.files && req.files.eb_bill_proof && req.files.eb_bill_proof[0]
        ? req.files.eb_bill_proof[0].path.replace(/\\/g, '/')
        : null;

      const propertyTaxReceipt = req.files && req.files.property_tax_receipt && req.files.property_tax_receipt[0]
        ? req.files.property_tax_receipt[0].path.replace(/\\/g, '/')
        : null;

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const memberCode = await getUniqueMemberCode();

      // If created by Main Admin, isMainAdmin is always false (Layout Admin)
      const isMainAdmin = req.user.role === 'super_admin'
        ? (req.body.is_main_admin === true || req.body.is_main_admin === 'true' || !assocCheck.rows[0].main_admin_id)
        : false;

      const insertQuery = `
        INSERT INTO users (
          name, email, phone, password_hash, role, is_main_admin, association_id, status, member_code,
          door_no, street, layout_name, taluk, district, state,
          eb_bill_proof, property_tax_receipt
        ) VALUES (
          $1, $2, $3, $4, 'admin', $5, $6, 'approved', $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15
        )
        RETURNING id, name, email, phone, role, is_main_admin, association_id, status, member_code,
                  door_no, street, layout_name, taluk, district, state,
                  eb_bill_proof, property_tax_receipt, created_at
      `;
      const result = await pool.query(insertQuery, [
        name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        passwordHash,
        isMainAdmin,
        targetAssocId,
        memberCode,
        door_no ? door_no.trim() : null,
        street ? street.trim() : null,
        layout_name ? layout_name.trim() : (assocCheck.rows[0].name || null),
        taluk ? taluk.trim() : null,
        district ? district.trim() : null,
        state ? state.trim() : 'Tamil Nadu',
        ebBillProof,
        propertyTaxReceipt
      ]);

      const newAdmin = result.rows[0];

      if (isMainAdmin) {
        await pool.query('UPDATE associations SET main_admin_id = $1 WHERE id = $2', [
          newAdmin.id,
          targetAssocId
        ]);
      }

      await logAudit(
        req.user.id,
        'ADMIN_CREATE',
        'users',
        newAdmin.id,
        { email: newAdmin.email, name: newAdmin.name, association_id: newAdmin.association_id },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: `Layout Administrator "${newAdmin.name}" created and approved successfully!`,
        data: newAdmin
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a resident member manually
   * Super Admin or Main Association Admin
   */
  async createMember(req, res, next) {
    try {
      const {
        name,
        email,
        phone,
        password,
        door_no,
        street,
        layout_name,
        taluk,
        district,
        state,
        language = 'en'
      } = req.body;

      const targetAssocId = req.user.role === 'admin' 
        ? req.user.association_id 
        : (req.body.association_id ? parseInt(req.body.association_id, 10) : req.user.association_id);

      if (req.user.role === 'admin' && !req.user.is_main_admin) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied. Only the Main Association Admin has authority to add members.'
        });
      }

      if (!name || !email || !password || !targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, password, and layout association are required'
        });
      }

      // Check association exists
      const assocCheck = await pool.query('SELECT id, name FROM associations WHERE id = $1', [targetAssocId]);
      if (assocCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Selected association does not exist'
        });
      }

      // Check email uniqueness
      const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim().toLowerCase()]);
      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'A user with this email already exists'
        });
      }

      // Check duplicate door_no within same association if door_no is provided
      if (door_no) {
        const duplicateDoor = await pool.query(
          'SELECT id FROM users WHERE door_no = $1 AND association_id = $2',
          [door_no.trim(), targetAssocId]
        );
        if (duplicateDoor.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message: `Door number "${door_no}" is already registered in this association`
          });
        }
      }

      // Handle uploaded files
      const ebBillProof = req.files && req.files.eb_bill_proof && req.files.eb_bill_proof[0]
        ? req.files.eb_bill_proof[0].path.replace(/\\/g, '/')
        : null;

      const propertyTaxReceipt = req.files && req.files.property_tax_receipt && req.files.property_tax_receipt[0]
        ? req.files.property_tax_receipt[0].path.replace(/\\/g, '/')
        : null;

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const memberCode = await getUniqueMemberCode();

      const insertQuery = `
        INSERT INTO users (
          name, email, phone, password_hash, role, is_main_admin, association_id, status, member_code,
          door_no, street, layout_name, taluk, district, state,
          eb_bill_proof, property_tax_receipt, language
        ) VALUES (
          $1, $2, $3, $4, 'member', false, $5, 'approved', $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15
        )
        RETURNING id, name, email, phone, role, is_main_admin, association_id, status, member_code,
                  door_no, street, layout_name, taluk, district, state,
                  eb_bill_proof, property_tax_receipt, created_at
      `;
      const result = await pool.query(insertQuery, [
        name.trim(),
        email.trim().toLowerCase(),
        phone ? phone.trim() : null,
        passwordHash,
        targetAssocId,
        memberCode,
        door_no ? door_no.trim() : null,
        street ? street.trim() : null,
        layout_name ? layout_name.trim() : (assocCheck.rows[0].name || null),
        taluk ? taluk.trim() : null,
        district ? district.trim() : null,
        state ? state.trim() : 'Tamil Nadu',
        ebBillProof,
        propertyTaxReceipt,
        language
      ]);

      const newMember = result.rows[0];

      await logAudit(
        req.user.id,
        'MEMBER_MANUAL_CREATE',
        'users',
        newMember.id,
        { email: newMember.email, name: newMember.name, association_id: newMember.association_id, memberCode },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: `Resident Member "${newMember.name}" created and approved successfully!`,
        data: newMember
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export users list to Excel
   */
  async exportExcel(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      let queryText = `
        SELECT u.member_code, u.name, u.email, u.phone, u.role,
               u.door_no, u.street, u.layout_name, u.district, u.status,
               u.created_at, a.name as association_name
        FROM users u
        LEFT JOIN associations a ON u.association_id = a.id
      `;
      const params = [];

      if (role !== 'super_admin') {
        params.push(userAssocId);
        queryText += ' WHERE u.association_id = $1';
      } else if (req.query.association_id) {
        params.push(req.query.association_id);
        queryText += ' WHERE u.association_id = $1';
      }

      queryText += ' ORDER BY u.created_at DESC';
      const result = await pool.query(queryText, params);

      const columns = [
        { header: 'Member Code', key: 'member_code', width: 15 },
        { header: 'Name', key: 'name', width: 25 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Phone', key: 'phone', width: 15 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Door No', key: 'door_no', width: 15 },
        { header: 'Street', key: 'street', width: 20 },
        { header: 'Layout', key: 'layout_name', width: 20 },
        { header: 'Association', key: 'association_name', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Registered On', key: 'created_at', width: 20 }
      ];

      // Format date fields
      const formattedData = result.rows.map(row => ({
        ...row,
        created_at: row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'
      }));

      // Use exportUtils if available
      if (exportUtils && typeof exportUtils.exportToExcel === 'function') {
        const buffer = await exportUtils.exportToExcel(columns, formattedData, 'Users');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="users-list.xlsx"');
        return res.send(buffer);
      }

      // Built-in ExcelJS generation
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Users');
      worksheet.columns = columns;

      // Add rows
      formattedData.forEach(row => worksheet.addRow(row));

      // Style header
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="users-list.xlsx"');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export users list to PDF
   */
  async exportPdf(req, res, next) {
    try {
      const { role, association_id: userAssocId } = req.user;
      let queryText = `
        SELECT u.member_code, u.name, u.email, u.phone, u.door_no, u.status
        FROM users u
      `;
      const params = [];

      if (role !== 'super_admin') {
        params.push(userAssocId);
        queryText += ' WHERE u.association_id = $1';
      } else if (req.query.association_id) {
        params.push(req.query.association_id);
        queryText += ' WHERE u.association_id = $1';
      }

      queryText += ' ORDER BY u.created_at DESC';
      const result = await pool.query(queryText, params);

      const columns = [
        { header: 'Code', key: 'member_code' },
        { header: 'Name', key: 'name' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Door No', key: 'door_no' },
        { header: 'Status', key: 'status' }
      ];

      // Use exportUtils if available
      if (exportUtils && typeof exportUtils.exportToPdf === 'function') {
        const pdfBuffer = await exportUtils.exportToPdf('Members Directory', columns, result.rows);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="users-list.pdf"');
        return res.send(pdfBuffer);
      }

      // Built-in PDFKit generation
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="users-list.pdf"');
      doc.pipe(res);

      doc.fontSize(18).text('Members Directory', { align: 'center' });
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(1.5);

      result.rows.forEach((user, index) => {
        doc.fontSize(11).text(
          `${index + 1}. [${user.member_code || '------'}] ${user.name} - Door: ${user.door_no || 'N/A'} - Phone: ${user.phone} (${user.status})`
        );
      });

      doc.moveDown(2);
      doc.fontSize(9).fillColor('#6b7280').text('Powered by JishnuInfotech', { align: 'center' });

      doc.end();
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get family members of a user
   */
  async getFamilyMembers(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to family members' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const includeRemoved = req.query.include_removed === 'true';
      const query = includeRemoved
        ? 'SELECT * FROM family_members WHERE user_id = $1 ORDER BY created_at ASC'
        : 'SELECT * FROM family_members WHERE user_id = $1 AND is_active = true ORDER BY created_at ASC';

      const result = await pool.query(query, [targetId]);
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add a family member
   */
  async addFamilyMember(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to add family members for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const { name, relation, dob, blood_group, phone } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Family member name is required' });
      }
      if (!relation || !relation.trim()) {
        return res.status(400).json({ success: false, message: 'Relationship is required' });
      }

      const insertResult = await pool.query(
        `INSERT INTO family_members (user_id, name, relation, dob, blood_group, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING *`,
        [targetId, name.trim(), relation.trim(), dob || null, blood_group ? blood_group.trim() : null, phone ? phone.trim() : null]
      );

      await logAudit(
        req.user.id,
        'FAMILY_MEMBER_ADD',
        'family_members',
        insertResult.rows[0].id,
        { userId: targetId, name: name.trim(), relation: relation.trim() },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Family member added successfully',
        data: insertResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update family member details
   */
  async updateFamilyMember(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const familyId = parseInt(req.params.familyId, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to edit family members for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const memberCheck = await pool.query('SELECT * FROM family_members WHERE id = $1 AND user_id = $2', [familyId, targetId]);
      if (memberCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Family member not found' });
      }

      const { name, relation, dob, blood_group, phone } = req.body;
      if (name !== undefined && !name.trim()) {
        return res.status(400).json({ success: false, message: 'Family member name cannot be empty' });
      }
      if (relation !== undefined && !relation.trim()) {
        return res.status(400).json({ success: false, message: 'Relationship cannot be empty' });
      }

      const updateResult = await pool.query(
        `UPDATE family_members
         SET name = COALESCE($1, name),
             relation = COALESCE($2, relation),
             dob = $3,
             blood_group = $4,
             phone = $5,
             updated_at = NOW()
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [
          name !== undefined ? name.trim() : null,
          relation !== undefined ? relation.trim() : null,
          dob !== undefined ? (dob || null) : memberCheck.rows[0].dob,
          blood_group !== undefined ? (blood_group ? blood_group.trim() : null) : memberCheck.rows[0].blood_group,
          phone !== undefined ? (phone ? phone.trim() : null) : memberCheck.rows[0].phone,
          familyId,
          targetId
        ]
      );

      await logAudit(
        req.user.id,
        'FAMILY_MEMBER_UPDATE',
        'family_members',
        familyId,
        { userId: targetId, changes: req.body },
        req.ip
      );

      res.json({
        success: true,
        message: 'Family member updated successfully',
        data: updateResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Remove a family member (soft delete with reason)
   */
  async removeFamilyMember(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const familyId = parseInt(req.params.familyId, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to remove family members for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const memberCheck = await pool.query('SELECT * FROM family_members WHERE id = $1 AND user_id = $2', [familyId, targetId]);
      if (memberCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Family member not found' });
      }

      const { removal_reason } = req.body;
      if (!removal_reason || !removal_reason.trim()) {
        return res.status(400).json({ success: false, message: 'Removal reason is mandatory' });
      }

      const removeResult = await pool.query(
        `UPDATE family_members
         SET is_active = false,
             removal_reason = $1,
             removed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [removal_reason.trim(), familyId, targetId]
      );

      await logAudit(
        req.user.id,
        'FAMILY_MEMBER_REMOVE',
        'family_members',
        familyId,
        { userId: targetId, removalReason: removal_reason.trim() },
        req.ip
      );

      res.json({
        success: true,
        message: 'Family member removed successfully',
        data: removeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Restore a previously removed family member
   */
  async restoreFamilyMember(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const familyId = parseInt(req.params.familyId, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to restore family members for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const restoreResult = await pool.query(
        `UPDATE family_members
         SET is_active = true,
             removal_reason = NULL,
             removed_at = NULL,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [familyId, targetId]
      );

      res.json({
        success: true,
        message: 'Family member restored successfully',
        data: restoreResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get tenants of a user
   */
  async getTenants(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to tenants' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const includeRemoved = req.query.include_removed === 'true';
      const query = includeRemoved
        ? 'SELECT * FROM tenants WHERE user_id = $1 ORDER BY created_at ASC'
        : 'SELECT * FROM tenants WHERE user_id = $1 AND is_active = true ORDER BY created_at ASC';

      const result = await pool.query(query, [targetId]);
      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add a tenant
   */
  async addTenant(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to add tenants for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const { name, dob, blood_group, phone, email } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Tenant name is required' });
      }

      let aadharProof = null;
      if (req.files && req.files.aadhar_proof && req.files.aadhar_proof[0]) {
        aadharProof = req.files.aadhar_proof[0].path.replace(/\\/g, '/');
      } else if (req.file) {
        aadharProof = req.file.path.replace(/\\/g, '/');
      }

      const insertResult = await pool.query(
        `INSERT INTO tenants (user_id, name, dob, blood_group, aadhar_proof, phone, email, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING *`,
        [
          targetId,
          name.trim(),
          dob || null,
          blood_group ? blood_group.trim() : null,
          aadharProof,
          phone ? phone.trim() : null,
          email ? email.trim() : null
        ]
      );

      await logAudit(
        req.user.id,
        'TENANT_ADD',
        'tenants',
        insertResult.rows[0].id,
        { userId: targetId, name: name.trim() },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Tenant added successfully',
        data: insertResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update tenant details
   */
  async updateTenant(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const tenantId = parseInt(req.params.tenantId, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to edit tenants for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const tenantCheck = await pool.query('SELECT * FROM tenants WHERE id = $1 AND user_id = $2', [tenantId, targetId]);
      if (tenantCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      const { name, dob, blood_group, phone, email } = req.body;
      if (name !== undefined && !name.trim()) {
        return res.status(400).json({ success: false, message: 'Tenant name cannot be empty' });
      }

      let aadharProof = tenantCheck.rows[0].aadhar_proof;
      if (req.files && req.files.aadhar_proof && req.files.aadhar_proof[0]) {
        aadharProof = req.files.aadhar_proof[0].path.replace(/\\/g, '/');
      } else if (req.file) {
        aadharProof = req.file.path.replace(/\\/g, '/');
      }

      const updateResult = await pool.query(
        `UPDATE tenants
         SET name = COALESCE($1, name),
             dob = $2,
             blood_group = $3,
             aadhar_proof = COALESCE($4, aadhar_proof),
             phone = $5,
             email = $6,
             updated_at = NOW()
         WHERE id = $7 AND user_id = $8
         RETURNING *`,
        [
          name !== undefined ? name.trim() : null,
          dob !== undefined ? (dob || null) : tenantCheck.rows[0].dob,
          blood_group !== undefined ? (blood_group ? blood_group.trim() : null) : tenantCheck.rows[0].blood_group,
          aadharProof,
          phone !== undefined ? (phone ? phone.trim() : null) : tenantCheck.rows[0].phone,
          email !== undefined ? (email ? email.trim() : null) : tenantCheck.rows[0].email,
          tenantId,
          targetId
        ]
      );

      await logAudit(
        req.user.id,
        'TENANT_UPDATE',
        'tenants',
        tenantId,
        { userId: targetId, changes: req.body },
        req.ip
      );

      res.json({
        success: true,
        message: 'Tenant updated successfully',
        data: updateResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Remove a tenant (soft delete with reason)
   */
  async removeTenant(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const tenantId = parseInt(req.params.tenantId, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to remove tenants for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const tenantCheck = await pool.query('SELECT * FROM tenants WHERE id = $1 AND user_id = $2', [tenantId, targetId]);
      if (tenantCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Tenant not found' });
      }

      const { removal_reason } = req.body;
      const finalReason = (removal_reason && removal_reason.trim()) ? removal_reason.trim() : 'Vacated / Lease Ended';

      const removeResult = await pool.query(
        `UPDATE tenants
         SET is_active = false,
             removal_reason = $1,
             removed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND user_id = $3
         RETURNING *`,
        [finalReason, tenantId, targetId]
      );

      await logAudit(
        req.user.id,
        'TENANT_REMOVE',
        'tenants',
        tenantId,
        { userId: targetId, removalReason: finalReason },
        req.ip
      );

      res.json({
        success: true,
        message: 'Tenant marked as vacated/removed successfully',
        data: removeResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Restore a previously removed tenant
   */
  async restoreTenant(req, res, next) {
    try {
      const targetId = parseInt(req.params.id, 10);
      const tenantId = parseInt(req.params.tenantId, 10);
      const { id: requesterId, role: requesterRole, association_id: requesterAssocId } = req.user;

      const userCheck = await pool.query('SELECT id, association_id FROM users WHERE id = $1', [targetId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const targetUser = userCheck.rows[0];
      if (requesterRole === 'member' && targetId !== requesterId) {
        return res.status(403).json({ success: false, message: 'Unauthorized to restore tenants for this user' });
      }
      if (requesterRole === 'admin' && targetUser.association_id !== requesterAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access across associations' });
      }

      const restoreResult = await pool.query(
        `UPDATE tenants
         SET is_active = true,
             removal_reason = NULL,
             removed_at = NULL,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [tenantId, targetId]
      );

      res.json({
        success: true,
        message: 'Tenant restored successfully',
        data: restoreResult.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = userController;
