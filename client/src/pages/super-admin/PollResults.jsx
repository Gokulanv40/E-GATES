import React, { useState, useEffect } from 'react';
import {
  HiChartBarSquare,
  HiTrophy,
  HiTrash,
  HiFunnel,
  HiMagnifyingGlass,
  HiArrowPath,
  HiCheckBadge,
  HiClock,
} from 'react-icons/hi2';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import toast from 'react-hot-toast';

export default function PollResults() {
  const { t } = useLanguage();

  const [polls, setPolls] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedAssocId, setSelectedAssocId] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Poll for Results Breakdown
  const [activePoll, setActivePoll] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);

  // Delete Poll State
  const [deletePoll, setDeletePoll] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const [pollsRes, assocRes] = await Promise.all([
        api.get('/voting/polls'),
        api.get('/associations'),
      ]);
      setPolls(pollsRes.data?.data || []);
      setAssociations(assocRes.data?.data || []);
    } catch (err) {
      console.warn('Error fetching polls:', err);
      toast.error('Failed to load voting polls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const openResultsModal = async (poll) => {
    setActivePoll(poll);
    try {
      setLoadingResults(true);
      const res = await api.get(`/voting/polls/${poll.id}/results`);
      setPollResults(res.data?.data || null);
    } catch (err) {
      toast.error('Failed to load poll results');
    } finally {
      setLoadingResults(false);
    }
  };

  // Handle Delete Poll
  const handleConfirmDelete = async () => {
    if (!deletePoll) return;
    try {
      setIsDeleting(true);
      await api.delete(`/voting/polls/${deletePoll.id}`);
      toast.success(`Poll "${deletePoll.title}" deleted successfully`);
      setDeletePoll(null);
      if (activePoll?.id === deletePoll.id) setActivePoll(null);
      fetchPolls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete poll');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Polls
  const filteredPolls = polls.filter((p) => {
    const matchesAssoc =
      selectedAssocId === 'all' || String(p.association_id) === String(selectedAssocId);
    const matchesSearch =
      !searchTerm ||
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.creator_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAssoc && matchesSearch;
  });

  return (
    <div className="space-y-6 transition-colors duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <HiChartBarSquare className="w-6 h-6" />
            </span>
            <span>{t('superadmin_polls_title') || 'Vendor Voting & Poll Results Oversight'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Platform-wide vendor selection polls, live resident vote metrics, and winning contract quotations.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchPolls}
          className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm transition self-start sm:self-auto"
          title="Refresh Polls"
        >
          <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <HiFunnel className="w-4 h-4 text-gray-400" />
          <select
            value={selectedAssocId}
            onChange={(e) => setSelectedAssocId(e.target.value)}
            className="py-1.5 px-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">🌐 {t('all_associations') || 'All Associations'}</option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                📍 {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search poll title, author..."
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Polls Cards Grid */}
      {filteredPolls.length === 0 ? (
        <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800">
          {loading ? 'Loading voting polls...' : 'No polls found for the selected association filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPolls.map((poll) => {
            const isClosed = poll.computed_status === 'closed' || poll.status === 'closed';
            const assocName =
              associations.find((a) => a.id === poll.association_id)?.name ||
              `Association #${poll.association_id}`;

            return (
              <div
                key={poll.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isClosed
                          ? 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-gray-300'
                          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      }`}
                    >
                      {isClosed ? 'Closed' : 'Active Poll'}
                    </span>

                    <span className="text-[11px] font-mono font-bold text-gray-400">
                      #{poll.id}
                    </span>
                  </div>

                  <h3 className="font-bold text-gray-900 dark:text-white text-base line-clamp-1 mb-1">
                    {poll.title}
                  </h3>

                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">
                    📍 {assocName}
                  </p>

                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5rem] mb-4">
                    {poll.description || 'No description provided.'}
                  </p>

                  {/* Quick Metrics */}
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-center text-xs font-semibold mb-4">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Total Votes</span>
                      <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                        {poll.total_votes || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase">Vendors</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                        {poll.vendor_count || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openResultsModal(poll)}
                    className="px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 rounded-lg transition flex items-center gap-1.5"
                  >
                    <HiChartBarSquare className="w-4 h-4" />
                    <span>View Results</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletePoll(poll)}
                    className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    title="Delete Poll"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POLL RESULTS BREAKDOWN MODAL */}
      <Modal
        isOpen={Boolean(activePoll)}
        onClose={() => {
          setActivePoll(null);
          setPollResults(null);
        }}
        title={`📊 Voting Results: ${activePoll?.title || ''}`}
        size="lg"
      >
        {loadingResults ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading voting breakdown...</div>
        ) : pollResults ? (
          <div className="space-y-4">
            {/* Poll Status Overview */}
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 flex items-center justify-between text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase">
                  Total Votes Cast
                </span>
                <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                  {pollResults.total_votes || 0} Votes
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white dark:bg-slate-800 shadow-sm text-gray-700 dark:text-gray-200">
                {pollResults.is_expired ? '🏁 Poll Concluded' : '⏳ Voting In Progress'}
              </span>
            </div>

            {/* Winning Vendor Banner if Closed */}
            {pollResults.winner && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center text-xl">
                  <HiTrophy className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
                    Winning Vendor
                  </span>
                  <p className="font-black text-gray-900 dark:text-white text-sm">
                    {pollResults.winner.name} ({pollResults.winner.company || 'Service Provider'})
                  </p>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Quote: ₹{pollResults.winner.quotation_amount?.toLocaleString() || 'N/A'} • Received{' '}
                    {pollResults.winner.vote_count} votes ({pollResults.winner.vote_percentage}%)
                  </p>
                </div>
              </div>
            )}

            {/* Vendor Bars List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Vendor Quotations & Vote Distribution
              </h4>

              {pollResults.vendors?.map((vendor) => {
                const isWinner = pollResults.winner?.id === vendor.id;
                const percentage = parseFloat(vendor.vote_percentage || 0);

                return (
                  <div
                    key={vendor.id}
                    className={`p-3.5 rounded-xl border transition ${
                      isWinner
                        ? 'border-amber-400 dark:border-amber-600 bg-amber-50/20 dark:bg-amber-950/20'
                        : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {vendor.name}
                        </span>
                        {vendor.company && (
                          <span className="text-[11px] text-gray-400">({vendor.company})</span>
                        )}
                        {isWinner && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white">
                            WINNER
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-gray-900 dark:text-white">
                          ₹{vendor.quotation_amount?.toLocaleString() || 'N/A'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 text-[11px] block">
                          {vendor.vote_count || 0} votes ({percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${
                          isWinner ? 'bg-amber-500' : 'bg-primary-600'
                        }`}
                        style={{ width: `${Math.max(percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActivePoll(null);
                  setPollResults(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deletePoll)}
        onClose={() => setDeletePoll(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Voting Poll"
        message={`Are you sure you want to permanently delete poll "${deletePoll?.title}"? All submitted votes and vendor quotations will be removed.`}
        confirmText={isDeleting ? 'Deleting...' : 'Delete Permanently'}
        variant="danger"
      />
    </div>
  );
}
