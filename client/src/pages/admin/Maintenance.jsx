import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiCurrencyRupee,
  HiPlus,
  HiCheckCircle,
  HiClock,
  HiExclamationCircle,
  HiArrowPath,
  HiUserGroup,
  HiCreditCard,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import StatsCard from '../../components/common/StatsCard';
import Modal from '../../components/common/Modal';

export default function AdminMaintenance() {
  const [fees, setFees] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');

  // Create Fee Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    targetType: 'all', // 'all' or 'single'
    user_id: '',
    amount: '',
    period: `${format(new Date(), 'MMMM yyyy')}`,
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
  });

  // Mark Paid Modal
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);
  const [paidForm, setPaidForm] = useState({
    paid_date: new Date().toISOString().split('T')[0],
    payment_reference: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [feeRes, memberRes] = await Promise.allSettled([
        api.get('/maintenance'),
        api.get('/users'),
      ]);

      if (feeRes.status === 'fulfilled') {
        const raw = feeRes.value.data?.data || feeRes.value.data || [];
        setFees(Array.isArray(raw) ? raw : []);
      }

      if (memberRes.status === 'fulfilled') {
        const rawUsers = memberRes.value.data?.data || memberRes.value.data || [];
        const approved = Array.isArray(rawUsers)
          ? rawUsers.filter((u) => u.role === 'member' && u.status === 'approved')
          : [];
        setMembers(approved);
      }
    } catch (err) {
      console.error('Failed to load maintenance data:', err);
      toast.error('Failed to fetch maintenance fees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute Summaries
  const summaries = useMemo(() => {
    let totalDue = 0;
    let totalCollected = 0;
    let overdueCount = 0;

    fees.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.status === 'paid') {
        totalCollected += amt;
      } else {
        totalDue += amt;
        if (f.status === 'overdue' || (f.due_date && new Date(f.due_date) < new Date())) {
          overdueCount++;
        }
      }
    });

    return { totalDue, totalCollected, overdueCount };
  }, [fees]);

  // Create Fee Submit
  const handleCreateFee = async (e) => {
    e.preventDefault();
    if (!createForm.amount || !createForm.period || !createForm.due_date) {
      toast.error('Amount, period and due date are required');
      return;
    }

    try {
      setSubmitting(true);
      if (createForm.targetType === 'all') {
        // Bulk create for all approved members
        const promises = members.map((m) =>
          api.post('/maintenance', {
            user_id: m.id,
            amount: Number(createForm.amount),
            period: createForm.period.trim(),
            due_date: createForm.due_date,
          })
        );
        await Promise.allSettled(promises);
        toast.success(`Maintenance invoices created for ${members.length} members!`);
      } else {
        if (!createForm.user_id) {
          toast.error('Please select a member');
          setSubmitting(false);
          return;
        }
        await api.post('/maintenance', {
          user_id: Number(createForm.user_id),
          amount: Number(createForm.amount),
          period: createForm.period.trim(),
          due_date: createForm.due_date,
        });
        toast.success('Maintenance fee record created!');
      }

      setIsCreateModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate fee record');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Mark Paid Modal
  const handleOpenMarkPaid = (fee) => {
    setSelectedFee(fee);
    setPaidForm({
      paid_date: new Date().toISOString().split('T')[0],
      payment_reference: '',
    });
    setIsMarkPaidOpen(true);
  };

  // Submit Mark Paid
  const handleConfirmPaid = async (e) => {
    e.preventDefault();
    if (!selectedFee) return;

    try {
      setSubmitting(true);
      await api.put(`/maintenance/${selectedFee.id}`, {
        status: 'paid',
        paid_date: paidForm.paid_date,
        payment_reference: paidForm.payment_reference.trim() || 'Paid (Cash/Bank Transfer)',
      });

      toast.success('Payment recorded successfully!');
      setIsMarkPaidOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update payment status');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered
  const filteredFees = useMemo(() => {
    return fees.filter((f) => {
      const matchStatus = statusFilter === 'all' || f.status === statusFilter;
      const matchMember = memberFilter === 'all' || String(f.user_id) === String(memberFilter);
      return matchStatus && matchMember;
    });
  }, [fees, statusFilter, memberFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">Paid</span>;
      case 'due':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Due</span>;
      case 'overdue':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">Overdue</span>;
      default:
        return <span className="text-xs text-gray-600">{status}</span>;
    }
  };

  const columns = [
    {
      header: 'Resident / Door',
      accessor: 'user_name',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="text-sm font-semibold text-gray-900">{row.user_name || row.member_name || `Member #${row.user_id}`}</p>
          <p className="text-xs text-gray-500">{row.door_no ? `Door #${row.door_no}` : row.phone || ''}</p>
        </div>
      ),
    },
    {
      header: 'Billing Period',
      accessor: 'period',
      sortable: true,
      render: (period) => <span className="text-xs font-bold text-gray-800">{period}</span>,
    },
    {
      header: 'Amount',
      accessor: 'amount',
      sortable: true,
      render: (amt) => (
        <span className="text-sm font-extrabold text-gray-900">
          ₹{Number(amt || 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      header: 'Due Date',
      accessor: 'due_date',
      sortable: true,
      render: (d) => (
        <span className="text-xs text-gray-600">
          {d ? format(new Date(d), 'dd MMM yyyy') : '—'}
        </span>
      ),
    },
    {
      header: 'Paid Date & Ref',
      accessor: 'paid_date',
      sortable: true,
      render: (_, row) => (
        <div>
          {row.paid_date ? (
            <div>
              <p className="text-xs font-medium text-green-700">{format(new Date(row.paid_date), 'dd MMM yyyy')}</p>
              {row.payment_reference && (
                <p className="text-[10px] text-gray-400 font-mono truncate max-w-xs">{row.payment_reference}</p>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">Unpaid</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      align: 'center',
      render: (s) => getStatusBadge(s),
    },
    {
      header: 'Action',
      align: 'right',
      render: (_, row) => (
        <div>
          {row.status !== 'paid' ? (
            <button
              onClick={() => handleOpenMarkPaid(row)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-green-50 text-green-700 hover:bg-green-100 font-semibold rounded-lg border border-green-200 transition"
            >
              <HiCheckCircle className="w-3.5 h-3.5" />
              <span>Mark Paid</span>
            </button>
          ) : (
            <span className="text-xs font-medium text-gray-400 flex items-center justify-end gap-1">
              <HiCheckCircle className="w-4 h-4 text-green-500" />
              Settled
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiCurrencyRupee className="w-7 h-7 text-primary-600" />
            Maintenance Fees & Dues Collection
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate monthly or quarterly layout maintenance bills, track payment receipts, and log transactions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <HiPlus className="w-4 h-4" />
            <span>Generate Invoices</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard
          title="Total Collected"
          value={`₹${summaries.totalCollected.toLocaleString('en-IN')}`}
          icon={HiCheckCircle}
          variant="green"
          subtitle="Settled maintenance"
        />
        <StatsCard
          title="Total Outstanding"
          value={`₹${summaries.totalDue.toLocaleString('en-IN')}`}
          icon={HiClock}
          variant="yellow"
          subtitle="Pending dues"
        />
        <StatsCard
          title="Overdue Accounts"
          value={summaries.overdueCount}
          icon={HiExclamationCircle}
          variant={summaries.overdueCount > 0 ? 'red' : 'blue'}
          subtitle="Past due deadline"
        />
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredFees}
          loading={loading}
          searchPlaceholder="Search by resident name, door, period..."
          emptyTitle="No maintenance records"
          emptyDescription="Click 'Generate Invoices' to issue maintenance dues to residents."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Payment Statuses</option>
                <option value="due">Due Only</option>
                <option value="paid">Paid Only</option>
                <option value="overdue">Overdue Only</option>
              </select>

              <select
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Members ({members.length})</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.door_no ? `#${m.door_no}` : ''})
                  </option>
                ))}
              </select>
            </div>
          }
        />
      </div>

      {/* Modal: Create Maintenance Fee */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Generate Maintenance Invoices"
        size="md"
      >
        <form onSubmit={handleCreateFee} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Issue Invoices To *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, targetType: 'all' })}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                  createForm.targetType === 'all'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                All Approved Residents ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, targetType: 'single' })}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition ${
                  createForm.targetType === 'single'
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
              >
                Specific Resident
              </button>
            </div>
          </div>

          {createForm.targetType === 'single' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Select Member *
              </label>
              <select
                required
                value={createForm.user_id}
                onChange={(e) => setCreateForm({ ...createForm, user_id: e.target.value })}
                className="w-full text-xs px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500"
              >
                <option value="">-- Choose member --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.door_no ? `Door #${m.door_no}` : m.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Amount (INR ₹) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 1500"
              value={createForm.amount}
              onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Period / Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. November 2026 Monthly Maintenance"
              value={createForm.period}
              onChange={(e) => setCreateForm({ ...createForm, period: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Payment Due Date *
            </label>
            <input
              type="date"
              required
              value={createForm.due_date}
              onChange={(e) => setCreateForm({ ...createForm, due_date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
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
              {submitting ? 'Generating...' : 'Confirm Invoices'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Mark Paid */}
      <Modal
        isOpen={isMarkPaidOpen}
        onClose={() => setIsMarkPaidOpen(false)}
        title="Record Payment Receipt"
        size="md"
      >
        {selectedFee && (
          <form onSubmit={handleConfirmPaid} className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
              <p>
                <span className="text-gray-500">Resident: </span>
                <span className="font-bold text-gray-900">{selectedFee.user_name || 'Member'}</span>
              </p>
              <p>
                <span className="text-gray-500">Period: </span>
                <span className="font-semibold text-gray-800">{selectedFee.period}</span>
              </p>
              <p>
                <span className="text-gray-500">Due Amount: </span>
                <span className="font-extrabold text-primary-700">₹{selectedFee.amount}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paidForm.paid_date}
                onChange={(e) => setPaidForm({ ...paidForm, paid_date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Payment Mode / Reference ID
              </label>
              <input
                type="text"
                placeholder="e.g. UPI Ref #2394829384, GooglePay, Cash Receipt #42"
                value={paidForm.payment_reference}
                onChange={(e) =>
                  setPaidForm({ ...paidForm, payment_reference: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsMarkPaidOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {submitting ? 'Recording...' : 'Record Paid'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
