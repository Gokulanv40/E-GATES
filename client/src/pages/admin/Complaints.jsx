import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiExclamationCircle,
  HiEye,
  HiArrowPath,
  HiPaperClip,
  HiCheckCircle,
  HiClock,
  HiArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Detail / Update Modal
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('open');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/complaints');
      const raw = res.data?.data || res.data || [];
      setComplaints(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load complaints:', err);
      toast.error('Failed to load complaints');
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
    return `${base}/${filePath.replace(/\\/g, '/').replace(/^\/?/, '')}`;
  };

  const handleOpenDetail = (complaint) => {
    setSelectedComplaint(complaint);
    setUpdateStatus(complaint.status || 'open');
    setAdminNotes(complaint.notes || '');
    setIsDetailModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    try {
      setSubmitting(true);
      await api.put(`/complaints/${selectedComplaint.id}`, {
        status: updateStatus,
        notes: adminNotes.trim(),
      });
      toast.success('Complaint status updated!');
      setIsDetailModalOpen(false);
      fetchComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update complaint status');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchPriority = priorityFilter === 'all' || c.priority === priorityFilter;
      const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
      return matchStatus && matchPriority && matchCategory;
    });
  }, [complaints, statusFilter, priorityFilter, categoryFilter]);

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

  const columns = [
    {
      header: 'Complaint & Title',
      accessor: 'title',
      sortable: true,
      render: (_, row) => (
        <div onClick={() => handleOpenDetail(row)} className="cursor-pointer group">
          <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition">
            {row.title}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1">{row.description}</p>
        </div>
      ),
    },
    {
      header: 'Resident',
      accessor: 'user_name',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="text-xs font-semibold text-gray-900">{row.user_name || row.member_name || 'Resident'}</p>
          <p className="text-[11px] text-gray-500">
            {row.door_no ? `Door #${row.door_no}` : row.user_phone || ''}
          </p>
        </div>
      ),
    },
    {
      header: 'Category',
      accessor: 'category',
      sortable: true,
      render: (cat) => <span className="text-xs text-gray-700 font-medium">{cat || 'General'}</span>,
    },
    {
      header: 'Priority',
      accessor: 'priority',
      sortable: true,
      align: 'center',
      render: (p) => getPriorityBadge(p),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      align: 'center',
      render: (s) => getStatusBadge(s),
    },
    {
      header: 'Filed Date',
      accessor: 'created_at',
      sortable: true,
      render: (d) => (
        <span className="text-xs text-gray-500">
          {d ? format(new Date(d), 'dd MMM yyyy') : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => handleOpenDetail(row)}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 font-semibold rounded-lg transition"
        >
          <HiEye className="w-3.5 h-3.5" />
          <span>Manage</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiExclamationCircle className="w-7 h-7 text-amber-500" />
            Resident Grievances & Complaints
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track resident issues, assign repair priorities, log progress updates, and mark tickets resolved.
          </p>
        </div>

        <button
          onClick={fetchComplaints}
          title="Refresh"
          className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition self-start sm:self-auto"
        >
          <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredComplaints}
          loading={loading}
          searchPlaceholder="Search complaints by title, resident, description..."
          emptyTitle="No complaints found"
          emptyDescription="There are no tickets matching the selected filters."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Statuses ({complaints.length})</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Categories</option>
                <option value="Water Supply">Water Supply</option>
                <option value="Street Lights">Street Lights</option>
                <option value="Garbage/Sanitation">Garbage / Sanitation</option>
                <option value="Road/Drainage">Road / Drainage</option>
                <option value="Security">Security</option>
                <option value="Other">Other</option>
              </select>
            </div>
          }
        />
      </div>

      {/* Modal: Complaint Details & Status Update */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Grievance Ticket #${selectedComplaint?.id || ''}`}
        size="lg"
      >
        {selectedComplaint && (
          <form onSubmit={handleUpdateStatus} className="space-y-5">
            {/* Ticket Header Bar */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Category: {selectedComplaint.category || 'General'}
                </span>
                <h3 className="text-base font-bold text-gray-900">{selectedComplaint.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {getPriorityBadge(selectedComplaint.priority)}
                {getStatusBadge(selectedComplaint.status)}
              </div>
            </div>

            {/* Resident & Filing details */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 block">Complainant:</span>
                <span className="font-semibold text-gray-900">
                  {selectedComplaint.user_name || selectedComplaint.member_name || 'Resident'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Door / Flat:</span>
                <span className="font-semibold text-gray-900">
                  {selectedComplaint.door_no ? `#${selectedComplaint.door_no}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Contact Phone:</span>
                <span className="font-medium text-gray-800">{selectedComplaint.user_phone || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Filed On:</span>
                <span className="font-medium text-gray-800">
                  {selectedComplaint.created_at
                    ? format(new Date(selectedComplaint.created_at), 'dd MMM yyyy, hh:mm a')
                    : '—'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1">
                Grievance Description
              </span>
              <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200 whitespace-pre-wrap leading-relaxed">
                {selectedComplaint.description}
              </p>
            </div>

            {/* Photo / Document Proof Attachment */}
            {selectedComplaint.attachment && (
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1">
                  Attached Photo / Document Proof
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={resolveFileUrl(selectedComplaint.attachment)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-semibold border border-primary-200 transition"
                  >
                    <HiPaperClip className="w-4 h-4" />
                    <span>View Attached Proof File</span>
                    <HiArrowTopRightOnSquare className="w-3.5 h-3.5 ml-1" />
                  </a>
                </div>
              </div>
            )}

            {/* Status Update Form */}
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                Update Ticket Status & Progress Notes
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status *</label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 font-semibold"
                  >
                    <option value="open">🔴 Open (Pending Action)</option>
                    <option value="in_progress">🟡 In Progress (Technician Assigned)</option>
                    <option value="resolved">🟢 Resolved (Work Completed)</option>
                    <option value="closed">⚪ Closed (Verified & Dismissed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Internal Reply / Resolution Note
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Electrician fixed streetlamp fuse on 16th Oct."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {submitting ? 'Updating...' : 'Save Ticket Status'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
