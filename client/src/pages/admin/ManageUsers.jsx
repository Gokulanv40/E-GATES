import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiUsers,
  HiUserPlus,
  HiShieldCheck,
  HiTrash,
  HiEye,
  HiArrowPath,
  HiMagnifyingGlass,
  HiFunnel,
  HiDocumentText,
  HiArrowTopRightOnSquare,
  HiCheckCircle,
  HiXCircle,
  HiKey,
  HiBuildingOffice2,
} from 'react-icons/hi2';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function AdminManageUsers() {
  const { user: currentUser, updateUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Change Role Modal State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleTargetUser, setRoleTargetUser] = useState(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [targetNewRole, setTargetNewRole] = useState('admin');
  const [previousAdminRole, setPreviousAdminRole] = useState('admin');
  const [newMainAdminId, setNewMainAdminId] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Add Admin Modal State
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    door_no: '',
    street: '',
  });
  const [adminEbProof, setAdminEbProof] = useState(null);
  const [adminTaxProof, setAdminTaxProof] = useState(null);

  // Add Member Modal State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isSubmittingMember, setIsSubmittingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    door_no: '',
    street: '',
  });
  const [memberEbProof, setMemberEbProof] = useState(null);
  const [memberTaxProof, setMemberTaxProof] = useState(null);

  // Detail Modal State
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Delete User State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper to resolve static file paths to backend URL
  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/api\/v1\/?$/, '');
    const normalized = filePath.replace(/\\/g, '/');
    const uploadIndex = normalized.indexOf('/uploads/');
    if (uploadIndex !== -1) {
      return `${base}${normalized.substring(uploadIndex)}`;
    }
    if (normalized.startsWith('uploads/')) {
      return `${base}/${normalized}`;
    }
    return `${base}/${normalized.replace(/^\/?/, '')}`;
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data?.data || []);
    } catch (err) {
      console.warn('Failed to load users:', err);
      toast.error(err.response?.data?.message || 'Failed to load association users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter === 'main_admin') {
        if (!u.is_main_admin && u.display_role !== 'Main Association Admin') return false;
      } else if (roleFilter === 'admin') {
        if (u.role !== 'admin' || u.is_main_admin || u.display_role === 'Main Association Admin') return false;
      } else if (roleFilter === 'member') {
        if (u.role !== 'member') return false;
      }

      // Status filter
      if (statusFilter !== 'all' && u.status !== statusFilter) {
        return false;
      }

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match =
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.includes(q) ||
          u.member_code?.includes(q) ||
          u.door_no?.toLowerCase().includes(q) ||
          u.street?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, searchTerm]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const mainAdmins = users.filter((u) => u.is_main_admin || u.display_role === 'Main Association Admin').length;
    const layoutAdmins = users.filter((u) => u.role === 'admin' && !u.is_main_admin && u.display_role !== 'Main Association Admin').length;
    const members = users.filter((u) => u.role === 'member').length;
    const pending = users.filter((u) => u.status === 'pending').length;
    return { total, mainAdmins, layoutAdmins, members, pending };
  }, [users]);

  // Handle Add Admin Submit
  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminForm.name.trim() || !adminForm.email.trim() || !adminForm.password) {
      toast.error('Name, email, and password are required');
      return;
    }

    try {
      setIsSubmittingAdmin(true);
      const data = new FormData();
      data.append('name', adminForm.name.trim());
      data.append('email', adminForm.email.trim().toLowerCase());
      data.append('phone', adminForm.phone.trim());
      data.append('password', adminForm.password);
      if (adminForm.door_no) data.append('door_no', adminForm.door_no.trim());
      if (adminForm.street) data.append('street', adminForm.street.trim());
      if (adminEbProof instanceof File) data.append('eb_bill_proof', adminEbProof);
      if (adminTaxProof instanceof File) data.append('property_tax_receipt', adminTaxProof);

      const res = await api.post('/users/create-admin', data);
      toast.success(res.data?.message || 'Layout Admin created successfully!');
      setIsAdminModalOpen(false);
      setAdminForm({ name: '', email: '', phone: '', password: '', door_no: '', street: '' });
      setAdminEbProof(null);
      setAdminTaxProof(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create administrator');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  // Handle Add Member Submit
  const handleAddMemberSubmit = async (e) => {
    e.preventDefault();
    if (!memberForm.name.trim() || !memberForm.email.trim() || !memberForm.password) {
      toast.error('Name, email, and password are required');
      return;
    }

    try {
      setIsSubmittingMember(true);
      const data = new FormData();
      data.append('name', memberForm.name.trim());
      data.append('email', memberForm.email.trim().toLowerCase());
      data.append('phone', memberForm.phone.trim());
      data.append('password', memberForm.password);
      if (memberForm.door_no) data.append('door_no', memberForm.door_no.trim());
      if (memberForm.street) data.append('street', memberForm.street.trim());
      if (memberEbProof instanceof File) data.append('eb_bill_proof', memberEbProof);
      if (memberTaxProof instanceof File) data.append('property_tax_receipt', memberTaxProof);

      const res = await api.post('/users/create-member', data);
      toast.success(res.data?.message || 'Resident Member added successfully!');
      setIsMemberModalOpen(false);
      setMemberForm({ name: '', email: '', phone: '', password: '', door_no: '', street: '' });
      setMemberEbProof(null);
      setMemberTaxProof(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setIsSubmittingMember(false);
    }
  };

  // Handle Delete User Confirm
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success(`User "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper & Permissions for Role Change
  const currentMainAdmin = useMemo(() => {
    return users.find((u) => u.is_main_admin || u.display_role === 'Main Association Admin');
  }, [users]);

  const canManageRoles = currentUser?.role === 'super_admin' || currentUser?.is_main_admin;

  const handleOpenRoleModal = (u = null) => {
    setRoleTargetUser(u);
    setModalSearchTerm('');
    if (u) {
      const current = u.is_main_admin ? 'main_admin' : u.role === 'admin' ? 'admin' : 'member';
      setTargetNewRole(current);
    } else {
      setTargetNewRole('admin');
    }
    setPreviousAdminRole('admin');

    const otherApproved = users.filter((x) => (!u || x.id !== u.id) && x.status === 'approved');
    const defaultSuccessor = otherApproved.find((x) => x.role === 'admin') || otherApproved[0];
    setNewMainAdminId(defaultSuccessor ? String(defaultSuccessor.id) : '');

    setIsRoleModalOpen(true);
  };

  const handleSelectRoleTarget = (u) => {
    setRoleTargetUser(u);
    const current = u.is_main_admin ? 'main_admin' : u.role === 'admin' ? 'admin' : 'member';
    setTargetNewRole(current);
    setPreviousAdminRole('admin');

    const otherApproved = users.filter((x) => x.id !== u.id && x.status === 'approved');
    const defaultSuccessor = otherApproved.find((x) => x.role === 'admin') || otherApproved[0];
    setNewMainAdminId(defaultSuccessor ? String(defaultSuccessor.id) : '');
  };

  const handleSaveRoleChange = async (e) => {
    e.preventDefault();
    if (!roleTargetUser) {
      toast.error('Please select a user to change role');
      return;
    }

    const currentRole = roleTargetUser.is_main_admin ? 'main_admin' : roleTargetUser.role === 'admin' ? 'admin' : 'member';
    if (targetNewRole === currentRole) {
      toast.error("The selected role is already the user's current role");
      return;
    }

    try {
      setIsSubmittingRole(true);
      const payload = {
        new_role: targetNewRole,
      };

      if (targetNewRole === 'main_admin') {
        payload.previous_admin_role = previousAdminRole;
      }

      if (roleTargetUser.is_main_admin && targetNewRole !== 'main_admin') {
        if (!newMainAdminId) {
          toast.error('Please select an approved user to take over as Main Association Admin');
          setIsSubmittingRole(false);
          return;
        }
        payload.new_main_admin_id = parseInt(newMainAdminId, 10);
      }

      const res = await api.put(`/users/${roleTargetUser.id}/change-role`, payload);
      toast.success(res.data?.message || 'User role successfully updated');
      setIsRoleModalOpen(false);
      setRoleTargetUser(null);
      await fetchUsers();

      if (currentUser?.id === roleTargetUser.id) {
        if (typeof updateUser === 'function') {
          updateUser(res.data?.data);
        }
      }
    } catch (err) {
      console.error('Failed to change role:', err);
      toast.error(err.response?.data?.message || 'Failed to update user role');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Filtered users for role modal search
  const modalFilteredUsers = useMemo(() => {
    if (!modalSearchTerm.trim()) return users;
    const q = modalSearchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q) ||
        u.member_code?.includes(q) ||
        u.door_no?.toLowerCase().includes(q) ||
        u.street?.toLowerCase().includes(q)
    );
  }, [users, modalSearchTerm]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiUsers className="w-7 h-7 text-primary-600" />
            Manage Association Users
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete directory of administrators and resident members. Add new admins or members manually.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchUsers}
            title="Refresh user directory"
            className="p-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition shadow-sm"
          >
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>

          {canManageRoles && (
            <>
              {/* Change Roles & Main Admin Master Button */}
              <button
                type="button"
                onClick={() => handleOpenRoleModal(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                title="Change user roles or designate new Main Association Admin"
              >
                <HiShieldCheck className="w-4 h-4" />
                <span>⇄ Change Roles & Main Admin</span>
              </button>

              {/* Add Admin Button */}
              <button
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <HiShieldCheck className="w-4 h-4" />
                <span>+ Add Admin</span>
              </button>

              {/* Add Member Button */}
              <button
                type="button"
                onClick={() => setIsMemberModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <HiUserPlus className="w-4 h-4" />
                <span>+ Add Member</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            👥
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total Users</span>
            <span className="text-xl font-black text-gray-900">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-lg">
            🛡️
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Admins</span>
            <span className="text-xl font-black text-gray-900">{stats.mainAdmins + stats.layoutAdmins}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            🏡
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Residents</span>
            <span className="text-xl font-black text-gray-900">{stats.members}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            ⏳
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Pending</span>
            <span className="text-xl font-black text-amber-700">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <HiMagnifyingGlass className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, door, phone, code..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <HiFunnel className="w-4 h-4 text-gray-400" />
            <span>Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Roles</option>
              <option value="main_admin">Main Association Admin</option>
              <option value="admin">Layout Admins</option>
              <option value="member">Resident Members</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              {loading ? 'Loading users directory...' : 'No users match your criteria.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/80 text-gray-600 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4">User & Code</th>
                  <th className="py-3.5 px-4 text-center">Role / Designation</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Door & Street</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => {
                  const isMainAdmin = u.is_main_admin || u.display_role === 'Main Association Admin';
                  const isLayoutAdmin = u.role === 'admin' && !isMainAdmin;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition group">
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs text-white flex-shrink-0 ${
                              isMainAdmin
                                ? 'bg-purple-600'
                                : isLayoutAdmin
                                ? 'bg-indigo-600'
                                : 'bg-primary-600'
                            }`}
                          >
                            {u.profile_photo ? (
                              <img
                                src={resolveFileUrl(u.profile_photo)}
                                alt={u.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              u.name?.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-primary-600 transition">
                              {u.name}
                            </p>
                            <span className="font-mono text-[10px] text-gray-500">
                              #{u.member_code || 'PENDING'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {isMainAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-xs">
                            <span>🛡️</span>
                            <span>Main Association Admin</span>
                          </span>
                        ) : isLayoutAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            <span>🛡️</span>
                            <span>Layout Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <span>👥</span>
                            <span>Resident Member</span>
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-gray-600 font-mono">
                        <p className="text-gray-900 font-semibold">{u.phone || '—'}</p>
                        <p className="text-[11px] text-gray-500 font-sans">{u.email || '—'}</p>
                      </td>

                      {/* Door & Street */}
                      <td className="py-3.5 px-4 text-gray-700">
                        <p className="font-semibold text-gray-900">
                          {u.door_no ? `Door #${u.door_no}` : '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate max-w-xs">{u.street || '—'}</p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : u.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setIsDetailModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
                            title="View Full Profile Details"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                          {/* Change Role Button */}
                          {canManageRoles && (
                            <button
                              type="button"
                              onClick={() => handleOpenRoleModal(u)}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-semibold rounded-lg transition"
                              title="Change Role & Designation"
                            >
                              <HiShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                              <span>Change Role</span>
                            </button>
                          )}

                          {/* Delete allowed for Main Admin (cannot delete Main Admin themselves) */}
                          {currentUser?.is_main_admin && !isMainAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(u)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                              title="Delete user"
                            >
                              <HiTrash className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: ADD ADMIN MANUALLY
         ========================================================================= */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title="Add Layout Administrator"
        size="md"
      >
        <form onSubmit={handleAddAdminSubmit} className="space-y-4">
          <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-800">
            <strong>Administrator Registration:</strong> This user will be immediately approved and granted layout admin privileges over this community.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Administrator Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. R. Subramanian"
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="subbu@example.com"
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mobile Phone *
              </label>
              <input
                type="tel"
                required
                placeholder="9876543210"
                value={adminForm.phone}
                onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Account Login Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Door / Plot No (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 12-B"
                value={adminForm.door_no}
                onChange={(e) => setAdminForm({ ...adminForm, door_no: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Street / Cross (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 2nd Cross"
                value={adminForm.street}
                onChange={(e) => setAdminForm({ ...adminForm, street: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                EB Bill Proof (Optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAdminEbProof(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Property Tax Proof (Optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setAdminTaxProof(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAdmin}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isSubmittingAdmin ? 'Creating Admin...' : 'Create & Approve Admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: ADD RESIDENT MEMBER MANUALLY
         ========================================================================= */}
      <Modal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title="Add Resident Member"
        size="md"
      >
        <form onSubmit={handleAddMemberSubmit} className="space-y-4">
          <div className="p-3 bg-primary-50/70 rounded-xl border border-primary-100 text-xs text-primary-800">
            <strong>Resident Member Registration:</strong> This resident will be immediately approved and assigned a unique member code for portal access.
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Resident Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. S. Meenakshi"
              value={memberForm.name}
              onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="meena@example.com"
                value={memberForm.email}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mobile Phone *
              </label>
              <input
                type="tel"
                required
                placeholder="9876543210"
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Account Login Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Minimum 6 characters"
              value={memberForm.password}
              onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Door / Plot / Flat No *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 402 or Plot 18"
                value={memberForm.door_no}
                onChange={(e) => setMemberForm({ ...memberForm, door_no: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Street / Cross (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Main Road"
                value={memberForm.street}
                onChange={(e) => setMemberForm({ ...memberForm, street: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                EB Bill Proof (Optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setMemberEbProof(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Property Tax Proof (Optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setMemberTaxProof(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsMemberModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingMember}
              className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isSubmittingMember ? 'Adding Member...' : 'Add & Approve Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 3: VIEW USER DETAILS
         ========================================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`User Profile: ${selectedUser?.name || ''}`}
        size="md"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div
                className={`w-14 h-14 rounded-full overflow-hidden flex items-center justify-center font-bold text-xl text-white shadow-sm flex-shrink-0 ${
                  selectedUser.is_main_admin
                    ? 'bg-purple-600'
                    : selectedUser.role === 'admin'
                    ? 'bg-indigo-600'
                    : 'bg-primary-600'
                }`}
              >
                {selectedUser.profile_photo ? (
                  <img
                    src={resolveFileUrl(selectedUser.profile_photo)}
                    alt={selectedUser.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  selectedUser.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-900">{selectedUser.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-300">
                    #{selectedUser.member_code || 'PENDING'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedUser.is_main_admin
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : selectedUser.role === 'admin'
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {selectedUser.is_main_admin
                      ? 'Main Association Admin'
                      : selectedUser.role === 'admin'
                      ? 'Layout Admin'
                      : 'Resident Member'}
                  </span>
                  {canManageRoles && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenRoleModal(selectedUser);
                      }}
                      className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition"
                      title="Change Role / Designation"
                    >
                      <HiShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Change Role</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 block">Door / Flat No:</span>
                <span className="font-bold text-gray-900 text-sm">{selectedUser.door_no || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Street:</span>
                <span className="font-semibold text-gray-800">{selectedUser.street || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Phone:</span>
                <span className="font-medium text-gray-800">{selectedUser.phone || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Email:</span>
                <span className="font-medium text-gray-800">{selectedUser.email || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Account Status:</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedUser.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedUser.status === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedUser.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Joined Date:</span>
                <span className="font-medium text-gray-800">
                  {selectedUser.created_at
                    ? new Date(selectedUser.created_at).toLocaleDateString()
                    : '—'}
                </span>
              </div>
            </div>

            {/* Verification Proofs */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-2">
                Verification Proofs
              </span>
              <div className="grid grid-cols-2 gap-3">
                {selectedUser.eb_bill_proof ? (
                  <a
                    href={resolveFileUrl(selectedUser.eb_bill_proof)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-primary-600 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <HiDocumentText className="w-4 h-4 text-sky-500" />
                      EB Bill Proof
                    </span>
                    <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <div className="p-2.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 text-center">
                    No EB bill uploaded
                  </div>
                )}

                {selectedUser.property_tax_receipt ? (
                  <a
                    href={resolveFileUrl(selectedUser.property_tax_receipt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-medium text-primary-600 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <HiDocumentText className="w-4 h-4 text-emerald-500" />
                      Property Tax Proof
                    </span>
                    <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <div className="p-2.5 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 text-center">
                    No Tax receipt uploaded
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =========================================================================
          MODAL: CHANGE USER ROLES & LEADERSHIP DESIGNATION (WITH USER SEARCH BAR)
         ========================================================================= */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => {
          if (!isSubmittingRole) {
            setIsRoleModalOpen(false);
            setRoleTargetUser(null);
            setModalSearchTerm('');
          }
        }}
        title="Change User Roles & Main Admin Designation"
        size="lg"
      >
        <div className="space-y-5">
          {/* 1. User Search Bar */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
              <span>Select Association User</span>
              <span className="text-[11px] font-normal text-gray-500">
                {modalFilteredUsers.length} user{modalFilteredUsers.length === 1 ? '' : 's'} available
              </span>
            </label>

            <div className="relative">
              <HiMagnifyingGlass className="absolute left-3.5 top-3 w-4 h-4 text-purple-600" />
              <input
                type="text"
                value={modalSearchTerm}
                onChange={(e) => setModalSearchTerm(e.target.value)}
                placeholder="Search user by name, phone, door no, or member code..."
                className="w-full pl-10 pr-4 py-2.5 bg-purple-50/40 border border-purple-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-400"
              />
              {modalSearchTerm && (
                <button
                  type="button"
                  onClick={() => setModalSearchTerm('')}
                  className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600 font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick User Selection Chips / List if searching or no user selected */}
            {(!roleTargetUser || modalSearchTerm.trim()) && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-gray-50/70 rounded-2xl border border-gray-200">
                {modalFilteredUsers.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-4">No matching users found</p>
                ) : (
                  modalFilteredUsers.map((u) => {
                    const isSelected = roleTargetUser?.id === u.id;
                    const isMainAdm = u.is_main_admin || u.display_role === 'Main Association Admin';
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleSelectRoleTarget(u)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 text-xs ${
                          isSelected
                            ? 'bg-purple-100 border-purple-300 font-bold text-purple-900'
                            : 'bg-white hover:bg-purple-50 border-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div
                            className={`w-7 h-7 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${
                              isMainAdm
                                ? 'bg-purple-600'
                                : u.role === 'admin'
                                ? 'bg-indigo-600'
                                : 'bg-primary-600'
                            }`}
                          >
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-gray-900 mr-2">{u.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              #{u.member_code || 'PENDING'}
                            </span>
                            {u.door_no && (
                              <span className="text-[10px] text-gray-400 ml-1.5">
                                • Door {u.door_no}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${
                            isMainAdm
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : u.role === 'admin'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {isMainAdm
                            ? 'Main Admin'
                            : u.role === 'admin'
                            ? 'Layout Admin'
                            : 'Resident Member'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 2. Selected User Details & Role Options Form */}
          {roleTargetUser ? (
            <form onSubmit={handleSaveRoleChange} className="space-y-4 pt-2 border-t border-gray-100">
              {/* Selected User Header Card */}
              <div className="flex items-center gap-3.5 p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-200/80">
                <div
                  className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${
                    roleTargetUser.is_main_admin
                      ? 'bg-purple-600'
                      : roleTargetUser.role === 'admin'
                      ? 'bg-indigo-600'
                      : 'bg-primary-600'
                  }`}
                >
                  {roleTargetUser.profile_photo ? (
                    <img
                      src={resolveFileUrl(roleTargetUser.profile_photo)}
                      alt={roleTargetUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    roleTargetUser.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-gray-900 truncate">{roleTargetUser.name}</h4>
                    <span className="font-mono text-[10px] font-bold text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-300">
                      #{roleTargetUser.member_code || 'PENDING'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-600">
                    <span>Current Role:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                        roleTargetUser.is_main_admin
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : roleTargetUser.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {roleTargetUser.is_main_admin
                        ? 'Main Association Admin'
                        : roleTargetUser.role === 'admin'
                        ? 'Layout Admin'
                        : 'Resident Member'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. New Role Selection Options */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Choose New Role & Designation
                </label>

                {/* Option 1: Main Association Admin */}
                <div
                  onClick={() => setTargetNewRole('main_admin')}
                  className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                    targetNewRole === 'main_admin'
                      ? 'border-purple-600 bg-purple-50/70 shadow-sm'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="modal_new_role"
                    value="main_admin"
                    checked={targetNewRole === 'main_admin'}
                    onChange={() => setTargetNewRole('main_admin')}
                    className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-purple-950">👑 Main Association Admin</span>
                      <span className="px-2 py-0.5 bg-purple-200/80 text-purple-800 text-[10px] font-bold rounded-full">
                        Primary Leader
                      </span>
                    </div>
                    <p className="text-xs text-purple-900/80 mt-1 leading-relaxed">
                      Primary administrative leader of the association. Has authority to approve registrations, manage association details, and assign admin roles.
                    </p>
                  </div>
                </div>

                {/* Option 2: Layout Admin */}
                <div
                  onClick={() => setTargetNewRole('admin')}
                  className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                    targetNewRole === 'admin'
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-sm'
                      : 'border-gray-200 hover:border-indigo-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="modal_new_role"
                    value="admin"
                    checked={targetNewRole === 'admin'}
                    onChange={() => setTargetNewRole('admin')}
                    className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-indigo-950">🛡️ Layout Admin</span>
                      <span className="px-2 py-0.5 bg-indigo-200/80 text-indigo-800 text-[10px] font-bold rounded-full">
                        Co-Administrator
                      </span>
                    </div>
                    <p className="text-xs text-indigo-900/80 mt-1 leading-relaxed">
                      Co-administrator with operational management access to complaints, community events, news notices, and SOS alerts.
                    </p>
                  </div>
                </div>

                {/* Option 3: Resident Member */}
                <div
                  onClick={() => setTargetNewRole('member')}
                  className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                    targetNewRole === 'member'
                      ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                      : 'border-gray-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="modal_new_role"
                    value="member"
                    checked={targetNewRole === 'member'}
                    onChange={() => setTargetNewRole('member')}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-blue-950">👥 Resident Member</span>
                      <span className="px-2 py-0.5 bg-blue-200/80 text-blue-800 text-[10px] font-bold rounded-full">
                        Standard User
                      </span>
                    </div>
                    <p className="text-xs text-blue-900/80 mt-1 leading-relaxed">
                      Standard layout resident account. Can view association notices, vote in polls, raise complaints, and trigger SOS alerts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contextual Logic 1: If promoting someone to Main Admin and there is currently another Main Admin */}
              {targetNewRole === 'main_admin' && !roleTargetUser.is_main_admin && currentMainAdmin && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <HiShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Leadership Handover for Current Main Admin</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>{currentMainAdmin.name}</strong> (#{currentMainAdmin.member_code}) is currently the Main Association Admin. What role should {currentMainAdmin.name} become after {roleTargetUser.name} is promoted?
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        previousAdminRole === 'admin'
                          ? 'border-amber-500 bg-white text-amber-950 font-bold shadow-xs'
                          : 'border-amber-200 bg-amber-50/50 text-amber-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="prev_role"
                        value="admin"
                        checked={previousAdminRole === 'admin'}
                        onChange={() => setPreviousAdminRole('admin')}
                      />
                      <span>Convert to Layout Admin</span>
                    </label>
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                        previousAdminRole === 'member'
                          ? 'border-amber-500 bg-white text-amber-950 font-bold shadow-xs'
                          : 'border-amber-200 bg-amber-50/50 text-amber-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="prev_role"
                        value="member"
                        checked={previousAdminRole === 'member'}
                        onChange={() => setPreviousAdminRole('member')}
                      />
                      <span>Convert to Resident Member</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Contextual Logic 2: If demoting the current Main Admin to Layout Admin or Resident Member */}
              {roleTargetUser.is_main_admin && targetNewRole !== 'main_admin' && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2.5">
                  <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                    <HiShieldCheck className="w-4 h-4 text-rose-600" />
                    <span>Successor Required: Assign New Main Association Admin</span>
                  </div>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    You are changing current Main Admin <strong>{roleTargetUser.name}</strong> to a{' '}
                    <strong>{targetNewRole === 'admin' ? 'Layout Admin' : 'Resident Member'}</strong>.
                    Please designate which approved user will become the new <strong>Main Association Admin</strong>:
                  </p>
                  <select
                    required
                    value={newMainAdminId}
                    onChange={(e) => setNewMainAdminId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-rose-300 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">-- Choose New Main Association Admin --</option>
                    {users
                      .filter((x) => x.id !== roleTargetUser.id && x.status === 'approved')
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name} (#{x.member_code}) — {x.role === 'admin' ? 'Layout Admin' : 'Resident Member'} ({x.door_no ? `Door ${x.door_no}` : x.phone})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isSubmittingRole}
                  onClick={() => {
                    setIsRoleModalOpen(false);
                    setRoleTargetUser(null);
                    setModalSearchTerm('');
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {isSubmittingRole ? (
                    <>
                      <HiArrowPath className="w-4 h-4 animate-spin" />
                      <span>Updating Role...</span>
                    </>
                  ) : (
                    <>
                      <HiCheckCircle className="w-4 h-4" />
                      <span>Confirm Role Change</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-8 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <HiUsers className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-medium">Use the search bar above to select a user to modify their role.</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User Account"
        message={`Are you sure you want to remove "${deleteTarget?.name}"? This action will permanently delete their account and privileges.`}
        confirmText="Yes, Delete"
        danger
        loading={isDeleting}
      />
    </div>
  );
}
