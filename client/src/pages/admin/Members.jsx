import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiUsers,
  HiEye,
  HiArrowDownTray,
  HiDocumentChartBar,
  HiArrowPath,
  HiEnvelope,
  HiPhone,
  HiHome,
  HiDocumentText,
  HiArrowTopRightOnSquare,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import DigitalIdCardModal from '../../components/common/DigitalIdCardModal';

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState('all');

  // Member detail modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      const raw = res.data?.data || res.data || [];
      // Filter only members
      const list = Array.isArray(raw) ? raw.filter((u) => u.role === 'member') : [];
      setMembers(list);
    } catch (err) {
      console.error('Failed to load members:', err);
      toast.error('Failed to load association members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Export helper
  const handleExport = async (type) => {
    try {
      toast.loading(`Exporting members to ${type.toUpperCase()}...`, { id: 'export-mem' });
      const response = await api.get(`/users/export/${type}`, {
        responseType: 'blob',
      });
      const mime =
        type === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf';

      const blob = new Blob([response.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `association_members_${format(new Date(), 'yyyyMMdd_HHmm')}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} download complete!`, { id: 'export-mem' });
    } catch (err) {
      console.error('Export error:', err);
      toast.error(`Failed to export ${type.toUpperCase()}`, { id: 'export-mem' });
    }
  };

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

  // Filtered
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter === 'all') return true;
      return m.status === statusFilter;
    });
  }, [members, statusFilter]);

  const columns = [
    {
      header: 'Member Code',
      accessor: 'member_code',
      sortable: true,
      render: (code) => (
        <span className="font-mono text-xs font-bold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-md border border-blue-100">
          {code || 'PENDING'}
        </span>
      ),
    },
    {
      header: 'Resident Name',
      accessor: 'name',
      sortable: true,
      render: (_, row) => (
        <div
          onClick={() => {
            setSelectedMember(row);
            setIsDetailModalOpen(true);
          }}
          className="cursor-pointer group"
        >
          <p className="text-sm font-semibold text-gray-900 group-hover:text-primary-600 transition">
            {row.name}
          </p>
          <p className="text-xs text-gray-500">{row.email || 'No email'}</p>
        </div>
      ),
    },
    {
      header: 'Door No & Street',
      accessor: 'door_no',
      sortable: true,
      render: (_, row) => (
        <div>
          <span className="text-xs font-semibold text-gray-800">
            {row.door_no ? `#${row.door_no}` : '—'}
          </span>
          <p className="text-[11px] text-gray-500 truncate max-w-xs">{row.street || row.layout_name || ''}</p>
        </div>
      ),
    },
    {
      header: 'Phone',
      accessor: 'phone',
      sortable: true,
      render: (phone) => <span className="text-xs text-gray-700 font-medium">{phone || '—'}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      align: 'center',
      render: (status) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            status === 'approved'
              ? 'bg-green-100 text-green-800'
              : status === 'pending'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {status}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <button
          onClick={() => {
            setSelectedMember(row);
            setIsDetailModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200/80 hover:bg-teal-100 font-bold rounded-lg transition shadow-2xs"
          title="View Official Digital ID Badge"
        >
          <span>🪪</span>
          <span>Digital ID</span>
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
            <HiUsers className="w-7 h-7 text-primary-600" />
            Association Residents & Members
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete member roster, door allocations, contact directory, and official exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchMembers}
            title="Refresh members"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>

          <button
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <HiArrowDownTray className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            <HiDocumentChartBar className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredMembers}
          loading={loading}
          searchPlaceholder="Search by member code, name, door, phone..."
          emptyTitle="No members found"
          emptyDescription="Residents registered with this association will appear here."
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All ({members.length})</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          }
        />
      </div>

      {/* Digital ID Modal */}
      <DigitalIdCardModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        user={selectedMember}
      />
    </div>
  );
}
