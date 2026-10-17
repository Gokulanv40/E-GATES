import React, { useState, useEffect } from 'react';
import {
  HiExclamationCircle,
  HiMapPin,
  HiTrash,
  HiCheckCircle,
  HiArrowPath,
  HiFunnel,
  HiMagnifyingGlass,
  HiArrowTopRightOnSquare,
  HiClock,
  HiBuildingOffice2,
} from 'react-icons/hi2';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

export default function SOSReports() {
  const { t } = useLanguage();

  const [alerts, setAlerts] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedAssocId, setSelectedAssocId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Alert for Details Modal
  const [detailAlert, setDetailAlert] = useState(null);

  // Delete Alert State
  const [deleteAlert, setDeleteAlert] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [alertsRes, assocRes] = await Promise.all([
        api.get('/sos/alerts'),
        api.get('/associations'),
      ]);
      setAlerts(alertsRes.data?.data || []);
      setAssociations(assocRes.data?.data || []);
    } catch (err) {
      console.warn('Error fetching SOS reports:', err);
      toast.error('Failed to load SOS reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered alerts
  const filteredAlerts = alerts.filter((a) => {
    const matchesAssoc =
      selectedAssocId === 'all' || String(a.association_id) === String(selectedAssocId);
    const matchesStatus = selectedStatus === 'all' || a.status === selectedStatus;
    const matchesSearch =
      !searchTerm ||
      a.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.user_phone?.includes(searchTerm) ||
      a.user_member_code?.includes(searchTerm) ||
      a.emergency_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.association_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAssoc && matchesStatus && matchesSearch;
  });

  // Handle Delete Alert
  const handleConfirmDelete = async () => {
    if (!deleteAlert) return;
    try {
      setIsDeleting(true);
      await api.delete(`/sos/alerts/${deleteAlert.id}`);
      toast.success(`SOS Alert record #${deleteAlert.id} deleted successfully`);
      setDeleteAlert(null);
      if (detailAlert?.id === deleteAlert.id) setDetailAlert(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete SOS alert record');
    } finally {
      setIsDeleting(false);
    }
  };

  const getEmergencyBadge = (type) => {
    switch (type) {
      case 'Medical':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Fire':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800';
      case 'Theft/Intruder':
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800';
      case 'Women Safety':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800';
      default:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'triggered':
        return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 font-black animate-pulse';
      case 'acknowledged':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 font-bold';
      case 'resolved':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 font-bold';
      case 'false_alarm':
        return 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300 font-semibold';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <HiExclamationCircle className="w-6 h-6" />
            </span>
            <span>{t('nav_sos_reports') || 'SOS Emergency Reports & Distress Logs'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time GPS distress signals, resident identity verification, and escalation audits across associations.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition self-start sm:self-auto"
          title="Refresh Reports"
        >
          <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <HiFunnel className="w-4 h-4 text-gray-400" />
          
          {/* Association Filter */}
          <select
            value={selectedAssocId}
            onChange={(e) => setSelectedAssocId(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">🌐 {t('all_associations') || 'All Associations'}</option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                📍 {a.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Alert Statuses</option>
            <option value="triggered">Active Distress (Triggered)</option>
            <option value="acknowledged">Acknowledged (En Route)</option>
            <option value="resolved">Resolved</option>
            <option value="false_alarm">False Alarm</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search resident, phone, type..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Loading SOS distress logs...' : 'No emergency distress signals found.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4"># Alert ID</th>
                  <th className="py-3 px-4">{t('col_emergency_type') || 'Emergency Type'}</th>
                  <th className="py-3 px-4">{t('col_user_details') || 'Resident Name & Code'}</th>
                  <th className="py-3 px-4">{t('col_association') || 'Association / Layout'}</th>
                  <th className="py-3 px-4">{t('col_location') || 'GPS Location'}</th>
                  <th className="py-3 px-4 text-center">{t('col_status') || 'Status'}</th>
                  <th className="py-3 px-4">{t('col_triggered_at') || 'Triggered At'}</th>
                  <th className="py-3 px-4 text-right">{t('col_actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredAlerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="hover:bg-red-50/30 dark:hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-800 dark:text-gray-200">
                      #{alert.id}
                      {alert.is_test && (
                        <span className="block text-[9px] text-amber-500 uppercase font-black">
                          [Test Mode]
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${getEmergencyBadge(
                          alert.emergency_type
                        )}`}
                      >
                        {alert.emergency_type || 'General Distress'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      <p>{alert.user_name || 'Resident'}</p>
                      <p className="text-[10px] text-gray-400 font-mono font-normal">
                        Code: {alert.user_member_code ? `#${alert.user_member_code}` : 'N/A'} • Door:{' '}
                        {alert.user_door_no || 'N/A'}
                      </p>
                      <p className="text-[10px] text-primary-600 dark:text-primary-400 font-mono">
                        📞 {alert.user_phone || 'N/A'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300 font-medium">
                      📍 {alert.association_name || 'Association'}
                    </td>
                    <td className="py-3.5 px-4">
                      {alert.latitude && alert.longitude ? (
                        <a
                          href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 hover:bg-red-100 rounded-lg text-xs font-semibold transition"
                          title="View exact GPS location on Google Maps"
                        >
                          <HiMapPin className="w-3.5 h-3.5 text-red-500" />
                          <span>View Map</span>
                          <HiArrowTopRightOnSquare className="w-3 h-3 text-red-400" />
                        </a>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">No GPS captured</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${getStatusBadge(
                          alert.status
                        )}`}
                      >
                        {alert.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400 text-[11px] font-mono">
                      {new Date(alert.created_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View Full Details Button */}
                        <button
                          type="button"
                          onClick={() => setDetailAlert(alert)}
                          className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                          title="View Full Distress Details"
                        >
                          <HiBuildingOffice2 className="w-4 h-4" />
                        </button>

                        {/* Delete Alert Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteAlert(alert)}
                          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          title="Delete Alert Record"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FULL DISTRESS DETAILS MODAL */}
      <Modal
        isOpen={Boolean(detailAlert)}
        onClose={() => setDetailAlert(null)}
        title={`🚨 Distress Alert #${detailAlert?.id} Detailed Record`}
        size="lg"
      >
        {detailAlert && (
          <div className="space-y-4 text-xs">
            {/* Top Alert Banner */}
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">
                  Emergency Nature
                </span>
                <span className="text-base font-black text-red-900 dark:text-red-200">
                  {detailAlert.emergency_type}
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs uppercase font-black ${getStatusBadge(
                  detailAlert.status
                )}`}
              >
                {detailAlert.status}
              </span>
            </div>

            {/* Resident Information Grid */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Resident Name</span>
                <span className="font-bold text-gray-900 dark:text-white text-sm">{detailAlert.user_name}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Member Code</span>
                <span className="font-mono font-bold text-primary-600 dark:text-primary-400">
                  {detailAlert.user_member_code ? `#${detailAlert.user_member_code}` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Primary Phone</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {detailAlert.user_phone}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Email Address</span>
                <span className="text-gray-700 dark:text-gray-300">{detailAlert.user_email || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Registered Address</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  Door #{detailAlert.user_door_no || 'N/A'}, {detailAlert.user_street || ''} (
                  {detailAlert.association_name})
                </span>
              </div>
            </div>

            {/* GPS Location & Map Box */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40">
              <span className="text-blue-600 dark:text-blue-400 block text-[10px] uppercase font-bold mb-1">
                Distress Signal Coordinates (Browser GPS)
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-gray-800 dark:text-gray-200 font-bold">
                    Latitude: {detailAlert.latitude || 'Not Captured'} • Longitude:{' '}
                    {detailAlert.longitude || 'Not Captured'}
                  </p>
                </div>
                {detailAlert.latitude && detailAlert.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${detailAlert.latitude},${detailAlert.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-sm"
                  >
                    <HiMapPin className="w-4 h-4" />
                    <span>Open in Google Maps</span>
                  </a>
                )}
              </div>
            </div>

            {/* Response Timeline */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 text-[11px]">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Triggered At</span>
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {new Date(detailAlert.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Acknowledged By</span>
                <span className="font-bold text-gray-800 dark:text-gray-200">
                  {detailAlert.acknowledged_by_name || 'Pending Response'}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Response Time</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {detailAlert.response_time_seconds
                    ? `${detailAlert.response_time_seconds} seconds`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {detailAlert.notes && (
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700">
                <span className="text-gray-400 block text-[10px] uppercase font-bold mb-1">
                  Resolution Notes
                </span>
                <p className="text-gray-800 dark:text-gray-200">{detailAlert.notes}</p>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailAlert(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteAlert)}
        onClose={() => setDeleteAlert(null)}
        onConfirm={handleConfirmDelete}
        title="Delete SOS Emergency Record"
        message={`Are you sure you want to permanently delete SOS alert record #${deleteAlert?.id}? This action will permanently remove it from the historical distress log.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />
    </div>
  );
}
