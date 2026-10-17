import React, { useState, useEffect } from 'react';
import DataTable from '../../components/common/DataTable';
import api from '../../services/api';

export default function AdminMaintenance() {
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
    { header: 'User ID', accessor: 'user_id' },
    { header: 'Amount (₹)', accessor: 'amount', sortable: true },
    { header: 'Due Date', accessor: 'due_date' },
    { header: 'Status', accessor: 'status' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Fee Records</h1>
        <p className="text-sm text-gray-500">Track fee collections, generate dues, and monitor payment statuses.</p>
      </div>
      <DataTable columns={columns} data={fees} loading={loading} />
    </div>
  );
}
