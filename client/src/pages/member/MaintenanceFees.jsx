import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiCurrencyRupee,
  HiCheckCircle,
  HiClock,
  HiExclamationCircle,
  HiArrowPath,
  HiDocumentText,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import DataTable from '../../components/common/DataTable';
import StatsCard from '../../components/common/StatsCard';

export default function MemberMaintenanceFees() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchFees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/maintenance');
      const raw = res.data?.data || res.data || [];
      setFees(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load maintenance fees:', err);
      toast.error('Failed to load maintenance history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  // Summaries
  const summaries = useMemo(() => {
    let totalDue = 0;
    let totalPaid = 0;

    fees.forEach((f) => {
      const amt = Number(f.amount) || 0;
      if (f.status === 'paid') {
        totalPaid += amt;
      } else {
        totalDue += amt;
      }
    });

    return { totalDue, totalPaid };
  }, [fees]);

  // Filtered
  const filteredFees = useMemo(() => {
    return fees.filter((f) => {
      if (statusFilter === 'all') return true;
      return f.status === statusFilter;
    });
  }, [fees, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
            <HiCheckCircle className="w-3.5 h-3.5 text-green-600" />
            Paid
          </span>
        );
      case 'due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <HiClock className="w-3.5 h-3.5 text-amber-600" />
            Due
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
            <HiExclamationCircle className="w-3.5 h-3.5 text-red-600" />
            Overdue
          </span>
        );
      default:
        return <span className="text-xs text-gray-600">{status}</span>;
    }
  };

  const columns = [
    {
      header: 'Billing Period',
      accessor: 'period',
      sortable: true,
      render: (p) => <span className="text-sm font-bold text-gray-900">{p}</span>,
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
      header: 'Payment Status',
      accessor: 'status',
      sortable: true,
      align: 'center',
      render: (s) => getStatusBadge(s),
    },
    {
      header: 'Paid Date & Reference',
      accessor: 'paid_date',
      sortable: true,
      render: (_, row) => (
        <div>
          {row.paid_date ? (
            <div>
              <p className="text-xs font-semibold text-green-700">
                {format(new Date(row.paid_date), 'dd MMM yyyy')}
              </p>
              {row.payment_reference && (
                <p className="text-[10px] text-gray-400 font-mono">{row.payment_reference}</p>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">Pending payment</span>
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
            Maintenance Dues & Payment History
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review monthly and quarterly layout maintenance invoices, payment receipts, and settlement history.
          </p>
        </div>

        <button
          onClick={fetchFees}
          title="Refresh fees"
          className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition self-start sm:self-auto"
        >
          <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatsCard
          title="Total Outstanding Due"
          value={`₹${summaries.totalDue.toLocaleString('en-IN')}`}
          icon={HiClock}
          variant={summaries.totalDue > 0 ? 'yellow' : 'green'}
          subtitle={summaries.totalDue > 0 ? 'Pending payment settlement' : 'All maintenance cleared'}
        />
        <StatsCard
          title="Total Lifetime Paid"
          value={`₹${summaries.totalPaid.toLocaleString('en-IN')}`}
          icon={HiCheckCircle}
          variant="green"
          subtitle="Cumulative verified payments"
        />
      </div>

      {/* Instructions on payment */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900">
        <p className="font-bold mb-0.5">Payment Instructions:</p>
        <p>
          Maintenance fees can be transferred directly to the association bank account or via layout UPI QR code. Once transferred, provide the transaction reference to the association treasurer or admin to obtain formal reconciliation.
        </p>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredFees}
          loading={loading}
          searchPlaceholder="Search by billing period, reference..."
          emptyTitle="No maintenance records found"
          emptyDescription="Your maintenance fee history will be shown here once generated by the association."
          actions={
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Invoices ({fees.length})</option>
                <option value="due">Due / Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          }
        />
      </div>
    </div>
  );
}
