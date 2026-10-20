import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiBuildingOffice2,
  HiUsers,
  HiShieldExclamation,
  HiExclamationCircle,
  HiUserPlus,
  HiTrash,
  HiFunnel,
  HiMagnifyingGlass,
  HiEye,
  HiCheckCircle,
  HiXCircle,
  HiArrowPath,
} from 'react-icons/hi2';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Active view tab: 'associations' | 'users'
  const [activeTab, setActiveTab] = useState('associations');

  // Stats
  const [stats, setStats] = useState({
    totalAssociations: 0,
    totalUsers: 0,
    pendingApprovals: 0,
    sosAlertsCount: 0,
  });

  // Data lists
  const [associations, setAssociations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedAssocId, setSelectedAssocId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create Super Admin Modal
  const [isSuperAdminModalOpen, setIsSuperAdminModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ name: '', email: '', phone: '', password: '' });
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);

  // Delete Confirmation
  const [deleteItem, setDeleteItem] = useState(null); // { type: 'association' | 'user', id, name }
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [assocRes, usersRes, pendingRes, sosRes] = await Promise.allSettled([
        api.get('/associations'),
        api.get('/users'),
        api.get('/users/pending'),
        api.get('/sos/alerts'),
      ]);

      const assocList = assocRes.status === 'fulfilled' ? assocRes.value.data?.data || [] : [];
      const userList = usersRes.status === 'fulfilled' ? usersRes.value.data?.data || [] : [];
      const pendingList = pendingRes.status === 'fulfilled' ? pendingRes.value.data?.data || [] : [];
      const alertsList = sosRes.status === 'fulfilled' ? sosRes.value.data?.data || [] : [];

      setAssociations(assocList);
      setUsers(userList);
      setStats({
        totalAssociations: assocList.length,
        totalUsers: userList.length,
        pendingApprovals: pendingList.length,
        sosAlertsCount: alertsList.length,
      });
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter users by selected association & search query
  const filteredUsers = users.filter((u) => {
    const matchesAssoc =
      selectedAssocId === 'all' || String(u.association_id) === String(selectedAssocId);
    const matchesSearch =
      !searchQuery ||
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery) ||
      u.member_code?.includes(searchQuery);
    return matchesAssoc && matchesSearch;
  });

  // Filter associations by search query
  const filteredAssociations = associations.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.city?.toLowerCase().includes(q) ||
      a.admin_names?.toLowerCase().includes(q)
    );
  });

  // Handle Create Super Admin
  const handleCreateSuperAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.name || !newAdmin.email || !newAdmin.password) {
      toast.error('Please enter name, email, and password');
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

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      setIsDeleting(true);
      if (deleteItem.type === 'association') {
        await api.delete(`/associations/${deleteItem.id}`);
        toast.success(`Association "${deleteItem.name}" deleted successfully`);
      } else if (deleteItem.type === 'user') {
        await api.delete(`/users/${deleteItem.id}`);
        toast.success(`User "${deleteItem.name}" removed successfully`);
      }
      setDeleteItem(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete operation failed');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {t('super_admin_title') || 'Master Super Admin Control Hub'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('super_admin_subtitle') ||
              'Platform-wide association oversight, member directory, and authority delegation.'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition"
            title="Refresh Data"
          >
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsSuperAdminModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-purple-600/20 flex items-center gap-2 transition"
          >
            <HiUserPlus className="w-4 h-4" />
            <span>{t('create_superadmin') || '+ Create Another Super Admin'}</span>
          </button>
        </div>
      </div>

      {/* Interactive 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Associations Card - Clicking activates Associations View */}
        <div
          onClick={() => setActiveTab('associations')}
          className={`cursor-pointer p-5 rounded-2xl border transition-all duration-200 transform hover:-translate-y-0.5 ${
            activeTab === 'associations'
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20'
              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-sm hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {t('nav_associations') || 'Associations'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
              <HiBuildingOffice2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {loading ? '...' : stats.totalAssociations}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('layouts_active') || 'Layouts'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <span>● {activeTab === 'associations' ? (t('viewing_breakdown') || 'Currently Selected') : (t('click_to_view') || 'Click to view breakdown & admins')}</span>
          </p>
        </div>

        {/* Registered Users Card - Clicking activates Users View */}
        <div
          onClick={() => setActiveTab('users')}
          className={`cursor-pointer p-5 rounded-2xl border transition-all duration-200 transform hover:-translate-y-0.5 ${
            activeTab === 'users'
              ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10 ring-2 ring-purple-500/20'
              : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-sm hover:border-purple-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              {t('nav_users') || 'All Users & Members'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              <HiUsers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {loading ? '...' : stats.totalUsers}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('total_residents') || 'Accounts'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1">
            <span>● {activeTab === 'users' ? (t('viewing_breakdown') || 'Currently Selected') : (t('click_to_filter') || 'Click to filter by association')}</span>
          </p>
        </div>

        {/* Pending Approvals Card */}
        <div
          onClick={() => navigate('/super-admin/approvals')}
          className="cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm hover:border-yellow-400 transition-all duration-200 transform hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Associations
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
              <HiShieldExclamation className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {loading ? '...' : stats.pendingApprovals}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('needs_review') || 'Needs Review'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            → Verify new Association & Main Admin registrations
          </p>
        </div>

        {/* SOS Reports Card */}
        <div
          onClick={() => navigate('/super-admin/sos-reports')}
          className="cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm hover:border-red-400 transition-all duration-200 transform hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              {t('nav_sos_reports') || 'SOS Emergencies'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex items-center justify-center">
              <HiExclamationCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white">
              {loading ? '...' : stats.sosAlertsCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('signals_logged') || 'Distress Signals'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium text-red-600 dark:text-red-400">
            → {t('view_sos_history') || 'View GPS & response metrics'}
          </p>
        </div>
      </div>

      {/* Main Breakdown Section with View Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        {/* Tab Header & Filter Controls */}
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('associations')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'associations'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <HiBuildingOffice2 className="w-4 h-4" />
              <span>
                {t('associations_breakdown') || 'Associations & Assigned Admins'} ({associations.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <HiUsers className="w-4 h-4" />
              <span>
                {t('users_directory') || 'Users by Association'} ({filteredUsers.length})
              </span>
            </button>
          </div>

          {/* Search & Association Filter Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Association Dropdown Filter (Visible for Users tab or filter) */}
            <div className="flex items-center gap-1.5">
              <HiFunnel className="w-4 h-4 text-gray-400" />
              <select
                value={selectedAssocId}
                onChange={(e) => {
                  setSelectedAssocId(e.target.value);
                  if (activeTab !== 'users') setActiveTab('users');
                }}
                className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">🌐 {t('all_associations') || 'All Associations (All Users)'}</option>
                {associations.map((a) => (
                  <option key={a.id} value={a.id}>
                    📍 {a.name} ({a.city || 'TN'})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'associations'
                    ? (t('search_assoc_placeholder') || 'Search layout, city...')
                    : (t('search_users_placeholder') || 'Search user, phone, code...')
                }
                className="py-1.5 pl-8 pr-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: ASSOCIATIONS BREAKDOWN (Showing association, member count, and assigned admins) */}
        {activeTab === 'associations' && (
          <div className="overflow-x-auto">
            {filteredAssociations.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('no_associations_found') || 'No associations matching your search.'}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4"># ID</th>
                    <th className="py-3 px-4">{t('col_layout_name') || 'Association / Layout Name'}</th>
                    <th className="py-3 px-4">{t('col_city') || 'City / Region'}</th>
                    <th className="py-3 px-4 text-center">{t('col_members_count') || 'Total Members'}</th>
                    <th className="py-3 px-4">{t('col_assigned_admins') || 'Assigned Admin(s)'}</th>
                    <th className="py-3 px-4 text-center">{t('col_status') || 'Status'}</th>
                    <th className="py-3 px-4 text-right">{t('col_actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {filteredAssociations.map((assoc) => (
                    <tr
                      key={assoc.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-500 dark:text-gray-400">
                        #{assoc.id}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs">
                            {assoc.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">{assoc.name}</p>
                            <p className="text-[10px] text-gray-400 line-clamp-1">{assoc.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-medium">
                        📍 {assoc.city || 'Tamil Nadu'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssocId(String(assoc.id));
                            setActiveTab('users');
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition"
                          title="Click to view only this association's members"
                        >
                          <HiUsers className="w-3.5 h-3.5" />
                          <span>{assoc.member_count || 0} {t('members') || 'Members'}</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                        {assoc.admin_names && assoc.admin_names !== 'None Assigned' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                            👤 {assoc.admin_names}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">
                            {t('no_admin_assigned') || 'No Admin Assigned'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            assoc.is_active
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                              : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {assoc.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Filter Users */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssocId(String(assoc.id));
                              setActiveTab('users');
                            }}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition"
                            title="Filter users to this association"
                          >
                            <HiEye className="w-4 h-4" />
                          </button>

                          {/* Delete Association */}
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteItem({
                                type: 'association',
                                id: assoc.id,
                                name: assoc.name,
                              })
                            }
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title="Delete Association"
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: USERS DIRECTORY (Filtered by Association or All) */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            {/* Banner when filtered */}
            {selectedAssocId !== 'all' && (
              <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/30 flex items-center justify-between text-xs text-purple-800 dark:text-purple-300">
                <span>
                  Filtering members for layout:{' '}
                  <strong>
                    {associations.find((a) => String(a.id) === String(selectedAssocId))?.name ||
                      'Selected Layout'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAssocId('all')}
                  className="font-bold underline hover:text-purple-950"
                >
                  Show All Associations
                </button>
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('no_users_found') || 'No users found matching the filter criteria.'}
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">{t('col_member_code') || 'Member Code'}</th>
                    <th className="py-3 px-4">{t('col_user_name') || 'Resident Name'}</th>
                    <th className="py-3 px-4">{t('col_association') || 'Association / Layout'}</th>
                    <th className="py-3 px-4">{t('col_contact') || 'Contact Phone / Email'}</th>
                    <th className="py-3 px-4">{t('col_door_street') || 'Door / Street'}</th>
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
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-800 dark:text-gray-200">
                        {user.member_code ? `#${user.member_code}` : '------'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                        <p>{user.name}</p>
                        <p className="text-[10px] text-gray-400 font-normal">{user.email}</p>
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
                        {user.door_no ? `Door ${user.door_no}` : ''}
                        {user.street ? `, ${user.street}` : ''}
                        {!user.door_no && !user.street && 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            user.role === 'super_admin'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                              : user.role === 'admin'
                              ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {user.role?.replace('_', ' ')}
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
                            onClick={() =>
                              setDeleteItem({
                                type: 'user',
                                id: user.id,
                                name: `${user.name} (${user.email || user.phone})`,
                              })
                            }
                            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title={user.role === 'super_admin' ? 'Delete Super Admin' : 'Delete User Account'}
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
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

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteItem)}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        title={
          deleteItem?.type === 'association'
            ? 'Delete Layout Association'
            : 'Delete User Account'
        }
        message={`Are you sure you want to permanently delete "${deleteItem?.name}"? This action cannot be undone.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />
    </div>
  );
}
