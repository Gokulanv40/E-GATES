import React, { useState, useEffect } from 'react';
import DataTable from '../../components/common/DataTable';
import api from '../../services/api';

export default function MemberMaintenance() {
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/maintenance')
      .then((res) => setFees(res.data?.data || []))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { header: 'Period', accessor: 'period', sortable: true },
    { header: 'Amount (₹)', accessor: 'amount', sortable: true },
    { header: 'Due Date', accessor: 'due_date' },
    {
      header: 'Status',
      accessor: 'status',
      render: (val) => (
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            val === 'paid'
              ? 'bg-green-100 text-green-800'
              : val === 'overdue'
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {val}
        </span>
      ),
    },
    { header: 'Payment Ref', accessor: 'payment_reference' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Fees & Dues</h1>
        <p className="text-sm text-gray-500">View current billing cycle and previous payment receipts.</p>
      </div>
      <DataTable columns={columns} data={fees} loading={loading} />
    </div>
  );
}
