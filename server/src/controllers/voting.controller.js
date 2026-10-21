const pool = require('../config/db');
const { getIO } = require('../services/socket.service');
const exportUtils = require('../utils/exportUtils');
const ExcelJS = require('exceljs');

const votingController = {
  /**
   * Create poll
   * Admin or Super Admin
   */
  async createPoll(req, res, next) {
    try {
      const { role, association_id: userAssocId, id: userId } = req.user;
      const {
        title,
        description,
        start_date,
        end_date,
        is_anonymous = false,
        association_id,
        poll_type = 'vendor_selection',
        service_category,
        resolution_task_type,
        target_audience = 'all',
        target_street,
        target_user_ids = [],
        vendors = [],
        // Election specific fields
        election_type = 'all_roles',
        internal_officer_name,
        internal_officer_contact,
        external_officer_name,
        external_officer_contact,
        election_roles = [],
        candidates = []
      } = req.body;

      if (!title || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Title, start date, and end date are required'
        });
      }

      const targetAssocId = role === 'super_admin'
        ? (association_id || userAssocId)
        : userAssocId;

      if (!targetAssocId) {
        return res.status(400).json({
          success: false,
          message: 'Association ID is required'
        });
      }

      if (new Date(end_date) <= new Date(start_date)) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after start date'
        });
      }

      const insertQuery = `
        INSERT INTO polls (
          association_id, created_by, title, description,
          start_date, end_date, is_anonymous, status,
          poll_type, service_category, resolution_task_type,
          target_audience, target_street, target_user_ids,
          election_type, internal_officer_name, internal_officer_contact,
          external_officer_name, external_officer_contact, election_roles
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `;

      const values = [
        targetAssocId,
        userId,
        title.trim(),
        description ? description.trim() : null,
        new Date(start_date),
        new Date(end_date),
        Boolean(is_anonymous),
        poll_type,
        service_category ? service_category.trim() : null,
        resolution_task_type ? resolution_task_type.trim() : null,
        target_audience || 'all',
        target_street ? target_street.trim() : null,
        JSON.stringify(Array.isArray(target_user_ids) ? target_user_ids : []),
        poll_type === 'election' ? (election_type || 'all_roles') : null,
        poll_type === 'election' ? (internal_officer_name ? internal_officer_name.trim() : null) : null,
        poll_type === 'election' ? (internal_officer_contact ? internal_officer_contact.trim() : null) : null,
        poll_type === 'election' ? (external_officer_name ? external_officer_name.trim() : null) : null,
        poll_type === 'election' ? (external_officer_contact ? external_officer_contact.trim() : null) : null,
        poll_type === 'election' ? JSON.stringify(Array.isArray(election_roles) ? election_roles : []) : null
      ];

      const result = await pool.query(insertQuery, values);
      const poll = result.rows[0];

      // Auto-populate options based on poll_type
      if (poll_type === 'resolution_passing') {
        // Auto-create Yes / No options
        await pool.query(
          `INSERT INTO poll_vendors (poll_id, name, quotation, notes) VALUES 
           ($1, 'Yes (In Favor / Approve)', NULL, 'Approve proposed resolution'),
           ($1, 'No (Against / Reject)', NULL, 'Reject proposed resolution')`,
          [poll.id]
        );
      } else if (poll_type === 'election') {
        // Populate candidates for election
        const candidateList = Array.isArray(candidates) && candidates.length > 0 ? candidates : vendors;
        for (const c of candidateList) {
          if (c && c.name && c.name.trim()) {
            const roleName = (c.contesting_role || c.company || 'Executive Committee Member').trim();
            await pool.query(
              `INSERT INTO poll_vendors (poll_id, name, company, contesting_role, contact, notes)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                poll.id,
                c.name.trim(),
                roleName,
                roleName,
                c.contact ? c.contact.trim() : null,
                c.notes ? c.notes.trim() : null
              ]
            );
          }
        }
      } else if (Array.isArray(vendors) && vendors.length > 0) {
        for (const v of vendors) {
          if (v && v.name && v.name.trim()) {
            await pool.query(
              `INSERT INTO poll_vendors (poll_id, name, company, contact, quotation, notes)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                poll.id,
                v.name.trim(),
                v.company ? v.company.trim() : null,
                v.contact ? v.contact.trim() : null,
                v.quotation ? parseFloat(v.quotation) : null,
                v.notes ? v.notes.trim() : null
              ]
            );
          }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Poll created successfully',
        data: poll
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List polls for association
   */
  async listPolls(req, res, next) {
    try {
      const { role, association_id: userAssocId, id: userId } = req.user;
      const { status, association_id: queryAssocId } = req.query;

      const targetAssocId = role === 'super_admin'
        ? (queryAssocId || userAssocId)
        : userAssocId;

      let whereClause = '';
      const params = [userId];

      if (targetAssocId) {
        params.push(targetAssocId);
        whereClause = 'WHERE p.association_id = $2';
      }

      if (status) {
        params.push(status);
        whereClause += (whereClause ? ' AND ' : 'WHERE ') + `p.status = $${params.length}`;
      }

      const query = `
        SELECT p.*,
               u.name as creator_name,
               COUNT(DISTINCT v.id) as vendor_count,
               COUNT(DISTINCT vt.id) as total_votes,
               EXISTS(SELECT 1 FROM votes my_vote WHERE my_vote.poll_id = p.id AND my_vote.user_id = $1) as has_voted
        FROM polls p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN poll_vendors v ON v.poll_id = p.id
        LEFT JOIN votes vt ON vt.poll_id = p.id
        ${whereClause}
        GROUP BY p.id, u.name
        ORDER BY p.created_at DESC
      `;

      const result = await pool.query(query, params);

      // Check dynamic status for polls where end_date has passed
      const now = new Date();
      const updatedRows = result.rows.map(row => {
        const isExpired = new Date(row.end_date) < now;
        return {
          ...row,
          has_voted: Boolean(row.has_voted),
          vendor_count: parseInt(row.vendor_count, 10),
          total_votes: parseInt(row.total_votes, 10),
          computed_status: isExpired ? 'closed' : row.status
        };
      });

      res.json({
        success: true,
        data: updatedRows
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get single poll with vendors and results
   */
  async getPoll(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId, id: userId } = req.user;

      const pollRes = await pool.query(
        `SELECT p.*, u.name as creator_name, a.name as association_name
         FROM polls p
         LEFT JOIN users u ON p.created_by = u.id
         LEFT JOIN associations a ON p.association_id = a.id
         WHERE p.id = $1`,
        [pollId]
      );

      if (pollRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = pollRes.rows[0];

      if (role !== 'super_admin' && poll.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to this poll'
        });
      }

      // Check if logged-in user has voted and for which vendor(s)
      const userVoteRes = await pool.query(
        'SELECT vendor_id FROM votes WHERE poll_id = $1 AND user_id = $2',
        [pollId, userId]
      );
      const hasVoted = userVoteRes.rows.length > 0;
      const userVotedVendorId = hasVoted ? userVoteRes.rows[0].vendor_id : null;
      const userVotedVendorIds = userVoteRes.rows.map(r => r.vendor_id);

      // Get vendors with vote counts
      const vendorsRes = await pool.query(
        `SELECT v.*, COUNT(vt.id) as vote_count
         FROM poll_vendors v
         LEFT JOIN votes vt ON vt.vendor_id = v.id
         WHERE v.poll_id = $1
         GROUP BY v.id
         ORDER BY v.id ASC`,
        [pollId]
      );

      const totalVotesRes = await pool.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM votes WHERE poll_id = $1',
        [pollId]
      );
      const totalVotes = parseInt(totalVotesRes.rows[0].count, 10);

      const isClosed = poll.status === 'closed' || (poll.end_date && new Date(poll.end_date) < new Date());
      const isElection = poll.poll_type === 'election';
      const isMember = role === 'member';

      // Group candidates by role and determine winner(s) per role
      const roleGroups = {};
      vendorsRes.rows.forEach(v => {
        const roleName = (v.contesting_role || v.company || 'Executive Committee Member').trim();
        if (!roleGroups[roleName]) {
          roleGroups[roleName] = [];
        }
        roleGroups[roleName].push(v);
      });

      const roleWinners = {};
      for (const [rName, cands] of Object.entries(roleGroups)) {
        let maxRCount = -1;
        let rWinners = [];
        for (const c of cands) {
          const cnt = parseInt(c.vote_count, 10);
          if (cnt > maxRCount) {
            maxRCount = cnt;
            rWinners = [c.id];
          } else if (cnt === maxRCount && cnt > 0) {
            rWinners.push(c.id);
          }
        }
        roleWinners[rName] = maxRCount > 0 ? rWinners : [];
      }

      let maxVotes = 0;
      let winnerId = null;

      const vendorsWithStats = vendorsRes.rows.map(v => {
        const count = parseInt(v.vote_count, 10);
        const roleName = (v.contesting_role || v.company || 'Executive Committee Member').trim();
        const isWinner = isClosed && (roleWinners[roleName] || []).includes(v.id);

        if (count > maxVotes) {
          maxVotes = count;
          winnerId = v.id;
        }

        // Secret ballot enforcement: members do not see vote counts or percentages
        if (isElection && isMember) {
          return {
            ...v,
            quotation: v.quotation ? parseFloat(v.quotation) : null,
            vote_count: null,
            percentage: null,
            is_winner: isClosed ? isWinner : false
          };
        }

        const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return {
          ...v,
          quotation: v.quotation ? parseFloat(v.quotation) : null,
          vote_count: count,
          percentage,
          is_winner: isClosed ? isWinner : false
        };
      });

      // Role winners summary for election announcement
      const roleWinnersSummary = [];
      if (isElection && isClosed) {
        for (const [rName, winIds] of Object.entries(roleWinners)) {
          const winningCandidates = vendorsRes.rows.filter(v => winIds.includes(v.id));
          roleWinnersSummary.push({
            role: rName,
            winners: winningCandidates.map(w => ({
              id: w.id,
              name: w.name,
              contact: w.contact,
              notes: w.notes,
              vote_count: isMember ? null : parseInt(w.vote_count, 10)
            }))
          });
        }
      }

      // Calculate eligible voters
      let eligibleVotersCount = 0;
      let isUserEligible = true;
      let eligibilityReason = '';

      const voterUserRes = await pool.query('SELECT street, status FROM users WHERE id = $1', [userId]);
      const voterStreet = (voterUserRes.rows[0]?.street || '').trim().toLowerCase();
      const voterStatus = voterUserRes.rows[0]?.status;

      if (voterStatus !== 'approved' && role !== 'super_admin') {
        isUserEligible = false;
        eligibilityReason = 'Only approved residents can participate in polling';
      }

      if (poll.target_audience === 'street' && poll.target_street) {
        const ecRes = await pool.query(
          `SELECT COUNT(*) FROM users WHERE association_id = $1 AND status = 'approved' AND role = 'member' AND LOWER(TRIM(street)) = LOWER(TRIM($2))`,
          [poll.association_id, poll.target_street]
        );
        eligibleVotersCount = parseInt(ecRes.rows[0]?.count || 0, 10);
        if (voterStreet !== poll.target_street.trim().toLowerCase() && role !== 'super_admin') {
          isUserEligible = false;
          eligibilityReason = `Voting restricted to residents of ${poll.target_street}`;
        }
      } else if (poll.target_audience === 'selected') {
        let allowedIds = [];
        try {
          allowedIds = typeof poll.target_user_ids === 'string' ? JSON.parse(poll.target_user_ids) : (poll.target_user_ids || []);
        } catch (e) { allowedIds = []; }
        if (allowedIds.length > 0) {
          eligibleVotersCount = allowedIds.length;
          if (!allowedIds.map(Number).includes(Number(userId)) && role !== 'super_admin') {
            isUserEligible = false;
            eligibilityReason = 'Restricted to designated member group';
          }
        } else {
          const ecRes = await pool.query(
            `SELECT COUNT(*) FROM users WHERE association_id = $1 AND status = 'approved' AND role = 'member'`,
            [poll.association_id]
          );
          eligibleVotersCount = parseInt(ecRes.rows[0]?.count || 0, 10);
        }
      } else {
        const ecRes = await pool.query(
          `SELECT COUNT(*) FROM users WHERE association_id = $1 AND status = 'approved' AND role = 'member'`,
          [poll.association_id]
        );
        eligibleVotersCount = parseInt(ecRes.rows[0]?.count || 0, 10);
      }

      res.json({
        success: true,
        data: {
          ...poll,
          status: isClosed ? 'closed' : poll.status,
          has_voted: hasVoted,
          user_voted_vendor_id: userVotedVendorId,
          user_voted_vendor_ids: userVotedVendorIds,
          total_votes: (isElection && isMember && !isClosed) ? null : totalVotes,
          eligible_voters_count: eligibleVotersCount,
          turnout_percentage: (isElection && isMember && !isClosed) ? null : (eligibleVotersCount > 0 ? Math.min(100, Math.round((totalVotes / eligibleVotersCount) * 100)) : 0),
          is_user_eligible: isUserEligible,
          eligibility_reason: eligibilityReason,
          winner_vendor_id: isClosed && totalVotes > 0 ? winnerId : null,
          role_winners: roleWinners,
          role_winners_summary: roleWinnersSummary,
          vendors: vendorsWithStats
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update poll (only if not closed and no votes cast)
   */
  async updatePoll(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;
      const { title, description, start_date, end_date, is_anonymous, status } = req.body;

      const check = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = check.rows[0];

      if (role !== 'super_admin' && poll.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      // Check if votes exist
      const votesCheck = await pool.query('SELECT COUNT(*) FROM votes WHERE poll_id = $1', [pollId]);
      const voteCount = parseInt(votesCheck.rows[0].count, 10);

      if (voteCount > 0 && (title || start_date || is_anonymous !== undefined)) {
        return res.status(400).json({
          success: false,
          message: 'Cannot modify core poll details once votes have been cast'
        });
      }

      const updateQuery = `
        UPDATE polls
        SET title = COALESCE($1, title),
            description = COALESCE($2, description),
            start_date = COALESCE($3, start_date),
            end_date = COALESCE($4, end_date),
            is_anonymous = COALESCE($5, is_anonymous),
            status = COALESCE($6, status)
        WHERE id = $7
        RETURNING *
      `;

      const values = [
        title ? title.trim() : null,
        description !== undefined ? (description ? description.trim() : null) : null,
        start_date ? new Date(start_date) : null,
        end_date ? new Date(end_date) : null,
        is_anonymous !== undefined ? Boolean(is_anonymous) : null,
        status || null,
        pollId
      ];

      const result = await pool.query(updateQuery, values);

      res.json({
        success: true,
        message: 'Poll updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete poll (only if no votes recorded)
   */
  async deletePoll(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = check.rows[0];

      if (role !== 'super_admin' && poll.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const votesCheck = await pool.query('SELECT COUNT(*) FROM votes WHERE poll_id = $1', [pollId]);
      if (parseInt(votesCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete poll because votes have already been recorded'
        });
      }

      await pool.query('DELETE FROM polls WHERE id = $1', [pollId]);

      res.json({
        success: true,
        message: 'Poll deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add vendor option to poll
   */
  async addVendor(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;
      const { name, company, contact, quotation, notes } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Vendor name is required'
        });
      }

      const pollCheck = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (pollCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = pollCheck.rows[0];

      if (role !== 'super_admin' && poll.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const document = req.file ? req.file.path.replace(/\\/g, '/') : null;

      const insertQuery = `
        INSERT INTO poll_vendors (poll_id, name, company, contact, quotation, notes, document)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        pollId,
        name.trim(),
        company ? company.trim() : null,
        contact ? contact.trim() : null,
        quotation ? parseFloat(quotation) : null,
        notes ? notes.trim() : null,
        document
      ];

      const result = await pool.query(insertQuery, values);

      res.status(201).json({
        success: true,
        message: 'Vendor added to poll successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update vendor option
   */
  async updateVendor(req, res, next) {
    try {
      const vendorId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;
      const { name, company, contact, quotation, notes } = req.body;

      const check = await pool.query(
        `SELECT v.*, p.association_id
         FROM poll_vendors v
         JOIN polls p ON v.poll_id = p.id
         WHERE v.id = $1`,
        [vendorId]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      const vendor = check.rows[0];

      if (role !== 'super_admin' && vendor.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const document = req.file ? req.file.path.replace(/\\/g, '/') : vendor.document;

      const updateQuery = `
        UPDATE poll_vendors
        SET name = COALESCE($1, name),
            company = COALESCE($2, company),
            contact = COALESCE($3, contact),
            quotation = COALESCE($4, quotation),
            notes = COALESCE($5, notes),
            document = $6
        WHERE id = $7
        RETURNING *
      `;

      const values = [
        name ? name.trim() : null,
        company ? company.trim() : null,
        contact ? contact.trim() : null,
        quotation ? parseFloat(quotation) : null,
        notes ? notes.trim() : null,
        document,
        vendorId
      ];

      const result = await pool.query(updateQuery, values);

      res.json({
        success: true,
        message: 'Vendor updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete vendor option (only if no votes cast for this vendor)
   */
  async deleteVendor(req, res, next) {
    try {
      const vendorId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query(
        `SELECT v.*, p.association_id
         FROM poll_vendors v
         JOIN polls p ON v.poll_id = p.id
         WHERE v.id = $1`,
        [vendorId]
      );

      if (check.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      const vendor = check.rows[0];

      if (role !== 'super_admin' && vendor.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const votesCheck = await pool.query('SELECT COUNT(*) FROM votes WHERE vendor_id = $1', [vendorId]);
      if (parseInt(votesCheck.rows[0].count, 10) > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete vendor with recorded votes'
        });
      }

      await pool.query('DELETE FROM poll_vendors WHERE id = $1', [vendorId]);

      res.json({
        success: true,
        message: 'Vendor deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Cast a vote in a poll
   * Member only (must be approved member of the association)
   */
  async castVote(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { vendor_id, candidate_ids } = req.body;

      // Check poll exists
      const pollRes = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (pollRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = pollRes.rows[0];

      // Handle candidate IDs or vendor_id
      const chosenCandidateIds = Array.isArray(candidate_ids) && candidate_ids.length > 0
        ? candidate_ids.map(Number).filter(Boolean)
        : (vendor_id ? [Number(vendor_id)] : []);

      if (chosenCandidateIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: poll.poll_type === 'election' ? 'Please select at least one candidate' : 'Vendor selection is required to cast vote'
        });
      }

      // Check association match
      if (req.user.role !== 'super_admin' && poll.association_id !== req.user.association_id) {
        return res.status(403).json({
          success: false,
          message: 'You can only vote in polls within your association'
        });
      }

      // Check user approval status & street/selection eligibility
      const userRes = await pool.query('SELECT status, street FROM users WHERE id = $1', [userId]);
      const voter = userRes.rows[0];
      if (voter?.status !== 'approved' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only approved members can vote'
        });
      }

      if (poll.target_audience === 'street' && poll.target_street && req.user.role !== 'super_admin') {
        const voterStreet = (voter?.street || '').trim().toLowerCase();
        if (voterStreet !== poll.target_street.trim().toLowerCase()) {
          return res.status(403).json({
            success: false,
            message: `Voting in this resolution is restricted to residents of ${poll.target_street}`
          });
        }
      }

      if (poll.target_audience === 'selected' && req.user.role !== 'super_admin') {
        let allowedIds = [];
        try {
          allowedIds = typeof poll.target_user_ids === 'string' ? JSON.parse(poll.target_user_ids) : (poll.target_user_ids || []);
        } catch (e) { allowedIds = []; }
        if (allowedIds.length > 0 && !allowedIds.map(Number).includes(Number(userId))) {
          return res.status(403).json({
            success: false,
            message: 'You are not in the designated voter list for this poll'
          });
        }
      }

      // Check poll status and end date
      const now = new Date();
      if (poll.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Voting is not currently active for this poll'
        });
      }
      if (poll.end_date && now > new Date(poll.end_date)) {
        return res.status(400).json({
          success: false,
          message: 'Voting deadline has passed for this poll'
        });
      }

      // Verify candidates belong to this poll
      const candCheck = await pool.query(
        'SELECT id, contesting_role FROM poll_vendors WHERE poll_id = $1 AND id = ANY($2)',
        [pollId, chosenCandidateIds]
      );
      if (candCheck.rows.length !== chosenCandidateIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected candidates do not belong to this poll'
        });
      }

      // If election, enforce 1 candidate per contesting role
      if (poll.poll_type === 'election') {
        const rolesVoted = candCheck.rows.map(c => (c.contesting_role || 'Executive Committee Member').trim());
        const uniqueRoles = new Set(rolesVoted);
        if (uniqueRoles.size !== rolesVoted.length) {
          return res.status(400).json({
            success: false,
            message: 'You can only vote for one candidate per role'
          });
        }
      }

      // Check for duplicate vote (user already voted in this poll)
      const voteCheck = await pool.query(
        'SELECT id FROM votes WHERE poll_id = $1 AND user_id = $2',
        [pollId, userId]
      );
      if (voteCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: poll.poll_type === 'election' 
            ? 'You have already submitted your election ballot' 
            : 'You have already cast your vote in this poll'
        });
      }

      // Insert vote(s)
      for (const cid of chosenCandidateIds) {
        await pool.query(
          'INSERT INTO votes (poll_id, user_id, vendor_id) VALUES ($1, $2, $3)',
          [pollId, userId, cid]
        );
      }

      // Fetch updated results
      const vendorsRes = await pool.query(
        `SELECT v.id, v.name, COUNT(vt.id) as vote_count
         FROM poll_vendors v
         LEFT JOIN votes vt ON vt.vendor_id = v.id
         WHERE v.poll_id = $1
         GROUP BY v.id`,
        [pollId]
      );

      const totalVotesRes = await pool.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM votes WHERE poll_id = $1',
        [pollId]
      );
      const totalVotes = parseInt(totalVotesRes.rows[0].count, 10);

      // Check total eligible members for auto-ending
      let eligibleCount = 0;
      if (poll.target_audience === 'street' && poll.target_street) {
        const ecRes = await pool.query(
          `SELECT COUNT(*) FROM users WHERE association_id = $1 AND status = 'approved' AND role = 'member' AND LOWER(TRIM(street)) = LOWER(TRIM($2))`,
          [poll.association_id, poll.target_street]
        );
        eligibleCount = parseInt(ecRes.rows[0]?.count || 0, 10);
      } else if (poll.target_audience === 'selected') {
        let allowedIds = [];
        try {
          allowedIds = typeof poll.target_user_ids === 'string' ? JSON.parse(poll.target_user_ids) : (poll.target_user_ids || []);
        } catch (e) { allowedIds = []; }
        eligibleCount = allowedIds.length > 0 ? allowedIds.length : 0;
      } else {
        const ecRes = await pool.query(
          `SELECT COUNT(*) FROM users WHERE association_id = $1 AND status = 'approved' AND role = 'member'`,
          [poll.association_id]
        );
        eligibleCount = parseInt(ecRes.rows[0]?.count || 0, 10);
      }

      let pollEndedAuto = false;
      // Only auto-conclude if there is a substantial electorate (>= 3) and all have voted
      if (eligibleCount >= 3 && totalVotes >= eligibleCount) {
        await pool.query("UPDATE polls SET status = 'closed', end_date = NOW() WHERE id = $1", [pollId]);
        pollEndedAuto = true;
      }

      const isElection = poll.poll_type === 'election';
      const updatedResults = {
        poll_id: pollId,
        total_votes: isElection ? null : totalVotes,
        eligible_voters_count: eligibleCount,
        status: pollEndedAuto ? 'closed' : poll.status,
        auto_ended: pollEndedAuto,
        vendors: isElection ? [] : vendorsRes.rows.map(v => {
          const count = parseInt(v.vote_count, 10);
          return {
            id: v.id,
            name: v.name,
            vote_count: count,
            percentage: totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
          };
        })
      };

      // Emit socket events
      try {
        const io = typeof getIO === 'function' ? getIO() : null;
        if (io) {
          io.to(`poll_${pollId}`).emit('vote:cast', { poll_id: pollId, candidate_ids: chosenCandidateIds });
          io.to(`poll_${pollId}`).emit('vote:results', updatedResults);
          io.to(`association_${poll.association_id}`).emit('vote:results', updatedResults);
          if (pollEndedAuto) {
            io.to(`poll_${pollId}`).emit('poll:ended', { poll_id: pollId, auto_ended: true });
            io.to(`association_${poll.association_id}`).emit('poll:ended', { poll_id: pollId, auto_ended: true });
          }
        }
      } catch (err) {
        console.error('Socket emission error for vote:cast:', err.message);
      }

      res.status(201).json({
        success: true,
        message: 'Vote cast successfully',
        data: {
          ...updatedResults,
          user_voted_vendor_ids: chosenCandidateIds
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get poll results
   */
  async getResults(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const pollRes = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (pollRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = pollRes.rows[0];

      if (role !== 'super_admin' && poll.association_id !== userAssocId) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized'
        });
      }

      const vendorsRes = await pool.query(
        `SELECT v.id, v.name, v.company, v.contesting_role, v.quotation, v.contact, v.notes, COUNT(vt.id) as vote_count
         FROM poll_vendors v
         LEFT JOIN votes vt ON vt.vendor_id = v.id
         WHERE v.poll_id = $1
         GROUP BY v.id
         ORDER BY vote_count DESC`,
        [pollId]
      );

      const totalVotesRes = await pool.query('SELECT COUNT(*) FROM votes WHERE poll_id = $1', [pollId]);
      const totalVotes = parseInt(totalVotesRes.rows[0].count, 10);

      const isElection = poll.poll_type === 'election';

      // Calculate totals per role for elections
      const roleTotals = {};
      const roleWinners = {};

      if (isElection) {
        vendorsRes.rows.forEach((v) => {
          const rName = (v.contesting_role || v.company || 'Executive Committee Member').trim();
          const count = parseInt(v.vote_count, 10);
          roleTotals[rName] = (roleTotals[rName] || 0) + count;
        });

        // Group by role to pick top candidate per role
        const roleCandidates = {};
        vendorsRes.rows.forEach((v) => {
          const rName = (v.contesting_role || v.company || 'Executive Committee Member').trim();
          if (!roleCandidates[rName]) roleCandidates[rName] = [];
          roleCandidates[rName].push(v);
        });

        Object.entries(roleCandidates).forEach(([rName, cands]) => {
          cands.sort((a, b) => parseInt(b.vote_count, 10) - parseInt(a.vote_count, 10));
          const topCand = cands[0];
          if (topCand && parseInt(topCand.vote_count, 10) > 0) {
            roleWinners[rName] = {
              id: topCand.id,
              name: topCand.name,
              role: rName,
              vote_count: parseInt(topCand.vote_count, 10),
              contact: topCand.contact,
              notes: topCand.notes,
            };
          }
        });
      }

      let winner = null;
      if (!isElection && vendorsRes.rows.length > 0 && totalVotes > 0) {
        winner = vendorsRes.rows[0];
      }

      const results = vendorsRes.rows.map((v) => {
        const count = parseInt(v.vote_count, 10);
        const rName = (v.contesting_role || v.company || 'Executive Committee Member').trim();
        let pct = 0;
        if (isElection) {
          const roleTotal = roleTotals[rName] || 0;
          pct = roleTotal > 0 ? Math.round((count / roleTotal) * 100) : 0;
        } else {
          pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        }

        return {
          ...v,
          contesting_role: rName,
          quotation: v.quotation ? parseFloat(v.quotation) : null,
          vote_count: count,
          percentage: pct,
          is_role_winner: Boolean(roleWinners[rName] && roleWinners[rName].id === v.id),
        };
      });

      res.json({
        success: true,
        data: {
          poll,
          total_votes: totalVotes,
          winner: winner
            ? { id: winner.id, name: winner.name, quotation: winner.quotation, company: winner.company }
            : null,
          role_winners: roleWinners,
          vendors: results,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export poll voting results to Excel
   */
  async exportResults(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const pollRes = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);

      if (pollRes.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      const poll = pollRes.rows[0];

      const vendorsRes = await pool.query(
        `SELECT v.name, v.company, v.quotation, v.contact, COUNT(vt.id) as vote_count
         FROM poll_vendors v
         LEFT JOIN votes vt ON vt.vendor_id = v.id
         WHERE v.poll_id = $1
         GROUP BY v.id
         ORDER BY vote_count DESC`,
        [pollId]
      );

      const totalVotesRes = await pool.query('SELECT COUNT(*) FROM votes WHERE poll_id = $1', [pollId]);
      const totalVotes = parseInt(totalVotesRes.rows[0].count, 10);

      const columns = [
        { header: 'Vendor Name', key: 'name', width: 25 },
        { header: 'Company', key: 'company', width: 25 },
        { header: 'Contact', key: 'contact', width: 20 },
        { header: 'Quotation (INR)', key: 'quotation', width: 20 },
        { header: 'Votes Received', key: 'vote_count', width: 15 },
        { header: 'Vote Percentage', key: 'percentage', width: 18 }
      ];

      const data = vendorsRes.rows.map(v => {
        const count = parseInt(v.vote_count, 10);
        return {
          name: v.name,
          company: v.company || 'N/A',
          contact: v.contact || 'N/A',
          quotation: v.quotation ? `₹${parseFloat(v.quotation).toLocaleString()}` : 'N/A',
          vote_count: count,
          percentage: `${totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0}%`
        };
      });

      if (exportUtils && typeof exportUtils.exportToExcel === 'function') {
        const buffer = await exportUtils.exportToExcel(columns, data, `Poll-${pollId}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="poll-${pollId}-results.xlsx"`);
        return res.send(buffer);
      }

      // Built-in ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Poll Results');

      worksheet.mergeCells('A1:F1');
      worksheet.getCell('A1').value = `Poll Results: ${poll.title} (Total Votes: ${totalVotes})`;
      worksheet.getCell('A1').font = { size: 14, bold: true };

      worksheet.getRow(3).values = columns.map(c => c.header);
      worksheet.getRow(3).font = { bold: true };
      worksheet.columns = columns;

      data.forEach(row => worksheet.addRow(row));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="poll-${pollId}-results.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      next(error);
    }
  },

  /**
   * End poll immediately by Admin choice
   */
  async endPollNow(req, res, next) {
    try {
      const pollId = parseInt(req.params.id, 10);
      const { role, association_id: userAssocId } = req.user;

      const check = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
      if (check.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Poll not found' });
      }

      const poll = check.rows[0];
      if (role !== 'super_admin' && poll.association_id !== userAssocId) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const updateRes = await pool.query(
        "UPDATE polls SET status = 'closed', end_date = NOW() WHERE id = $1 RETURNING *",
        [pollId]
      );

      try {
        const io = typeof getIO === 'function' ? getIO() : null;
        if (io) {
          io.to(`poll_${pollId}`).emit('poll:ended', { poll_id: pollId, manual: true });
          io.to(`association_${poll.association_id}`).emit('poll:ended', { poll_id: pollId, manual: true });
        }
      } catch (err) {
        console.error('Socket error on endPollNow:', err.message);
      }

      res.json({
        success: true,
        message: 'Poll ended immediately by admin choice. Results are finalized.',
        data: updateRes.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = votingController;
