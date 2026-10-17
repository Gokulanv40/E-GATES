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
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/v1\/?$/, '');
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
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 font-semibold rounded-lg transition"
        >
          <HiEye className="w-3.5 h-3.5" />
          <span>Details</span>
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

      {/* Modal: View Member Details */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Resident Details: ${selectedMember?.name || ''}`}
        size="md"
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-primary-50/60 p-4 rounded-xl border border-primary-100">
              <div className="w-14 h-14 rounded-full bg-primary-600 text-white font-bold text-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                {selectedMember.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{selectedMember.name}</h3>
                <span className="font-mono text-xs font-bold text-primary-700 bg-white px-2 py-0.5 rounded border border-primary-200">
                  Code: {selectedMember.member_code || 'PENDING'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 block">Door / Plot No:</span>
                <span className="font-bold text-gray-900 text-sm">{selectedMember.door_no || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Street / Cross:</span>
                <span className="font-semibold text-gray-800">{selectedMember.street || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Layout / Colony:</span>
                <span className="font-semibold text-gray-800">{selectedMember.layout_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Taluk:</span>
                <span className="font-medium text-gray-800">{selectedMember.taluk || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">District & State:</span>
                <span className="font-medium text-gray-800">
                  {selectedMember.district || '—'}
                  {selectedMember.state ? `, ${selectedMember.state}` : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Phone:</span>
                <span className="font-medium text-gray-800">{selectedMember.phone || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Email:</span>
                <span className="font-medium text-gray-800">{selectedMember.email || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Registration Date:</span>
                <span className="font-medium text-gray-800">
                  {selectedMember.created_at ? format(new Date(selectedMember.created_at), 'dd MMM yyyy') : '—'}
                </span>
              </div>
            </div>

            {/* Document Links */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-2">
                Verification Proofs
              </span>
              <div className="grid grid-cols-2 gap-3">
                {selectedMember.eb_bill_proof ? (
                  <a
                    href={resolveFileUrl(selectedMember.eb_bill_proof)}
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

                {selectedMember.property_tax_receipt ? (
                  <a
                    href={resolveFileUrl(selectedMember.property_tax_receipt)}
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
