import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiPaperClip,
  HiEye,
  HiArrowPath,
  HiArrowTopRightOnSquare,
  HiCheckCircle,
  HiClock,
  HiExclamationTriangle,
  HiPhoto,
  HiUser,
  HiHome,
  HiPhone,
  HiPencilSquare,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import api from '../../services/api';

const STATUS_CONFIG = {
  open: { label: 'Open', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolved', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Closed', bg: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
  medium: { label: 'Medium', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  high: { label: 'High', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  urgent: { label: 'Urgent', badge: 'bg-red-50 text-red-700 border-red-200' },
};

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [previewProof, setPreviewProof] = useState(null); // { url, title }
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [manageStatus, setManageStatus] = useState('open');
  const [managePriority, setManagePriority] = useState('medium');
  const [updating, setUpdating] = useState(false);

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

  const fetchComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/complaints');
      const raw = res.data?.data || res.data || [];
      setComplaints(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load complaints:', err);
      toast.error('Failed to fetch complaints');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Open Manage Modal
  const handleOpenManage = (comp) => {
    setSelectedComplaint(comp);
    setManageStatus(comp.status || 'open');
    setManagePriority(comp.priority || 'medium');
  };

  // Submit Status / Priority Update
  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;

    try {
      setUpdating(true);
      const res = await api.put(`/complaints/${selectedComplaint.id}`, {
        status: manageStatus,
        priority: managePriority,
      });

      if (res.data?.success) {
        toast.success(`Complaint #${selectedComplaint.id} updated successfully`);
        setSelectedComplaint(null);
        fetchComplaints();
      } else {
        toast.error(res.data?.message || 'Failed to update complaint');
      }
    } catch (err) {
      console.error('Update complaint error:', err);
      toast.error(err.response?.data?.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  // Summary counts
  const counts = useMemo(() => {
    return {
      all: complaints.length,
      open: complaints.filter((c) => c.status === 'open').length,
      in_progress: complaints.filter((c) => c.status === 'in_progress').length,
      resolved: complaints.filter((c) => c.status === 'resolved').length,
      closed: complaints.filter((c) => c.status === 'closed').length,
    };
  }, [complaints]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return complaints;
    return complaints.filter((c) => c.status === statusFilter);
  }, [complaints, statusFilter]);

  const columns = [
    {
      header: 'Ticket #',
      accessor: 'id',
      sortable: true,
      render: (id) => (
        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">
          #{id}
        </span>
      ),
    },
    {
      header: 'Title & Category',
      accessor: 'title',
      sortable: true,
      render: (_, row) => (
        <div className="space-y-1">
          <p className="font-medium text-gray-900 text-sm">{row.title}</p>
          <div className="flex items-center gap-2">
            <span className="inline-block text-[11px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
              {row.category || 'General'}
            </span>
            {row.description && (
              <span className="text-xs text-gray-500 truncate max-w-[200px]" title={row.description}>
                {row.description}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Resident',
      accessor: 'user_name',
      sortable: true,
      render: (_, row) => (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-gray-800 flex items-center gap-1">
            <HiUser className="w-3.5 h-3.5 text-gray-400" />
            <span>{row.user_name || 'Resident'}</span>
          </div>
          {row.user_door_no && (
            <div className="text-gray-500 flex items-center gap-1">
              <HiHome className="w-3.5 h-3.5 text-gray-400" />
              <span>Door/Flat: {row.user_door_no}</span>
            </div>
          )}
          {row.user_phone && (
            <div className="text-gray-400 flex items-center gap-1">
              <HiPhone className="w-3.5 h-3.5 text-gray-400" />
              <span>{row.user_phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Priority',
      accessor: 'priority',
      sortable: true,
      render: (priority) => {
        const conf = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${conf.badge}`}
          >
            {conf.label}
          </span>
        );
      },
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      render: (status) => {
        const conf = STATUS_CONFIG[status] || STATUS_CONFIG.open;
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${conf.bg}`}
          >
            {conf.label}
          </span>
        );
      },
    },
    {
      header: 'Attachment Proof',
      accessor: 'attachment',
      render: (attachment, row) => {
        if (!attachment) {
          return <span className="text-xs text-gray-400 italic">No proof</span>;
        }

        const fileUrl = resolveFileUrl(attachment);
        const isPdf = attachment.toLowerCase().endsWith('.pdf');

        return (
          <div className="flex items-center gap-2">
            {!isPdf ? (
              <button
                type="button"
                onClick={() => setPreviewProof({ url: fileUrl, title: `Proof - Ticket #${row.id}: ${row.title}` })}
                className="group relative flex-shrink-0 w-10 h-10 rounded border border-gray-200 overflow-hidden bg-gray-100 hover:ring-2 hover:ring-primary-500 transition"
                title="Click to view attachment proof"
              >
                <img
                  src={fileUrl}
                  alt="Proof"
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setPreviewProof({ url: fileUrl, title: `Proof - Ticket #${row.id}: ${row.title}` })}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition"
            >
              {isPdf ? <HiPaperClip className="w-3.5 h-3.5" /> : <HiEye className="w-3.5 h-3.5" />}
              <span>View Proof</span>
            </button>
          </div>
        );
      },
    },
    {
      header: 'Created',
      accessor: 'created_at',
      sortable: true,
      render: (date) => (
        <span className="text-xs text-gray-500">
          {date ? format(new Date(date), 'dd MMM yyyy, hh:mm a') : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => handleOpenManage(row)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-sm transition"
        >
          <HiPencilSquare className="w-3.5 h-3.5 text-primary-600" />
          <span>Manage</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Complaints Helpdesk</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track and resolve resident grievances, examine attachment proofs, and update ticket statuses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchComplaints}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm"
          >
            <HiArrowPath className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {[
          { key: 'all', label: 'All Tickets', count: counts.all },
          { key: 'open', label: 'Open', count: counts.open, color: 'text-blue-600 bg-blue-50' },
          { key: 'in_progress', label: 'In Progress', count: counts.in_progress, color: 'text-amber-600 bg-amber-50' },
          { key: 'resolved', label: 'Resolved', count: counts.resolved, color: 'text-emerald-600 bg-emerald-50' },
          { key: 'closed', label: 'Closed', count: counts.closed, color: 'text-gray-600 bg-gray-100' },
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : tab.color || 'bg-gray-100 text-gray-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        loading={loading}
        searchPlaceholder="Search complaints by title, resident, ticket #..."
        emptyTitle="No complaints found"
        emptyDescription={
          statusFilter === 'all'
            ? 'Residents have not registered any grievances yet.'
            : `No complaints found with status "${statusFilter.replace('_', ' ')}".`
        }
      />

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

      {/* Manage / Update Ticket Modal */}
      <Modal
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        title={`Manage Complaint #${selectedComplaint?.id}`}
        size="lg"
      >
        {selectedComplaint && (
          <form onSubmit={handleSaveUpdate} className="space-y-5">
            {/* Ticket Info Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900">{selectedComplaint.title}</h3>
                  <span className="inline-block mt-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded border border-primary-200">
                    Category: {selectedComplaint.category || 'General'}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {selectedComplaint.created_at
                    ? format(new Date(selectedComplaint.created_at), 'dd MMM yyyy, hh:mm a')
                    : ''}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">Description</label>
                <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200 whitespace-pre-wrap">
                  {selectedComplaint.description || 'No description provided.'}
                </p>
              </div>

              {/* Resident Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-200/60 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <HiUser className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-800">{selectedComplaint.user_name || 'Resident'}</span>
                </div>
                {selectedComplaint.user_door_no && (
                  <div className="flex items-center gap-1.5">
                    <HiHome className="w-4 h-4 text-gray-400" />
                    <span>Door/Flat: {selectedComplaint.user_door_no}</span>
                  </div>
                )}
                {selectedComplaint.user_phone && (
                  <div className="flex items-center gap-1.5">
                    <HiPhone className="w-4 h-4 text-gray-400" />
                    <span>{selectedComplaint.user_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attachment Proof Viewer Section */}
            {selectedComplaint.attachment ? (
              <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                    <HiPhoto className="w-4 h-4 text-blue-600" />
                    Attachment Proof Attached
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewProof({
                        url: resolveFileUrl(selectedComplaint.attachment),
                        title: `Proof - Ticket #${selectedComplaint.id}: ${selectedComplaint.title}`,
                      })
                    }
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <HiEye className="w-3.5 h-3.5" />
                    <span>Preview Full Size</span>
                  </button>
                </div>

                {!selectedComplaint.attachment.toLowerCase().endsWith('.pdf') ? (
                  <div
                    onClick={() =>
                      setPreviewProof({
                        url: resolveFileUrl(selectedComplaint.attachment),
                        title: `Proof - Ticket #${selectedComplaint.id}: ${selectedComplaint.title}`,
                      })
                    }
                    className="cursor-pointer group relative rounded-lg overflow-hidden border border-gray-300 max-h-48 bg-slate-900 flex items-center justify-center"
                  >
                    <img
                      src={resolveFileUrl(selectedComplaint.attachment)}
                      alt="Attachment Preview"
                      className="max-h-48 object-contain group-hover:opacity-90 transition"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition">
                      Click to expand preview
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-700 font-medium flex items-center gap-2">
                      <HiPaperClip className="w-4 h-4 text-red-500" />
                      PDF Document Attached
                    </span>
                    <a
                      href={resolveFileUrl(selectedComplaint.attachment)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline font-semibold"
                    >
                      Open PDF
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                No attachment proof submitted for this ticket.
              </div>
            )}

            {/* Status & Priority Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ticket Status
                </label>
                <select
                  value={manageStatus}
                  onChange={(e) => setManageStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="open">Open (Under Review)</option>
                  <option value="in_progress">In Progress (Action Initiated)</option>
                  <option value="resolved">Resolved (Issue Fixed)</option>
                  <option value="closed">Closed (Archived)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Priority Level
                </label>
                <select
                  value={managePriority}
                  onChange={(e) => setManagePriority(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updating}
                className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {updating ? 'Saving Changes...' : 'Save & Update Ticket'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
