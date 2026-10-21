const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const emailService = require('../services/email.service');
const smsService = require('../services/sms.service');

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_association_2026';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 7;

// Audit logging helper
const logAudit = async (userId, action, entityType, entityId, details, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, entityType, entityId || null, JSON.stringify(details || {}), ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error in auth controller:', err.message);
  }
};

const authController = {
  /**
   * Register a new user (member or admin)
   * Status defaults to 'pending'
   */
  async register(req, res, next) {
    try {
      const {
        name,
        email,
        phone,
        password,
        role = 'member',
        association_id,
        door_no,
        street,
        layout_name,
        taluk,
        district,
        state,
        language = 'en'
      } = req.body;

      if (!name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, phone, and password are required'
        });
      }

      // Check role constraint: regular registration cannot be super_admin
      if (role === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot register as super admin'
        });
      }

      // Check for duplicate email or phone
      const duplicateUser = await pool.query(
        'SELECT id, email, phone FROM users WHERE email = $1 OR phone = $2',
        [email.trim().toLowerCase(), phone.trim()]
      );

      if (duplicateUser.rows.length > 0) {
        const existing = duplicateUser.rows[0];
        const field = existing.email.toLowerCase() === email.trim().toLowerCase() ? 'Email' : 'Phone number';
        return res.status(409).json({
          success: false,
          message: `${field} is already registered`
        });
      }

      // Check duplicate door_no within same association
      if (door_no && association_id) {
        const duplicateDoor = await pool.query(
          'SELECT id FROM users WHERE door_no = $1 AND association_id = $2',
          [door_no.trim(), association_id]
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

      const profilePhoto = req.files && req.files.profile_photo && req.files.profile_photo[0]
        ? req.files.profile_photo[0].path.replace(/\\/g, '/')
        : null;

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Insert new user
      const insertQuery = `
        INSERT INTO users (
          name, email, phone, password_hash, role, association_id,
          door_no, street, layout_name, taluk, district, state,
          eb_bill_proof, property_tax_receipt, status, language, profile_photo
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, 'pending', $15, $16
        ) RETURNING id, name, email, phone, role, association_id, door_no, street, layout_name, status, profile_photo, created_at
      `;

      const values = [
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        passwordHash,
        role,
        association_id ? parseInt(association_id, 10) : null,
        door_no ? door_no.trim() : null,
        street ? street.trim() : null,
        layout_name ? layout_name.trim() : null,
        taluk ? taluk.trim() : null,
        district ? district.trim() : null,
        state ? state.trim() : null,
        ebBillProof,
        propertyTaxReceipt,
        language,
        profilePhoto
      ];

      const result = await pool.query(insertQuery, values);
      const newUser = result.rows[0];

      // Audit log
      await logAudit(
        newUser.id,
        'USER_REGISTER',
        'users',
        newUser.id,
        { email: newUser.email, role: newUser.role, association_id: newUser.association_id },
        req.ip
      );

      // Notify Main Association Admin for approval
      if (newUser.association_id) {
        try {
          let targetAdmins = await pool.query(
            "SELECT id, name, email, phone FROM users WHERE association_id = $1 AND role = 'admin' AND is_main_admin = true AND status = 'approved'",
            [newUser.association_id]
          );
          if (targetAdmins.rows.length === 0) {
            targetAdmins = await pool.query(
              "SELECT id, name, email, phone FROM users WHERE association_id = $1 AND role = 'admin' AND status = 'approved'",
              [newUser.association_id]
            );
          }

          const notifTitle = newUser.role === 'admin'
            ? 'New Layout Admin Pending Your Approval'
            : 'New Resident Member Pending Your Approval';

          const notifMsg = newUser.role === 'admin'
            ? `${newUser.name} has registered as an Administrator for your layout and requires your approval as Main Association Admin.`
            : `${newUser.name} has registered for door ${newUser.door_no || 'N/A'} and requires your approval as Main Association Admin.`;

          for (const admin of targetAdmins.rows) {
            await pool.query(
              `INSERT INTO notifications (user_id, title, message, type, link)
               VALUES ($1, $2, $3, $4, $5)`,
              [admin.id, notifTitle, notifMsg, 'info', '/admin/approvals']
            );
          }
        } catch (notifErr) {
          console.error('Failed to send registration notification to Main Admin:', notifErr.message);
        }
      }

      const responseMessage = newUser.role === 'admin'
        ? 'Registration submitted successfully! Your administrator registration is pending approval by the Main Association Admin.'
        : 'Registration submitted successfully! Your resident membership registration is pending approval by the Main Association Admin.';

      res.status(201).json({
        success: true,
        message: responseMessage,
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          status: newUser.status,
          created_at: newUser.created_at
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Register a new Association + Admin together
   * Public combined registration
   */
  async registerAssociationAndAdmin(req, res, next) {
    const client = await pool.connect();
    try {
      const {
        association_name,
        association_city,
        association_address,
        name,
        email,
        phone,
        password,
        door_no,
        street,
        taluk,
        district,
        state = 'Tamil Nadu',
        language = 'en'
      } = req.body;

      if (!association_name || !association_city) {
        return res.status(400).json({
          success: false,
          message: 'Association name and city/district are required'
        });
      }

      if (!name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'Administrator name, email, phone, and password are required'
        });
      }

      // Check for duplicate email or phone in users
      const duplicateUser = await client.query(
        'SELECT id, email, phone FROM users WHERE email = $1 OR phone = $2',
        [email.trim().toLowerCase(), phone.trim()]
      );

      if (duplicateUser.rows.length > 0) {
        const existing = duplicateUser.rows[0];
        const field = existing.email.toLowerCase() === email.trim().toLowerCase() ? 'Email' : 'Phone number';
        return res.status(409).json({
          success: false,
          message: `${field} is already registered`
        });
      }

      // Check for duplicate association name in same city
      const duplicateAssoc = await client.query(
        'SELECT id, name FROM associations WHERE LOWER(name) = LOWER($1) AND LOWER(city) = LOWER($2)',
        [association_name.trim(), association_city.trim()]
      );

      if (duplicateAssoc.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: `An association with name "${association_name}" already exists in ${association_city}`
        });
      }

      // Handle files
      const logo = req.files && req.files.logo && req.files.logo[0]
        ? req.files.logo[0].path.replace(/\\/g, '/')
        : null;

      const ebBillProof = req.files && req.files.eb_bill_proof && req.files.eb_bill_proof[0]
        ? req.files.eb_bill_proof[0].path.replace(/\\/g, '/')
        : null;

      const propertyTaxReceipt = req.files && req.files.property_tax_receipt && req.files.property_tax_receipt[0]
        ? req.files.property_tax_receipt[0].path.replace(/\\/g, '/')
        : null;

      const profilePhoto = req.files && req.files.profile_photo && req.files.profile_photo[0]
        ? req.files.profile_photo[0].path.replace(/\\/g, '/')
        : null;

      await client.query('BEGIN');

      // 1. Insert new association (inactive pending Super Admin approval)
      const assocRes = await client.query(
        `INSERT INTO associations (name, city, address, logo, is_active)
         VALUES ($1, $2, $3, $4, false)
         RETURNING *`,
        [association_name.trim(), association_city.trim(), association_address ? association_address.trim() : null, logo]
      );
      const newAssoc = assocRes.rows[0];

      // 2. Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // 3. Insert admin user with is_main_admin = true (pending Super Admin approval)
      const insertUserQuery = `
        INSERT INTO users (
          name, email, phone, password_hash, role, is_main_admin, association_id,
          door_no, street, layout_name, taluk, district, state,
          eb_bill_proof, property_tax_receipt, status, language, profile_photo
        ) VALUES (
          $1, $2, $3, $4, 'admin', true, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, 'pending', $14, $15
        ) RETURNING id, name, email, phone, role, is_main_admin, association_id, status, profile_photo, created_at
      `;
      const userRes = await client.query(insertUserQuery, [
        name.trim(),
        email.trim().toLowerCase(),
        phone.trim(),
        passwordHash,
        newAssoc.id,
        door_no ? door_no.trim() : null,
        street ? street.trim() : null,
        association_name.trim(),
        taluk ? taluk.trim() : null,
        district ? district.trim() : association_city.trim(),
        state ? state.trim() : 'Tamil Nadu',
        ebBillProof,
        propertyTaxReceipt,
        language,
        profilePhoto
      ]);
      const newAdmin = userRes.rows[0];

      // Link newly created Main Admin as association's primary main_admin_id
      await client.query('UPDATE associations SET main_admin_id = $1 WHERE id = $2', [newAdmin.id, newAssoc.id]);

      // 4. Send notification to all Super Admins
      try {
        const superAdmins = await client.query("SELECT id FROM users WHERE role = 'super_admin'");
        for (const sa of superAdmins.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              sa.id,
              'New Association & Main Admin Pending Approval',
              `New layout "${newAssoc.name}" and Main Association Admin "${newAdmin.name}" have registered and require review.`,
              'info',
              '/super-admin/approvals'
            ]
          );
        }
      } catch (notifErr) {
        console.warn('Super admin notification error:', notifErr.message);
      }

      await client.query('COMMIT');

      // Audit logs
      await logAudit(
        newAdmin.id,
        'ASSOCIATION_REGISTER',
        'associations',
        newAssoc.id,
        { name: newAssoc.name, city: newAssoc.city, admin_id: newAdmin.id, designation: 'Main Association Admin', status: 'pending' },
        req.ip
      );

      res.status(201).json({
        success: true,
        message: 'Registration submitted successfully! Your application for the new association and Main Association Admin account is pending Super Administrator approval. You will be able to log in once approved by the Super Administrator.',
        data: {
          association: newAssoc,
          admin: newAdmin
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      next(err);
    } finally {
      client.release();
    }
  },

  /**
   * Login with email or phone + password
   */
  async login(req, res, next) {
    try {
      const { identifier, email, phone, password } = req.body;
      const loginId = (identifier || email || phone || '').trim();

      if (!loginId || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email or phone and password are required'
        });
      }

      // Find user by email or phone
      const userResult = await pool.query(
        `SELECT u.*, a.name as association_name, a.is_active as association_active
         FROM users u
         LEFT JOIN associations a ON u.association_id = a.id
         WHERE LOWER(u.email) = LOWER($1) OR u.phone = $1`,
        [loginId]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email/phone or password'
        });
      }

      const user = userResult.rows[0];

      // Check account approval status
      if (user.status === 'pending') {
        const pendingMsg = user.is_main_admin
          ? 'Your association and Main Association Admin registration is pending approval by the Super Administrator. You will be able to log in once approved.'
          : (user.role === 'admin'
            ? 'Your administrator registration is pending approval by the Main Association Admin. You will be able to log in once approved.'
            : 'Your resident registration is pending approval by the Main Association Admin. You will be able to log in once approved.');
        return res.status(403).json({
          success: false,
          message: pendingMsg
        });
      }

      if (user.status === 'rejected') {
        const rejectionMsg = user.rejection_reason
          ? `Account registration was rejected: ${user.rejection_reason}`
          : 'Account registration was rejected. Please contact support.';
        return res.status(403).json({
          success: false,
          message: rejectionMsg
        });
      }

      if (user.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Your account is currently inactive.'
        });
      }

      // Check if association is active (for non-super_admin)
      if (user.role !== 'super_admin' && user.association_id && user.association_active === false) {
        return res.status(403).json({
          success: false,
          message: 'Your association registration is awaiting activation by the Super Administrator.'
        });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email/phone or password'
        });
      }

      // Determine designation
      const userDesignation = user.is_main_admin
        ? 'Main Association Admin'
        : user.role === 'admin'
        ? 'Layout Admin'
        : user.role === 'super_admin'
        ? 'Super Admin'
        : 'Resident Member';

      // Generate Access Token (15m)
      const tokenPayload = {
        id: user.id,
        role: user.role,
        is_main_admin: Boolean(user.is_main_admin),
        designation: userDesignation,
        association_id: user.association_id,
        name: user.name,
        email: user.email,
        member_code: user.member_code
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

      // Generate Refresh Token (7 days)
      const refreshToken = crypto.randomBytes(40).toString('hex');
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [user.id, refreshToken, expiresAt]
      );

      // Set Refresh Token in HTTP-only Cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
      });

      // Audit log
      await logAudit(user.id, 'USER_LOGIN', 'users', user.id, { loginId }, req.ip);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: accessToken,
          refreshToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            is_main_admin: Boolean(user.is_main_admin),
            designation: userDesignation,
            association_id: user.association_id,
            association_name: user.association_name,
            member_code: user.member_code,
            door_no: user.door_no,
            street: user.street,
            layout_name: user.layout_name,
            taluk: user.taluk,
            district: user.district,
            state: user.state,
            eb_bill_proof: user.eb_bill_proof,
            property_tax_receipt: user.property_tax_receipt,
            profile_photo: user.profile_photo,
            status: user.status,
            language: user.language,
            created_at: user.created_at
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Refresh Access Token
   */
  async refreshToken(req, res, next) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Check DB for matching valid token
      const tokenQuery = `
        SELECT rt.*, u.id as user_id, u.name, u.email, u.role, u.is_main_admin, u.association_id, u.member_code, u.status
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = $1 AND rt.expires_at > NOW()
      `;
      const tokenResult = await pool.query(tokenQuery, [token]);

      if (tokenResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      const user = tokenResult.rows[0];

      if (user.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Account is no longer active'
        });
      }

      const userDesignation = user.is_main_admin
        ? 'Main Association Admin'
        : user.role === 'admin'
        ? 'Layout Admin'
        : user.role === 'super_admin'
        ? 'Super Admin'
        : 'Resident Member';

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          id: user.user_id,
          role: user.role,
          is_main_admin: Boolean(user.is_main_admin),
          designation: userDesignation,
          association_id: user.association_id,
          name: user.name,
          email: user.email,
          member_code: user.member_code
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      res.json({
        success: true,
        data: {
          token: newAccessToken
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Logout user, invalidate refresh token
   */
  async logout(req, res, next) {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;

      if (token) {
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
      }

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Request password reset token
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required'
        });
      }

      const userResult = await pool.query(
        'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1)',
        [email.trim()]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await pool.query(
          'UPDATE users SET reset_token = $1, reset_token_expires = $2, updated_at = NOW() WHERE id = $3',
          [resetToken, resetExpires, user.id]
        );

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

        try {
          if (emailService && typeof emailService.sendResetPasswordEmail === 'function') {
            await emailService.sendResetPasswordEmail(user.email, resetUrl);
          } else if (emailService && typeof emailService.sendEmail === 'function') {
            await emailService.sendEmail({
              to: user.email,
              subject: 'Password Reset Request',
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>Password Reset Request</h2>
                  <p>Hello ${user.name},</p>
                  <p>You requested a password reset for your Layout Association account.</p>
                  <p>Click the link below to set a new password (valid for 1 hour):</p>
                  <p><a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
                  <p>If you did not request this, please ignore this email.</p>
                  <hr/>
                  <p style="font-size: 12px; color: #6b7280;">Powered by JishnuInfotech</p>
                </div>
              `
            });
          }
        } catch (mailErr) {
          console.error('Failed to send reset email:', mailErr.message);
        }

        await logAudit(user.id, 'FORGOT_PASSWORD_REQUEST', 'users', user.id, { email: user.email }, req.ip);
      }

      // Generic response for security
      res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reset password with valid token
   */
  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Reset token and new password are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      const userResult = await pool.query(
        'SELECT id, email, name FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
        [token]
      );

      if (userResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Password reset token is invalid or has expired'
        });
      }

      const user = userResult.rows[0];
      const newHash = await bcrypt.hash(password, 12);

      await pool.query(
        'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = $2',
        [newHash, user.id]
      );

      // Invalidate existing refresh tokens
      await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [user.id]);

      await logAudit(user.id, 'PASSWORD_RESET_SUCCESS', 'users', user.id, { email: user.email }, req.ip);

      res.json({
        success: true,
        message: 'Password has been reset successfully. You may now log in.'
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;
