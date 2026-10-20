import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiExclamationCircle,
  HiPlus,
  HiPencilSquare,
  HiTrash,
  HiPaperClip,
  HiEye,
  HiArrowPath,
  HiArrowTopRightOnSquare,
  HiCheckCircle,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

export default function MemberComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [previewProof, setPreviewProof] = useState(null); // { url, title }

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [complaintToDelete, setComplaintToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Water Supply',
    priority: 'medium',
    attachmentFile: null,
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/complaints');
      const raw = res.data?.data || res.data || [];
      setComplaints(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load complaints:', err);
      toast.error('Failed to load your complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

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

  // Open Create
  const handleOpenCreate = () => {
    setFormData({
      title: '',
      description: '',
      category: 'Water Supply',
      priority: 'medium',
      attachmentFile: null,
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit (only if open)
  const handleOpenEdit = (comp) => {
    if (comp.status !== 'open') {
      toast.error('Only open tickets can be edited.');
      return;
    }
    setSelectedComplaint(comp);
    setFormData({
      title: comp.title || '',
      description: comp.description || '',
      category: comp.category || 'Water Supply',
      priority: comp.priority || 'medium',
      attachmentFile: null,
    });
    setIsEditModalOpen(true);
  };

  // Open Details
  const handleOpenDetail = (comp) => {
    setSelectedComplaint(comp);
    setIsDetailModalOpen(true);
  };

  // Create Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('description', formData.description.trim());
      data.append('category', formData.category);
      data.append('priority', formData.priority);

      if (formData.attachmentFile) {
        data.append('attachment', formData.attachmentFile);
      }

      await api.post('/complaints', data);
      toast.success('Grievance ticket submitted to association admin!');
      setIsCreateModalOpen(false);
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit complaint');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('description', formData.description.trim());
      data.append('category', formData.category);
      data.append('priority', formData.priority);

      if (formData.attachmentFile) {
        data.append('attachment', formData.attachmentFile);
      }

      await api.put(`/complaints/${selectedComplaint.id}`, data);
      toast.success('Complaint ticket updated!');
      setIsEditModalOpen(false);
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update complaint');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!complaintToDelete) return;
    try {
      setSubmitting(true);
      await api.delete(`/complaints/${complaintToDelete.id}`);
      toast.success('Complaint withdrawn');
      setIsDeleteConfirmOpen(false);
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete complaint');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter === 'all') return true;
      return c.status === statusFilter;
    });
  }, [complaints, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Open</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">In Progress</span>;
      case 'resolved':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">Resolved</span>;
      case 'closed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">Closed</span>;
      default:
        return <span className="text-xs text-gray-600">{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'urgent':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">URGENT</span>;
      case 'high':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800">High</span>;
      case 'medium':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">Medium</span>;
      case 'low':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">Low</span>;
      default:
        return <span className="text-xs text-gray-600">{priority}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiExclamationCircle className="w-7 h-7 text-amber-500" />
            My Grievance Tickets
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Report maintenance issues, street lighting faults, water distribution issues, and track admin resolution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchComplaints}
            title="Refresh"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <HiPlus className="w-4 h-4" />
            <span>File New Grievance</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'all', label: `All Tickets (${complaints.length})` },
          { id: 'open', label: 'Open' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'closed', label: 'Closed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === tab.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Complaints List Cards */}
      {loading ? (
        <div className="py-24 bg-white rounded-2xl border border-gray-100 text-center">
          <LoadingSpinner message="Loading your grievances..." />
        </div>
      ) : filteredComplaints.length === 0 ? (
        <EmptyState
          title="No grievances found"
          description="You do not have any complaints under the selected filter."
          actionLabel="File a Grievance"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredComplaints.map((comp) => {
            const isOpen = comp.status === 'open';
            return (
              <div
                key={comp.id}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between hover:border-primary-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded">
                        {comp.category || 'General'}
                      </span>
                      {getPriorityBadge(comp.priority)}
                    </div>
                    {getStatusBadge(comp.status)}
                  </div>

                  <div>
                    <h3
                      onClick={() => handleOpenDetail(comp)}
                      className="text-base font-bold text-gray-900 cursor-pointer hover:text-primary-600 transition"
                    >
                      {comp.title}
                    </h3>
                    <p className="text-xs text-gray-600 line-clamp-3 mt-1 whitespace-pre-wrap">
                      {comp.description}
                    </p>
                  </div>

                  {comp.attachment && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewProof({
                            url: resolveFileUrl(comp.attachment),
                            title: `Ticket #${comp.id} - ${comp.title} Proof`,
                          })
                        }
                        className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 hover:underline font-semibold bg-primary-50/70 hover:bg-primary-100/70 px-2.5 py-1 rounded-lg border border-primary-200/60 transition"
                      >
                        <HiPaperClip className="w-3.5 h-3.5" />
                        <span>View Attachment Proof</span>
                      </button>
                    </div>
                  )}

                  {comp.notes && (
                    <div className="bg-blue-50/70 p-2.5 rounded-xl border border-blue-100 text-xs text-blue-900">
                      <span className="font-bold block text-[10px] uppercase text-blue-700 mb-0.5">Admin Response:</span>
                      {comp.notes}
                    </div>
                  )}
                </div>

                {/* Bottom Card Bar */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    Filed: {comp.created_at ? format(new Date(comp.created_at), 'dd MMM yyyy') : '—'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenDetail(comp)}
                      className="text-xs font-semibold text-primary-600 hover:underline px-2 py-1"
                    >
                      Details
                    </button>
                    {isOpen && (
                      <>
                        <button
                          onClick={() => handleOpenEdit(comp)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit Grievance"
                        >
                          <HiPencilSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setComplaintToDelete(comp);
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Withdraw Grievance"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Grievance */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="File Association Grievance"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Complaint Subject / Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Streetlamp not working in 2nd Cross Street"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="Water Supply">Water Supply</option>
                <option value="Street Lights">Street Lights</option>
                <option value="Garbage/Sanitation">Garbage & Sanitation</option>
                <option value="Road/Drainage">Roads & Drainage</option>
                <option value="Security">Security & Patrol</option>
                <option value="Noise/Disturbance">Noise / Disturbance</option>
                <option value="Other">Other Issues</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="low">Low (General Maintenance)</option>
                <option value="medium">Medium (Standard)</option>
                <option value="high">High (Urgent Repair)</option>
                <option value="urgent">Urgent (Safety / Hazard)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description of the Issue *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe the exact location, timing, or nature of the problem..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Photo / Attachment Proof (Optional)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                setFormData({ ...formData, attachmentFile: e.target.files[0] || null })
              }
              className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Submitting...' : 'Submit Grievance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Grievance (Only if open) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Open Grievance"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="Water Supply">Water Supply</option>
                <option value="Street Lights">Street Lights</option>
                <option value="Garbage/Sanitation">Garbage/Sanitation</option>
                <option value="Road/Drainage">Road/Drainage</option>
                <option value="Security">Security</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              rows={4}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Replace Attachment Proof
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) =>
                setFormData({ ...formData, attachmentFile: e.target.files[0] || null })
              }
              className="w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: View Details */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Ticket #${selectedComplaint?.id || ''}`}
        size="md"
      >
        {selectedComplaint && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 block">Category</span>
                <span className="text-sm font-bold text-gray-900">{selectedComplaint.category}</span>
              </div>
              <div className="flex items-center gap-2">
                {getPriorityBadge(selectedComplaint.priority)}
                {getStatusBadge(selectedComplaint.status)}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold text-gray-900">{selectedComplaint.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Filed on:{' '}
                {selectedComplaint.created_at
                  ? format(new Date(selectedComplaint.created_at), 'dd MMM yyyy, hh:mm a')
                  : '—'}
              </p>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
              {selectedComplaint.description}
            </div>

            {selectedComplaint.attachment && (
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-500 block mb-2">Attachment Proof</span>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <img
                    src={resolveFileUrl(selectedComplaint.attachment)}
                    alt="Complaint Attachment"
                    className="w-24 h-24 object-cover rounded-lg border border-gray-300 shadow-sm cursor-pointer hover:opacity-90 transition"
                    onClick={() =>
                      setPreviewProof({
                        url: resolveFileUrl(selectedComplaint.attachment),
                        title: `Ticket #${selectedComplaint.id} - ${selectedComplaint.title}`,
                      })
                    }
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewProof({
                          url: resolveFileUrl(selectedComplaint.attachment),
                          title: `Ticket #${selectedComplaint.id} - ${selectedComplaint.title}`,
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 hover:underline font-semibold"
                    >
                      <HiEye className="w-4 h-4" />
                      <span>Preview Attachment Proof</span>
                    </button>
                    <div>
                      <a
                        href={resolveFileUrl(selectedComplaint.attachment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:underline"
                      >
                        <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                        <span>Open in New Tab</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedComplaint.notes && (
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                <span className="font-bold block text-[11px] uppercase text-emerald-800 mb-1">
                  Administrator Response & Resolution Notes:
                </span>
                <p>{selectedComplaint.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Proof Preview Modal */}
      <Modal
        isOpen={Boolean(previewProof)}
        onClose={() => setPreviewProof(null)}
        title={previewProof?.title || 'Attachment Proof'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] p-2">
            {previewProof?.url?.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={previewProof?.url}
                title="Document Proof"
                className="w-full h-[65vh] border-0"
              />
            ) : (
              <img
                src={previewProof?.url}
                alt="Proof Preview"
                className="max-h-[65vh] max-w-full object-contain mx-auto rounded shadow-lg"
                onError={(e) => {
                  e.target.onerror = null;
                  toast.error('Unable to display image preview.');
                }}
              />
            )}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <a
              href={previewProof?.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
            >
              <HiArrowTopRightOnSquare className="w-4 h-4" />
              <span>Open Original File</span>
            </a>
            <button
              type="button"
              onClick={() => setPreviewProof(null)}
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={submitting}
        title="Withdraw Grievance"
        message={`Are you sure you want to withdraw complaint "${complaintToDelete?.title}"?`}
        confirmText="Yes, Withdraw Ticket"
        isDanger={true}
      />
    </div>
  );
}
