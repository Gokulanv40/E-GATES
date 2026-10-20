import React, { useState, useEffect, useCallback } from 'react';
import {
  HiPlus,
  HiBuildingOffice2,
  HiMagnifyingGlass,
  HiCheck,
  HiXMark,
  HiPencil,
  HiTrash,
  HiUserPlus,
  HiArrowPath,
  HiPhoto,
  HiShieldCheck,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import FileUpload from '../../components/common/FileUpload';

export default function Associations() {
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Single Create / Edit Modal State (Combined with Admin Creation)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssoc, setEditingAssoc] = useState(null);
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLogo, setFormLogo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Combined Admin creation state inside Add Association modal
  const [comboAdminForm, setComboAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    door_no: '',
    street: '',
    taluk: '',
    district: '',
    state: 'Tamil Nadu',
  });
  const [comboAdminEbFile, setComboAdminEbFile] = useState(null);
  const [comboAdminTaxFile, setComboAdminTaxFile] = useState(null);

  // Toggle Confirm Dialog State
  const [toggleAssoc, setToggleAssoc] = useState(null);
  const [isToggleConfirmOpen, setIsToggleConfirmOpen] = useState(false);

  // Delete Association Confirm State
  const [deleteAssoc, setDeleteAssoc] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin Management Modal State (Assign / Manage Existing User Roles)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminAssoc, setAdminAssoc] = useState(null);
  const [adminForm, setAdminForm] = useState({
    association_id: '',
  });
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRoleAction, setSelectedRoleAction] = useState('admin'); // 'admin' | 'member'
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  // Fetch all associations
  const fetchAssociations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/associations');
      setAssociations(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load associations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssociations();
  }, [fetchAssociations]);

  // Open Create Combined Modal
  const handleOpenCreate = async () => {
    setEditingAssoc(null);
    setFormName('');
    setFormCity('');
    setFormAddress('');
    setFormLogo(null);
    setComboAdminForm({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      door_no: '',
      street: '',
      taluk: '',
      district: '',
      state: 'Tamil Nadu',
    });
    setComboAdminEbFile(null);
    setComboAdminTaxFile(null);
    setIsModalOpen(true);

    try {
      const res = await api.get('/users');
      setUsersList(res.data?.data || []);
    } catch (err) {
      // ignore
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (assoc) => {
    setEditingAssoc(assoc);
    setFormName(assoc.name || '');
    setFormCity(assoc.city || '');
    setFormAddress(assoc.address || '');
    setFormLogo(null);
    setIsModalOpen(true);
  };

  // Submit Combined Create / Update
  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Association name is required');
      return;
    }

    if (!formCity.trim()) {
      toast.error('City / District is required');
      return;
    }

    // Validation for new Association + Admin creation
    if (!editingAssoc) {
      if (!comboAdminForm.name.trim() || !comboAdminForm.email.trim() || !comboAdminForm.password) {
        toast.error('Admin Full Name, Email, and Password are required');
        return;
      }
      if (comboAdminForm.password.length < 6) {
        toast.error('Admin password must be at least 6 characters');
        return;
      }
      if (comboAdminForm.password !== comboAdminForm.confirm_password) {
        toast.error('Admin password and confirm password do not match');
        return;
      }
      if (!comboAdminForm.phone || comboAdminForm.phone.length < 10) {
        toast.error('Please enter a valid 10-digit mobile number for Admin');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('name', formName.trim());
      formData.append('city', formCity.trim());
      formData.append('address', formAddress.trim());
      if (formLogo) {
        formData.append('logo', formLogo);
      }

      if (editingAssoc) {
        await api.put(`/associations/${editingAssoc.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success(`Updated "${formName}" successfully!`);
      } else {
        // 1. Create the new Association
        const assocRes = await api.post('/associations', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const createdAssoc = assocRes.data?.data || assocRes.data;
        const newAssocId = createdAssoc?.id;

        if (!newAssocId) {
          throw new Error('Could not retrieve new association ID');
        }

        // 2. Register Designated Administrator
        const adminData = new FormData();
        adminData.append('name', comboAdminForm.name.trim());
        adminData.append('email', comboAdminForm.email.trim());
        adminData.append('phone', comboAdminForm.phone.trim());
        adminData.append('password', comboAdminForm.password);
        adminData.append('association_id', newAssocId);
        adminData.append('is_main_admin', 'true');
        adminData.append('door_no', comboAdminForm.door_no.trim());
        adminData.append('street', comboAdminForm.street.trim());
        adminData.append('layout_name', formName.trim());
        adminData.append('taluk', comboAdminForm.taluk.trim());
        adminData.append('district', comboAdminForm.district.trim() || formCity.trim());
        adminData.append('state', comboAdminForm.state.trim() || 'Tamil Nadu');

        if (comboAdminEbFile instanceof File) {
          adminData.append('eb_bill_proof', comboAdminEbFile);
        }
        if (comboAdminTaxFile instanceof File) {
          adminData.append('property_tax_receipt', comboAdminTaxFile);
        }

        await api.post('/users/create-admin', adminData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        toast.success(
          `Association "${formName}" and Main Association Admin "${comboAdminForm.name}" created successfully!`
        );
      }

      setIsModalOpen(false);
      fetchAssociations();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Association Active / Inactive
  const handleConfirmToggle = async () => {
    if (!toggleAssoc) return;
    try {
      await api.put(`/associations/${toggleAssoc.id}/toggle`);
      toast.success(
        `Association "${toggleAssoc.name}" is now ${
          toggleAssoc.is_active ? 'deactivated' : 'activated'
        }`
      );
      setIsToggleConfirmOpen(false);
      setToggleAssoc(null);
      fetchAssociations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to toggle status');
    }
  };

  // Delete Association Confirm Handler
  const handleConfirmDelete = async () => {
    if (!deleteAssoc) return;
    try {
      setIsDeleting(true);
      await api.delete(`/associations/${deleteAssoc.id}`);
      toast.success(`Association "${deleteAssoc.name}" deleted successfully!`);
      setDeleteAssoc(null);
      fetchAssociations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete association');
    } finally {
      setIsDeleting(false);
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

  // Open Admin Management Modal (Assign or Remove Existing User)
  const handleOpenAdminModal = async (assoc) => {
    setAdminAssoc(assoc);
    setAdminForm({
      association_id: assoc ? String(assoc.id) : (associations[0]?.id ? String(associations[0].id) : ''),
    });
    setSelectedUserId('');
    setSelectedRoleAction('admin');
    setIsAdminModalOpen(true);

    try {
      const res = await api.get('/users');
      setUsersList(res.data?.data || []);
    } catch (err) {
      // ignore
    }
  };

  const handleAssignExistingSubmit = async (e) => {
    e.preventDefault();
    const targetAssocId = adminAssoc?.id || adminForm.association_id;
    if (!targetAssocId) {
      toast.error('Please select an association');
      return;
    }
    if (!selectedUserId) {
      toast.error('Please select an existing user');
      return;
    }

    const isRemoving = selectedRoleAction === 'member';

    try {
      setIsAdminLoading(true);
      const res = await api.put(`/associations/${targetAssocId}/assign-admin`, {
        user_id: parseInt(selectedUserId, 10),
        role: selectedRoleAction,
        action: isRemoving ? 'remove_admin' : 'assign_admin',
      });

      toast.success(
        res.data?.message || (isRemoving ? 'Admin removed successfully!' : 'Admin assigned successfully!')
      );
      setIsAdminModalOpen(false);
      fetchAssociations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user role');
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleSelectUserForAssign = (userId) => {
    setSelectedUserId(userId);
    const u = usersList.find((item) => String(item.id) === String(userId));
    if (u?.role === 'admin') {
      setSelectedRoleAction('member');
    } else {
      setSelectedRoleAction('admin');
    }
  };



  // Filtered List
  const filteredAssociations = associations.filter((assoc) => {
    const matchesSearch =
      (assoc.name && assoc.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assoc.city && assoc.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (assoc.address && assoc.address.toLowerCase().includes(searchTerm.toLowerCase()));

    if (statusFilter === 'active') return matchesSearch && assoc.is_active;
    if (statusFilter === 'inactive') return matchesSearch && !assoc.is_active;
    return matchesSearch;
  });

  const totalAssocs = associations.length;
  const activeAssocs = associations.filter((a) => a.is_active).length;
  const totalMembers = associations.reduce(
    (acc, a) => acc + parseInt(a.member_count || 0, 10),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Associations Directory
          </h1>
          <p className="text-sm text-gray-500">
            Manage, configure, and monitor residential layout associations across all districts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAssociations}
            className="p-2.5 text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition shadow-sm"
            title="Refresh List"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>


          {/* Manage / Assign Admin Button */}
          <button
            onClick={() => handleOpenAdminModal(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-xl border border-indigo-200 transition shadow-xs"
            title="Manage layout administrators or assign roles"
          >
            <HiUserPlus className="w-5 h-5" />
            <span>Manage Admins</span>
          </button>

          {/* Combined Add Association & Admin Button */}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-md transition"
            title="Create a new residential layout association and its administrator together"
          >
            <HiPlus className="w-5 h-5" />
            <span>Add Association & Admin</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
            <HiBuildingOffice2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Total Associations
            </p>
            <p className="text-2xl font-black text-gray-900">{totalAssocs}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
            <HiCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Active Associations
            </p>
            <p className="text-2xl font-black text-emerald-700">{activeAssocs}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
            👥
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Registered Residents
            </p>
            <p className="text-2xl font-black text-purple-700">{totalMembers}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <HiMagnifyingGlass className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search layout name, city, address..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-gray-500 uppercase">Filter:</span>
          <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All ({totalAssocs})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active ({activeAssocs})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'inactive'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Inactive ({totalAssocs - activeAssocs})
            </button>
          </div>
        </div>
      </div>

      {/* Associations Cards / Grid */}
      {loading ? (
        <div className="py-16">
          <LoadingSpinner message="Loading associations registry..." />
        </div>
      ) : filteredAssociations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            <HiBuildingOffice2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Associations Found</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            {searchTerm
              ? `No associations matching "${searchTerm}". Try another search term.`
              : 'Get started by creating your first residential layout association.'}
          </p>
          <div className="flex items-center justify-center">
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl transition shadow-md"
            >
              Add Association
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssociations.map((assoc) => (
            <div
              key={assoc.id}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Header row with status & logo */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-50 to-blue-100 text-primary-700 flex items-center justify-center font-bold text-lg border border-primary-100 flex-shrink-0 overflow-hidden">
                    {assoc.logo ? (
                      <img
                        src={`http://localhost:5002/${assoc.logo}`}
                        alt={assoc.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      assoc.name.substring(0, 2).toUpperCase()
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        assoc.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {assoc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Association Title & Details */}
                <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-1 mb-1">
                  {assoc.name}
                </h3>
                <p className="text-xs font-semibold text-primary-700 mb-2">
                  📍 {assoc.city || 'Tamil Nadu'}
                </p>
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem] mb-3">
                  {assoc.address || 'Address details not provided.'}
                </p>

                {/* Main Association Admin Mention */}
                <div className="bg-purple-50/80 border border-purple-100 rounded-xl px-2.5 py-1.5 mb-3 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-purple-800 flex items-center gap-1">
                    <span>🛡️</span> Main Association Admin:
                  </span>
                  <span className="font-semibold text-purple-950 truncate max-w-[140px]">
                    {assoc.main_admin_name && assoc.main_admin_name !== 'None Assigned'
                      ? assoc.main_admin_name
                      : (assoc.admin_names && assoc.admin_names !== 'None Assigned'
                          ? assoc.admin_names.split(',')[0]
                          : 'None Assigned')}
                  </span>
                </div>

                {/* Counts Banner */}
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl text-center mb-4 text-xs font-semibold">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Residents</span>
                    <span className="font-bold text-gray-900">{assoc.member_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase">Admins</span>
                    <span className="font-bold text-gray-900">{assoc.admin_count || 0}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenAdminModal(assoc)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition flex items-center gap-1 shadow-sm"
                  title="Manage or Assign Admin"
                >
                  <HiUserPlus className="w-4 h-4" />
                  <span>Admin</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(assoc)}
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                    title="Edit Association"
                  >
                    <HiPencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setToggleAssoc(assoc);
                      setIsToggleConfirmOpen(true);
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      assoc.is_active
                        ? 'text-red-700 bg-red-50 hover:bg-red-100'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {assoc.is_active ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    onClick={() => setDeleteAssoc(assoc)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                    title="Delete Association"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMBINED ASSOCIATION + ADMIN CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingAssoc
            ? 'Edit Association Details'
            : 'Register New Layout Association & Administrator'
        }
        size={editingAssoc ? 'md' : 'xl'}
      >
        <form onSubmit={handleSubmitSingle} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* SECTION 1: ASSOCIATION DETAILS */}
          <div className="space-y-3 p-4 bg-gray-50/70 rounded-2xl border border-gray-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700 flex items-center gap-2 border-b border-gray-200/60 pb-2">
              <HiBuildingOffice2 className="w-4 h-4" />
              1. Association & Layout Information
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Association / Layout Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Green Valley Residents Welfare Association"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  City / District *
                </label>
                <input
                  type="text"
                  required
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="e.g. Chennai / Coimbatore"
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Full Layout Address (Optional)
              </label>
              <textarea
                rows={2}
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Door No, Street, Ward, District, PIN..."
                className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Association Crest / Logo (Optional)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormLogo(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>
          </div>

          {/* SECTION 2: MAIN ASSOCIATION ADMIN (When creating a brand-new association) */}
          {!editingAssoc && (
            <div className="space-y-4 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100">
              <div className="border-b border-indigo-100/80 pb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-2">
                  <HiUserPlus className="w-4 h-4" />
                  2. Main Association Admin Details
                </h4>
                <p className="text-[11px] text-indigo-600 mt-0.5">
                  Designate the Main Association Admin who will lead and manage this residential layout.
                </p>
              </div>

              <div className="space-y-4">
                  {/* Admin Personal Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Main Association Admin Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. K. Rajesh"
                        value={comboAdminForm.name}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, name: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Main Admin Mobile Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        pattern="[0-9]{10}"
                        placeholder="10-digit mobile"
                        value={comboAdminForm.phone}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Main Admin Official Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="admin@layout.com"
                        value={comboAdminForm.email}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Admin Address Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Door / Plot No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Plot 14A"
                        value={comboAdminForm.door_no}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, door_no: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Street / Cross
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1st Main Road"
                        value={comboAdminForm.street}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, street: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Taluk / Area
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Tambaram"
                        value={comboAdminForm.taluk}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, taluk: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Document Proofs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FileUpload
                      label="Electricity (EB) Bill Proof (Optional)"
                      helperText="PDF, JPG, PNG up to 5MB"
                      value={comboAdminEbFile}
                      onChange={(file) => setComboAdminEbFile(file)}
                    />

                    <FileUpload
                      label="Property Tax Receipt (Optional)"
                      helperText="PDF, JPG, PNG up to 5MB"
                      value={comboAdminTaxFile}
                      onChange={(file) => setComboAdminTaxFile(file)}
                    />
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Admin Login Password *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Min 6 characters"
                        value={comboAdminForm.password}
                        onChange={(e) =>
                          setComboAdminForm({ ...comboAdminForm, password: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      {comboAdminForm.password && (
                        <div className="mt-1.5">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-gray-500">Strength:</span>
                            <span className="font-semibold text-gray-700">
                              {getPasswordStrength(comboAdminForm.password).label}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                getPasswordStrength(comboAdminForm.password).color
                              }`}
                              style={{ width: `${getPasswordStrength(comboAdminForm.password).score}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Re-enter password"
                        value={comboAdminForm.confirm_password}
                        onChange={(e) =>
                          setComboAdminForm({
                            ...comboAdminForm,
                            confirm_password: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      {comboAdminForm.confirm_password &&
                        comboAdminForm.password !== comboAdminForm.confirm_password && (
                          <p className="mt-1 text-[11px] text-red-600 font-medium">
                            Passwords do not match
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Action Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : editingAssoc ? (
                'Update Association'
              ) : (
                'Create Association & Admin'
              )}
            </button>
          </div>
        </form>
      </Modal>


      {/* TOGGLE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={isToggleConfirmOpen}
        onClose={() => setIsToggleConfirmOpen(false)}
        onConfirm={handleConfirmToggle}
        title={toggleAssoc?.is_active ? 'Deactivate Association' : 'Activate Association'}
        message={`Are you sure you want to ${
          toggleAssoc?.is_active ? 'deactivate' : 'activate'
        } "${toggleAssoc?.name}"? ${
          toggleAssoc?.is_active
            ? 'Residents belonging to this association will not be able to log in while deactivated.'
            : 'Residents will regain access immediately.'
        }`}
        confirmText={toggleAssoc?.is_active ? 'Yes, Deactivate' : 'Yes, Activate'}
        danger={toggleAssoc?.is_active}
      />

      {/* ADMIN MANAGEMENT MODAL (Assign Existing User / Manage Roles) */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title={
          adminAssoc
            ? `Manage Layout Administrators - ${adminAssoc.name}`
            : 'Manage Layout Administrators'
        }
        size="lg"
      >
        <div className="space-y-5">
            <form onSubmit={handleAssignExistingSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                Manage administrator assignment or remove admin privileges for registered users in this layout association.
              </p>

              {/* Pinned or Select Target Association */}
              {!adminAssoc ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Target Association *
                  </label>
                  <select
                    required
                    value={adminForm.association_id}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, association_id: e.target.value })
                    }
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choose Association --</option>
                    {associations.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.city || 'Tamil Nadu'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium">Layout Association:</span>
                  <span className="font-bold text-indigo-900">{adminAssoc.name}</span>
                </div>
              )}

              {/* Select User To Assign Or Remove (Both Members and Admins) */}
              {(() => {
                const targetId = adminAssoc?.id || adminForm.association_id;
                const eligibleUsers = usersList
                  .filter((u) => u.role === 'member' || u.role === 'admin')
                  .sort((a, b) => {
                    // Put users belonging to this layout first
                    const aThis = String(a.association_id) === String(targetId) ? 0 : 1;
                    const bThis = String(b.association_id) === String(targetId) ? 0 : 1;
                    if (aThis !== bThis) return aThis - bThis;
                    // Then group by role: members first, then admins
                    if (a.role !== b.role) return a.role === 'member' ? -1 : 1;
                    return (a.name || '').localeCompare(b.name || '');
                  });

                return (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Select User To Assign Or Remove *
                    </label>
                    <select
                      required
                      value={selectedUserId}
                      onChange={(e) => handleSelectUserForAssign(e.target.value)}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Choose a user from list ({eligibleUsers.length} available) --</option>
                      {eligibleUsers.map((u) => {
                        const isCurrentLayout = targetId && String(u.association_id) === String(targetId);
                        const roleText = u.is_main_admin
                          ? 'Main Association Admin'
                          : (u.role === 'admin' ? 'Layout Admin' : 'Resident Member');
                        const assoc = associations.find((a) => String(a.id) === String(u.association_id));
                        const tag = isCurrentLayout
                          ? ' [Current Layout]'
                          : assoc
                          ? ` [${assoc.name}]`
                          : '';

                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email || u.phone}) - {roleText}{tag}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })()}

              {/* Action / Role Selector when user is selected */}
              {selectedUserId && (() => {
                const chosen = usersList.find((u) => String(u.id) === String(selectedUserId));
                if (!chosen) return null;

                const currentRoleBadgeText = chosen.is_main_admin
                  ? 'Main Association Admin'
                  : (chosen.role === 'admin' ? 'Layout Admin' : 'Resident Member');

                return (
                  <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-gray-200">
                      <div>
                        <span className="text-gray-500">Selected User: </span>
                        <span className="font-bold text-gray-900">{chosen.name}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          chosen.is_main_admin
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : (chosen.role === 'admin'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                        }`}
                      >
                        Current Role: {currentRoleBadgeText}
                      </span>
                    </div>

                    <label className="block text-xs font-bold text-gray-700">
                      Choose Action / New Role:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option A: Assign / Promote to Admin */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoleAction('admin')}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                          selectedRoleAction === 'admin'
                            ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500 shadow-xs'
                            : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            selectedRoleAction === 'admin'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          ✓
                        </div>
                        <div>
                          <div className="text-xs font-bold text-indigo-950">
                            Assign as Layout Admin
                          </div>
                          <div className="text-[11px] text-gray-500 leading-tight mt-0.5">
                            Grants full administrator privileges over this association.
                          </div>
                        </div>
                      </button>

                      {/* Option B: Remove as Admin (Demote to Resident Member) */}
                      <button
                        type="button"
                        onClick={() => setSelectedRoleAction('member')}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-2.5 ${
                          selectedRoleAction === 'member'
                            ? 'border-rose-600 bg-rose-50/80 ring-2 ring-rose-500 shadow-xs'
                            : 'border-gray-200 bg-white hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            selectedRoleAction === 'member'
                              ? 'bg-rose-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          ✕
                        </div>
                        <div>
                          <div className="text-xs font-bold text-rose-700">
                            Remove as Admin
                          </div>
                          <div className="text-[11px] text-gray-500 leading-tight mt-0.5">
                            Revokes admin rights; demotes user to regular Resident Member.
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Submit Buttons */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>

                {selectedRoleAction === 'member' ? (
                  <button
                    type="submit"
                    disabled={isAdminLoading || !selectedUserId}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isAdminLoading ? 'Updating...' : 'Remove as Admin (Set to Member)'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isAdminLoading || !selectedUserId}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-md disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isAdminLoading ? 'Assigning...' : 'Confirm Admin Assignment'}
                  </button>
                )}
              </div>
            </form>
        </div>
      </Modal>

      {/* DELETE ASSOCIATION CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteAssoc)}
        onClose={() => setDeleteAssoc(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Layout Association"
        message={`Are you sure you want to permanently delete "${deleteAssoc?.name}"? All related association records will be deleted.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />
    </div>
  );
}
