import React, { useState, useEffect } from 'react';
import {
  HiClipboardDocumentList,
  HiTrash,
  HiArrowPath,
  HiMagnifyingGlass,
  HiFunnel,
  HiShieldCheck,
} from 'react-icons/hi2';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

export default function AuditLog() {
  const { t } = useLanguage();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Delete Entry / Clear All
  const [deleteEntry, setDeleteEntry] = useState(null); // entry object
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit?limit=100');
      setLogs(res.data?.data || []);
    } catch (err) {
      console.warn('Error fetching audit logs:', err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDeleteEntry = async () => {
    if (!deleteEntry) return;
    try {
      setIsDeleting(true);
      await api.delete(`/audit/${deleteEntry.id}`);
      toast.success(`Audit log #${deleteEntry.id} removed`);
      setDeleteEntry(null);
      fetchLogs();
    } catch (err) {
      toast.error('Failed to delete audit log entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setIsDeleting(true);
      await api.delete('/audit');
      toast.success('All audit logs cleared successfully');
      setIsClearAllOpen(false);
      fetchLogs();
    } catch (err) {
      toast.error('Failed to clear audit logs');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.ip_address?.includes(q) ||
      log.entity_type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <HiClipboardDocumentList className="w-6 h-6" />
            </span>
            <span>{t('nav_audit_log') || 'System Audit Trail & Security Logs'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Immutable tracking of approvals, data edits, role updates, and deletions across all associations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchLogs}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition"
            title="Refresh Logs"
          >
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearAllOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <HiTrash className="w-4 h-4" />
              <span>Clear All Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4 transition-colors">
        <div className="relative w-full sm:w-80">
          <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search action, user, IP address..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
          Showing {filteredLogs.length} records
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {loading ? 'Loading audit trail...' : 'No audit records found.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4"># ID</th>
                  <th className="py-3 px-4">{t('col_action') || 'Action / Operation'}</th>
                  <th className="py-3 px-4">{t('col_user_name') || 'Performed By'}</th>
                  <th className="py-3 px-4">{t('col_association') || 'Association'}</th>
                  <th className="py-3 px-4">{t('col_ip_address') || 'IP Address'}</th>
                  <th className="py-3 px-4">{t('col_timestamp') || 'Timestamp'}</th>
                  <th className="py-3 px-4 text-right">{t('col_actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-500 dark:text-gray-400">
                      #{log.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                        {log.action}
                      </span>
                      {log.entity_type && (
                        <span className="text-[10px] text-gray-400 ml-1.5 uppercase">
                          ({log.entity_type})
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      <p>{log.user_name || 'System / Auto'}</p>
                      <p className="text-[10px] text-gray-400 font-normal">{log.user_email}</p>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-medium">
                      {log.association_name ? `📍 ${log.association_name}` : 'Platform Root'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-500 dark:text-gray-400">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-500 dark:text-gray-400 text-[11px]">
                      {new Date(log.created_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {/* Delete Entry */}
                      <button
                        type="button"
                        onClick={() => setDeleteEntry(log)}
                        className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                        title="Delete Log Entry"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CONFIRM DELETE SINGLE ENTRY */}
      <ConfirmDialog
        isOpen={Boolean(deleteEntry)}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Audit Entry"
        message={`Are you sure you want to delete audit log entry #${deleteEntry?.id} (${deleteEntry?.action})?`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />

      {/* CONFIRM CLEAR ALL */}
      <ConfirmDialog
        isOpen={isClearAllOpen}
        onClose={() => setIsClearAllOpen(false)}
        onConfirm={handleClearAll}
        title="Clear All Audit Trail Logs"
        message="Are you sure you want to completely clear the system audit log? This will delete all historical operation records across associations."
        confirmText={isDeleting ? 'Clearing...' : 'Clear All'}
        variant="danger"
      />
    </div>
  );
}
