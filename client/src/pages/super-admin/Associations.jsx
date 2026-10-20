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
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function Associations() {
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Single Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssoc, setEditingAssoc] = useState(null);
  const [formName, setFormName] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLogo, setFormLogo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toggle Confirm Dialog State
  const [toggleAssoc, setToggleAssoc] = useState(null);
  const [isToggleConfirmOpen, setIsToggleConfirmOpen] = useState(false);

  // Delete Association Confirm State
  const [deleteAssoc, setDeleteAssoc] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Assign Admin Modal State
  const [assignAssoc, setAssignAssoc] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAssignLoading, setIsAssignLoading] = useState(false);

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

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingAssoc(null);
    setFormName('');
    setFormCity('');
    setFormAddress('');
    setFormLogo(null);
    setIsModalOpen(true);
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

  // Submit Single Create / Update
  const handleSubmitSingle = async (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Association name is required');
      return;
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
        await api.post('/associations', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success(`Association "${formName}" added successfully!`);
      }

      setIsModalOpen(false);
      fetchAssociations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
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

  // Open Assign Admin Modal
  const handleOpenAssignAdmin = async (assoc) => {
    setAssignAssoc(assoc);
    setSelectedUserId('');
    try {
      setIsAssignLoading(true);
      const res = await api.get('/users');
      setUsersList(res.data?.data || []);
    } catch (err) {
      toast.error('Could not load users list');
    } finally {
      setIsAssignLoading(false);
    }
  };

  const handleAssignAdminSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a user to assign as admin');
      return;
    }
    try {
      setIsAssignLoading(true);
      await api.put(`/associations/${assignAssoc.id}/assign-admin`, {
        user_id: parseInt(selectedUserId, 10),
      });
      toast.success(`Admin assigned to ${assignAssoc.name}!`);
      setAssignAssoc(null);
      fetchAssociations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign admin');
    } finally {
      setIsAssignLoading(false);
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


          {/* Single Add Association Button */}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-md transition"
          >
            <HiPlus className="w-5 h-5" />
            <span>Add Association</span>
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
                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem] mb-4">
                  {assoc.address || 'Address details not provided.'}
                </p>

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
                  onClick={() => handleOpenAssignAdmin(assoc)}
                  className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition flex items-center gap-1"
                  title="Assign Admin"
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

      {/* SINGLE ASSOCIATION CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssoc ? 'Edit Association' : 'Add New Layout Association'}
        size="md"
      >
        <form onSubmit={handleSubmitSingle} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Association / Layout Name *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Greenfield Residents Welfare Association"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              City / Taluk *
            </label>
            <input
              type="text"
              required
              value={formCity}
              onChange={(e) => setFormCity(e.target.value)}
              placeholder="e.g. Coimbatore"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Layout Full Address
            </label>
            <textarea
              rows={3}
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="Door No, Street, Ward, District, PIN..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Association Logo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFormLogo(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl transition shadow-md disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingAssoc ? 'Update Association' : 'Save Association'}
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

      {/* ASSIGN ADMIN MODAL */}
      <Modal
        isOpen={!!assignAssoc}
        onClose={() => setAssignAssoc(null)}
        title={`Assign Administrator for ${assignAssoc?.name}`}
        size="md"
      >
        <form onSubmit={handleAssignAdminSubmit} className="space-y-4">
          <p className="text-xs text-gray-500">
            Select an approved user from the system to serve as the Layout Administrator.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Select User *
            </label>
            <select
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">-- Choose a user --</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email || u.phone}) - Current Role: {u.role}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={() => setAssignAssoc(null)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAssignLoading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-md disabled:opacity-50"
            >
              {isAssignLoading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
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
