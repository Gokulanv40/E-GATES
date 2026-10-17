import React, { useState, useEffect } from 'react';
import DataTable from '../../components/common/DataTable';
import api from '../../services/api';

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/complaints')
      .then((res) => setComplaints(res.data?.data || []))
      .catch((err) => console.warn(err))
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    { header: 'Ticket #', accessor: 'id', sortable: true },
    { header: 'Title', accessor: 'title', sortable: true },
    { header: 'Priority', accessor: 'priority' },
    { header: 'Status', accessor: 'status' },
    { header: 'Created', accessor: 'created_at', sortable: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Complaints Helpdesk</h1>
        <p className="text-sm text-gray-500">Track and resolve resident grievances and maintenance tickets.</p>
      </div>
      <DataTable columns={columns} data={complaints} loading={loading} />
    </div>
  );
}
