import React, { useState, useEffect } from 'react';
import {
  HiUsers,
  HiUserPlus,
  HiTrash,
  HiPencilSquare,
  HiFunnel,
  HiMagnifyingGlass,
  HiShieldCheck,
  HiArrowPath,
  HiCheckCircle,
  HiXCircle,
} from 'react-icons/hi2';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DigitalIdCardModal from '../../components/common/DigitalIdCardModal';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

export default function ManageUsers() {
  const { t } = useLanguage();

  const [users, setUsers] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Digital ID Modal
  const [selectedUserForId, setSelectedUserForId] = useState(null);
  const [isIdModalOpen, setIsIdModalOpen] = useState(false);

  // Filters
  const [selectedAssocId, setSelectedAssocId] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Create Super Admin Modal
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', phone: '', password: '' });
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  // Edit User / Super Admin Modal
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    door_no: '',
    street: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete User Confirmation
  const [deleteUser, setDeleteUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, assocRes] = await Promise.all([
        api.get('/users'),
        api.get('/associations'),
      ]);
      setUsers(usersRes.data?.data || []);
      setAssociations(assocRes.data?.data || []);
    } catch (err) {
      console.warn('Error fetching users:', err);
      toast.error('Failed to load users directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesAssoc =
      selectedAssocId === 'all' || String(u.association_id) === String(selectedAssocId);
    const matchesRole =
      selectedRole === 'all' ||
      (selectedRole === 'main_admin'
        ? Boolean(u.is_main_admin || u.display_role === 'Main Association Admin')
        : selectedRole === 'admin'
        ? u.role === 'admin' && !u.is_main_admin && u.display_role !== 'Main Association Admin'
        : u.role === selectedRole);
    const matchesSearch =
      !searchTerm ||
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm) ||
      u.member_code?.includes(searchTerm) ||
      u.door_no?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAssoc && matchesRole && matchesSearch;
  });

  // Handle Create Super Admin
  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    try {
      setIsSubmittingAdmin(true);
      await api.post('/users/create-superadmin', newAdmin);
      toast.success(`Super Admin "${newAdmin.name}" created successfully!`);
      setIsSuperAdminModalOpen(false);
      setNewAdmin({ name: '', email: '', phone: '', password: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create Super Admin');
    } finally {
      setIsSubmittingAdmin(false);
    }
  };

  // Password strength calculation helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-gray-200' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 50, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 3) return { score: 75, label: 'Good', color: 'bg-blue-500' };
    return { score: 100, label: 'Strong', color: 'bg-green-500' };
  };



  // Handle Edit User
  const handleOpenEdit = (user) => {
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      door_no: user.door_no || '',
      street: user.street || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    try {
      setIsSavingEdit(true);
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        door_no: editForm.door_no.trim(),
        street: editForm.street.trim(),
      };
      if (editForm.password && editForm.password.trim()) {
        if (editForm.password.trim().length < 6) {
          toast.error('Password must be at least 6 characters long');
          setIsSavingEdit(false);
          return;
        }
        payload.password = editForm.password.trim();
      }
      await api.put(`/users/${editUser.id}`, payload);
      toast.success(`${editUser.role === 'super_admin' ? 'Super Admin' : 'User'} "${editForm.name}" updated successfully!`);
      setEditUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete User
  const handleConfirmDelete = async () => {
    if (!deleteUser) return;
    try {
      setIsDeleting(true);
      await api.delete(`/users/${deleteUser.id}`);
      toast.success(`User "${deleteUser.name}" deleted successfully`);
      setDeleteUser(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {t('nav_users') || 'Manage Users & Members'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('users_management_desc') ||
              'Complete master registry of residents, layout admins, and platform super administrators.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition"
            title="Refresh Users"
          >
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsSuperAdminModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 flex items-center gap-2 transition"
          >
            <HiUserPlus className="w-4 h-4" />
            <span>{t('create_superadmin') || '+ Super Admin'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        {/* Association Filter Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-1">
            <HiFunnel className="w-4 h-4" />
            {t('filter_association') || 'Filter Association'}:
          </span>

          <select
            value={selectedAssocId}
            onChange={(e) => setSelectedAssocId(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">🌐 {t('all_associations') || 'All Associations (All Users)'}</option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                📍 {a.name} ({a.city || 'TN'})
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Roles</option>
            <option value="super_admin">Super Admins</option>
            <option value="admin">Main Association Admins</option>
            <option value="member">Residents (Members)</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('search_users_placeholder') || 'Search name, phone, code, door...'}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Loading users...' : 'No users found matching the selected filter.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">{t('col_member_code') || 'Member Code'}</th>
                  <th className="py-3 px-4">{t('col_user_name') || 'Full Name'}</th>
                  <th className="py-3 px-4">{t('col_association') || 'Association / Layout'}</th>
                  <th className="py-3 px-4">{t('col_contact') || 'Contact Phone / Email'}</th>
                  <th className="py-3 px-4">{t('col_door_street') || 'Address / Door No'}</th>
                  <th className="py-3 px-4 text-center">{t('col_role') || 'Role'}</th>
                  <th className="py-3 px-4 text-center">{t('col_status') || 'Status'}</th>
                  <th className="py-3 px-4 text-right">{t('col_actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-purple-50/40 dark:hover:bg-slate-800/40 transition group"
                  >
                    <td
                      className="py-3.5 px-4 font-mono font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-purple-600 transition"
                      onClick={() => {
                        setSelectedUserForId(user);
                        setIsIdModalOpen(true);
                      }}
                      title="Click to view Digital ID"
                    >
                      {user.member_code ? `#${user.member_code}` : '------'}
                    </td>
                    <td
                      className="py-3.5 px-4 font-bold text-gray-900 dark:text-white cursor-pointer"
                      onClick={() => {
                        setSelectedUserForId(user);
                        setIsIdModalOpen(true);
                      }}
                      title="Click to view Digital ID"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-xs ring-1 ring-purple-200 dark:ring-purple-800 flex-shrink-0 group-hover:ring-2 group-hover:ring-teal-400 transition">
                          {user.profile_photo ? (
                            <img
                              src={resolveFileUrl(user.profile_photo)}
                              alt={user.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            user.name ? user.name.slice(0, 2).toUpperCase() : 'U'
                          )}
                        </div>
                        <div>
                          <p className="group-hover:text-purple-600 dark:group-hover:text-purple-400 transition flex items-center gap-1">
                            <span>{user.name}</span>
                            <span className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 transition">🪪</span>
                          </p>
                          <p className="text-[10px] text-gray-400 font-normal">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                      {user.association_name ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                          📍 {user.association_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Platform Level</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-mono">
                      {user.phone || 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400">
                      {user.door_no ? `Door #${user.door_no}` : ''}
                      {user.street ? `, ${user.street}` : ''}
                      {!user.door_no && !user.street && 'N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          user.role === 'super_admin'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : user.is_main_admin || user.display_role === 'Main Association Admin'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                            : user.role === 'admin'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {user.role === 'super_admin'
                          ? '👑 Super Admin'
                          : user.is_main_admin || user.display_role === 'Main Association Admin'
                          ? '🛡️ Main Association Admin'
                          : user.role === 'admin'
                          ? '🛡️ Layout Admin'
                          : '👥 Resident Member'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          user.status === 'approved'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                            : user.status === 'pending'
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                            : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Digital ID Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForId(user);
                            setIsIdModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 transition shadow-2xs"
                          title="View Official Digital ID Badge"
                        >
                          <span>🪪</span>
                          <span>Digital ID</span>
                        </button>

                        {/* Edit option for Super Admin only */}
                        {user.role === 'super_admin' && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(user)}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                            title="Edit Super Admin"
                          >
                            <HiPencilSquare className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete User */}
                        {user.email === 'superadmin@association.com' || user.member_code === '000001' ? (
                          <button
                            type="button"
                            disabled
                            className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-40 transition"
                            title="Primary Super Admin account (#000001) cannot be deleted"
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteUser(user)}
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title={user.role === 'super_admin' ? 'Delete Super Admin' : 'Delete User'}
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CREATE SUPER ADMIN MODAL */}
      <Modal
        isOpen={isSuperAdminModalOpen}
        onClose={() => setIsSuperAdminModalOpen(false)}
        title={t('create_superadmin_modal_title') || 'Create Another Super Admin'}
        size="md"
      >
        <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('create_superadmin_modal_desc') ||
              'A Super Admin possesses platform-wide governance access across all layout associations and system settings.'}
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={newAdmin.name}
              onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
              placeholder="e.g. Master Administrator"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Official Email Address *
            </label>
            <input
              type="email"
              required
              value={newAdmin.email}
              onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
              placeholder="e.g. admin2@association.com"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Contact Phone Number
            </label>
            <input
              type="tel"
              value={newAdmin.phone}
              onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Login Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newAdmin.password}
              onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsSuperAdminModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingAdmin}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {isSubmittingAdmin ? 'Creating...' : 'Create Super Admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT SUPER ADMIN MODAL */}
      <Modal
        isOpen={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title={`Edit Super Admin (#${editUser?.member_code || '000001'})`}
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl text-purple-900 dark:text-purple-200 text-xs font-medium flex items-center gap-2">
            <HiShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span>
              Editing platform-level <strong>Super Administrator</strong> credentials and contact details.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              New Password <span className="font-normal text-gray-400 text-[11px]">(leave blank to keep current)</span>
            </label>
            <input
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              placeholder="Enter new password if changing..."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingEdit}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDialog
        isOpen={Boolean(deleteUser)}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete user "${deleteUser?.name}" (${deleteUser?.email || deleteUser?.phone})?`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />

      {/* DIGITAL ID CARD MODAL */}
      <DigitalIdCardModal
        isOpen={isIdModalOpen}
        onClose={() => setIsIdModalOpen(false)}
        user={selectedUserForId}
        associationName={selectedUserForId?.association_name}
      />
    </div>
  );
}
