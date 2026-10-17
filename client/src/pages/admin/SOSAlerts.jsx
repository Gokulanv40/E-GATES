import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiShieldExclamation,
  HiMapPin,
  HiPhone,
  HiClock,
  HiEye,
  HiCheckCircle,
  HiCheck,
  HiXCircle,
  HiArrowPath,
  HiExclamationCircle,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';

export default function AdminSOSAlerts() {
  const { socket, isConnected } = useSocket();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  // Details Modal
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Resolve Modal
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [targetAlert, setTargetAlert] = useState(null);
  const [resolveType, setResolveType] = useState('resolved'); // 'resolved' | 'false_alarm'
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/sos/alerts');
      const raw = res.data?.data || res.data || [];
      setAlerts(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load SOS alerts:', err);
      toast.error('Failed to load SOS alert history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Socket.io real-time listener
  useEffect(() => {
    if (!socket) return;

    const handleTrigger = (newAlert) => {
      // Audio siren notification if browser allows
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(() => {});
      } catch (e) {}

      toast.error(`EMERGENCY: ${newAlert.user_name || 'Resident'} triggered an SOS alert!`, {
        duration: 8000,
        style: {
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      });
      fetchAlerts();
    };

    const handleAcknowledge = () => {
      fetchAlerts();
    };

    const handleResolve = () => {
      fetchAlerts();
    };

    socket.on('sos:trigger', handleTrigger);
    socket.on('sos:acknowledge', handleAcknowledge);
    socket.on('sos:resolve', handleResolve);

    return () => {
      socket.off('sos:trigger', handleTrigger);
      socket.off('sos:acknowledge', handleAcknowledge);
      socket.off('sos:resolve', handleResolve);
    };
  }, [socket, fetchAlerts]);

  // Acknowledge Action
  const handleAcknowledge = async (alertId) => {
    try {
      setActionLoading(true);
      await api.put(`/sos/${alertId}/acknowledge`);
      toast.success('Alert acknowledged. Team notified!');
      fetchAlerts();
      if (selectedAlert && selectedAlert.id === alertId) {
        setIsDetailModalOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge alert');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Resolve Modal
  const handleOpenResolve = (alert, type = 'resolved') => {
    setTargetAlert(alert);
    setResolveType(type);
    setResolveNotes('');
    setIsResolveModalOpen(true);
  };

  // Submit Resolve
  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!targetAlert) return;

    try {
      setActionLoading(true);
      await api.put(`/sos/${targetAlert.id}/resolve`, {
        status: resolveType,
        notes: resolveNotes.trim(),
      });

      toast.success(
        resolveType === 'resolved'
          ? 'Incident marked as successfully resolved!'
          : 'Incident marked as false alarm.'
      );
      setIsResolveModalOpen(false);
      setIsDetailModalOpen(false);
      fetchAlerts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve incident');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchType = typeFilter === 'all' || a.emergency_type === typeFilter;
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;

      let matchDate = true;
      if (dateFilter) {
        const d = a.created_at ? new Date(a.created_at).toISOString().split('T')[0] : '';
        matchDate = d === dateFilter;
      }
      return matchType && matchStatus && matchDate;
    });
  }, [alerts, typeFilter, statusFilter, dateFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'triggered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            TRIGGERED
          </span>
        );
      case 'acknowledged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            Acknowledged
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
            <span className="w-2 h-2 rounded-full bg-green-600" />
            Resolved
          </span>
        );
      case 'false_alarm':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            False Alarm
          </span>
        );
      default:
        return <span className="text-xs font-medium text-gray-600">{status}</span>;
    }
  };

  const columns = [
    {
      header: 'Date & Time',
      accessor: 'created_at',
      sortable: true,
      render: (date) => (
        <span className="text-xs font-medium text-gray-900">
          {date ? format(new Date(date), 'dd MMM yyyy, hh:mm a') : '—'}
        </span>
      ),
    },
    {
      header: 'Resident / Caller',
      accessor: 'user_name',
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {row.user_name || row.member_name || `Member #${row.user_id}`}
          </p>
          <p className="text-xs text-gray-500">{row.user_phone || row.door_no ? `Door: #${row.door_no}` : ''}</p>
        </div>
      ),
    },
    {
      header: 'Emergency Type',
      accessor: 'emergency_type',
      sortable: true,
      align: 'center',
      render: (type) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          {type || 'Other'}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      align: 'center',
      render: (status) => getStatusBadge(status),
    },
    {
      header: 'Location',
      align: 'center',
      render: (_, row) => {
        if (!row.latitude || !row.longitude) {
          return <span className="text-xs text-gray-400">No GPS</span>;
        }
        return (
          <a
            href={`https://maps.google.com/?q=${row.latitude},${row.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold"
          >
            <HiMapPin className="w-4 h-4 text-red-500" />
            <span>Map</span>
          </a>
        );
      },
    },
    {
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => {
              setSelectedAlert(row);
              setIsDetailModalOpen(true);
            }}
            title="View Details"
            className="p-1.5 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
          >
            <HiEye className="w-4 h-4" />
          </button>

          {row.status === 'triggered' && (
            <button
              onClick={() => handleAcknowledge(row.id)}
              disabled={actionLoading}
              title="Acknowledge Alert"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <HiClock className="w-3.5 h-3.5" />
              <span>Acknowledge</span>
            </button>
          )}

          {(row.status === 'triggered' || row.status === 'acknowledged') && (
            <>
              <button
                onClick={() => handleOpenResolve(row, 'resolved')}
                disabled={actionLoading}
                title="Mark as Resolved"
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                <HiCheck className="w-3.5 h-3.5" />
                <span>Resolve</span>
              </button>

              <button
                onClick={() => handleOpenResolve(row, 'false_alarm')}
                disabled={actionLoading}
                title="Mark False Alarm"
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
              >
                <span>False Alarm</span>
              </button>
            </>
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <HiShieldExclamation className="w-7 h-7 text-red-600" />
              Live Association SOS Alerts
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-600 animate-pulse' : 'bg-gray-400'}`} />
              {isConnected ? 'Socket Live' : 'Connecting'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time emergency monitoring, incident dispatch management, responder logging, and resolution tracking.
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          title="Refresh alerts"
          className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition self-start sm:self-auto"
        >
          <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredAlerts}
          loading={loading}
          searchPlaceholder="Search by resident name, door, emergency type..."
          emptyTitle="No SOS alerts"
          emptyDescription="There are currently no recorded emergency triggers for this association."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Emergency Types</option>
                <option value="Medical">Medical</option>
                <option value="Fire">Fire</option>
                <option value="Theft/Intruder">Theft/Intruder</option>
                <option value="Women Safety">Women Safety</option>
                <option value="Other">Other</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All Statuses</option>
                <option value="triggered">Triggered</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
                <option value="false_alarm">False Alarm</option>
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700"
                title="Filter by date"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear Date
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Modal: Incident Details & Live Map */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`SOS Alert #${selectedAlert?.id || ''}`}
        size="lg"
      >
        {selectedAlert && (
          <div className="space-y-5">
            {/* Top alert bar */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="text-xs text-gray-500 block">Emergency Type</span>
                <span className="text-lg font-bold text-gray-900">{selectedAlert.emergency_type || 'Other'}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500 block mb-0.5">Status</span>
                {getStatusBadge(selectedAlert.status)}
              </div>
            </div>

            {/* Resident Info & Map Coordinates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                  Resident Contact
                </span>
                <p>
                  <span className="text-gray-500">Name: </span>
                  <span className="font-semibold text-gray-800">{selectedAlert.user_name || 'Member'}</span>
                </p>
                <p>
                  <span className="text-gray-500">Phone: </span>
                  <a
                    href={`tel:${selectedAlert.user_phone}`}
                    className="font-bold text-primary-600 hover:underline"
                  >
                    {selectedAlert.user_phone || '—'}
                  </a>
                </p>
                <p>
                  <span className="text-gray-500">Address: </span>
                  <span className="font-medium text-gray-800">
                    {selectedAlert.door_no ? `Door #${selectedAlert.door_no}` : ''}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Trigger Time: </span>
                  <span className="font-medium text-gray-800">
                    {selectedAlert.created_at
                      ? format(new Date(selectedAlert.created_at), 'dd MMM yyyy, hh:mm:ss a')
                      : '—'}
                  </span>
                </p>
              </div>

              {/* Map embed / preview */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1">
                    GPS Geolocation
                  </span>
                  {selectedAlert.latitude && selectedAlert.longitude ? (
                    <div className="space-y-1">
                      <p className="font-mono text-gray-700">
                        Lat: {selectedAlert.latitude}, Lng: {selectedAlert.longitude}
                      </p>
                      <div className="mt-2 h-28 rounded-lg overflow-hidden border border-gray-200">
                        <iframe
                          title="Alert Location Map"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          src={`https://maps.google.com/maps?q=${selectedAlert.latitude},${selectedAlert.longitude}&z=16&output=embed`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-28 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg italic">
                      No GPS coordinates provided
                    </div>
                  )}
                </div>

                {selectedAlert.latitude && selectedAlert.longitude && (
                  <a
                    href={`https://maps.google.com/?q=${selectedAlert.latitude},${selectedAlert.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-primary-600 hover:text-primary-800 font-semibold text-center block text-xs"
                  >
                    Open in Full Google Maps &rarr;
                  </a>
                )}
              </div>
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedAlert.status === 'triggered' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleAcknowledge(selectedAlert.id)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-sm transition"
                  >
                    Acknowledge Alert
                  </button>
                )}

                {(selectedAlert.status === 'triggered' || selectedAlert.status === 'acknowledged') && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleOpenResolve(selectedAlert, 'resolved')}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      Resolve Incident
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleOpenResolve(selectedAlert, 'false_alarm')}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition"
                    >
                      Mark False Alarm
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Resolve / False Alarm Confirmation */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title={resolveType === 'resolved' ? 'Resolve SOS Incident' : 'Mark as False Alarm'}
        size="md"
      >
        <form onSubmit={handleConfirmResolve} className="space-y-4">
          <p className="text-sm text-gray-600">
            {resolveType === 'resolved'
              ? 'Provide resolution notes or responder action taken for association records.'
              : 'Indicate reason for classifying this alert as an unintentional or false alarm.'}
          </p>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Resolution Incident Notes *
            </label>
            <textarea
              required
              rows={4}
              placeholder="e.g. Police dispatched, verified resident safe, ambulance attended medical need..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setIsResolveModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition ${
                resolveType === 'resolved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-700 hover:bg-gray-800'
              }`}
            >
              {actionLoading ? 'Saving...' : 'Confirm Status'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
