import React, { useState, useEffect } from 'react';
import {
  HiShieldCheck,
  HiCheckCircle,
  HiXCircle,
  HiTrash,
  HiEye,
  HiArrowPath,
  HiDocumentText,
} from 'react-icons/hi2';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function PendingApprovals() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to resolve static file paths to backend URL
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

  // Proof Preview Modal
  const [previewProof, setPreviewProof] = useState(null); // { url, title, type }

  // Reject Modal
  const [rejectUser, setRejectUser] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Delete User Confirm
  const [deleteUser, setDeleteUser] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users/pending');
      setData(res.data?.data || []);
    } catch (err) {
      console.warn('Error fetching pending users:', err);
      toast.error(err.response?.data?.message || 'Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id, name, userObj) => {
    try {
      await api.put(`/users/${id}/approve`);
      const isMain = userObj?.is_main_admin || userObj?.display_role === 'Main Association Admin';
      const roleLabel = isMain
        ? 'Main Association Admin'
        : userObj?.role === 'admin'
        ? 'Layout Admin'
        : 'Resident Member';
      toast.success(`${roleLabel} "${name}" approved successfully! They can now log in.`);
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve user');
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectUser) return;
    try {
      setIsRejecting(true);
      await api.put(`/users/${rejectUser.id}/reject`, { rejection_reason: rejectReason });
      toast.success(`Registration request for "${rejectUser.name}" rejected.`);
      setRejectUser(null);
      setRejectReason('');
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reject registration');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteUser) return;
    try {
      setIsDeleting(true);
      await api.delete(`/users/${deleteUser.id}`);
      toast.success(`User registration "${deleteUser.name}" deleted`);
      setDeleteUser(null);
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete registration');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <HiShieldCheck className="w-6 h-6" />
            </span>
            <span>
              {currentUser?.role === 'super_admin'
                ? 'Pending Association & Main Admin Registrations'
                : 'Pending Resident & Admin Registrations'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentUser?.role === 'super_admin'
              ? 'Approve or reject new Association registrations and their Main Association Admins. (Regular member & layout admin approvals are managed by the Main Association Admin).'
              : currentUser?.is_main_admin
              ? 'Review resident membership and layout administrator applications awaiting your approval as Main Association Admin.'
              : 'Review uploaded EB bills, property tax receipts, and verify registration legitimacy.'}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPending}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition self-start sm:self-auto"
          title="Refresh Pending List"
        >
          <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {currentUser?.role === 'super_admin' && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-blue-900 dark:text-blue-200 text-xs font-medium flex items-center gap-2.5">
          <HiShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <span>
            <strong>Super Admin Scope:</strong> User (resident member) & layout administrator registration approvals are <strong>canceled for Super Admin</strong>. Super Admin exclusively approves new layout Associations and Main Association Admins. Individual resident & admin approvals are handled directly by each layout's Main Association Admin.
          </span>
        </div>
      )}

      {currentUser?.role === 'admin' && !currentUser?.is_main_admin && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
          <HiShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            Approval authority is exclusively granted to the <strong>Main Association Admin</strong> for this layout. Regular administrators do not have approval permissions.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          {data.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {loading
                ? 'Checking for pending approvals...'
                : currentUser?.role === 'super_admin'
                ? 'No pending Association & Main Association Admin registrations.'
                : 'All resident member and layout admin registration requests have been reviewed.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/80 dark:bg-slate-800/60 text-gray-600 dark:text-gray-300 uppercase tracking-wider text-[11px] font-bold border-b border-gray-100 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Applicant Name</th>
                  <th className="py-3 px-4">Association / Layout</th>
                  <th className="py-3 px-4">Contact Phone & Email</th>
                  <th className="py-3 px-4">Door No & Street</th>
                  <th className="py-3 px-4 text-center">Proofs Uploaded</th>
                  <th className="py-3 px-4 text-center">Role Requested</th>
                  <th className="py-3 px-4 text-right">Verification Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-amber-50/30 dark:hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      <p>{user.name}</p>
                      <span className="text-[10px] text-gray-400 font-normal">
                        Registered: {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-700 dark:text-gray-300">
                      📍 {user.association_name || 'Layout Association'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300 font-mono">
                      <p>{user.phone || 'N/A'}</p>
                      <p className="text-[10px] text-gray-400 font-sans">{user.email}</p>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700 dark:text-gray-300">
                      Door #{user.door_no || 'N/A'}, {user.street || ''}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {user.eb_bill_proof ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewProof({
                                url: resolveFileUrl(user.eb_bill_proof),
                                title: `${user.name} - EB Bill Proof`,
                              })
                            }
                            className="px-2 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          >
                            <HiEye className="w-3 h-3" />
                            <span>EB Bill</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[10px] italic">No EB</span>
                        )}

                        {user.property_tax_receipt ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewProof({
                                url: resolveFileUrl(user.property_tax_receipt),
                                title: `${user.name} - Property Tax Receipt`,
                              })
                            }
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 rounded-lg text-[10px] font-bold flex items-center gap-1"
                          >
                            <HiEye className="w-3 h-3" />
                            <span>Tax Bill</span>
                          </button>
                        ) : (
                          <span className="text-gray-400 text-[10px] italic">No Tax</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {user.is_main_admin || user.display_role === 'Main Association Admin' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center justify-center gap-1 shadow-xs">
                          <span>🛡️</span>
                          <span>Main Association Admin</span>
                        </span>
                      ) : user.role === 'admin' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center gap-1">
                          <span>🛡️</span>
                          <span>Layout Admin</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1">
                          <span>👥</span>
                          <span>Resident Member</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Approve */}
                        <button
                          type="button"
                          onClick={() => handleApprove(user.id, user.name, user)}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        >
                          <HiCheckCircle className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>

                        {/* Reject */}
                        <button
                          type="button"
                          onClick={() => {
                            setRejectUser(user);
                            setRejectReason('');
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <HiXCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>

                        {/* Delete Application */}
                        <button
                          type="button"
                          onClick={() => setDeleteUser(user)}
                          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                          title="Delete Registration"
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

      {/* PROOF PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewProof)}
        onClose={() => setPreviewProof(null)}
        title={previewProof?.title || 'Proof Document Preview'}
        size="lg"
      >
        {previewProof && (
          <div className="space-y-4">
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 flex items-center justify-center">
              {previewProof.url.endsWith('.pdf') ? (
                <iframe
                  src={previewProof.url}
                  className="w-full h-96 rounded-lg"
                  title="Document Preview"
                />
              ) : (
                <img
                  src={previewProof.url}
                  alt="Proof Document"
                  className="max-h-96 w-auto object-contain rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
            </div>

            <div className="flex justify-end gap-2">
              <a
                href={previewProof.url}
                target="_blank"
                rel="noreferrer"
                download
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Download File
              </a>
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={Boolean(rejectUser)}
        onClose={() => setRejectUser(null)}
        title={`Reject Registration: ${rejectUser?.name}`}
        size="md"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Reason for Rejection *
            </label>
            <textarea
              required
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. EB bill address does not match door number. Please re-upload valid proof."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectUser(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRejecting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
            >
              {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteUser)}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Registration Request"
        message={`Are you sure you want to permanently delete registration request for "${deleteUser?.name}"?`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />
    </div>
  );
}
