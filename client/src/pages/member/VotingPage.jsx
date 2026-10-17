import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiChartBar,
  HiCheckCircle,
  HiLockClosed,
  HiBuildingStorefront,
  HiDocumentText,
  HiCurrencyRupee,
  HiArrowPath,
  HiTrophy,
} from 'react-icons/hi2';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

export default function MemberVotingPage() {
  const { socket } = useSocket();

  const [polls, setPosts] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [votingInProgress, setVotingInProgress] = useState(false);

  // Tab filter: 'active' | 'closed'
  const [tabFilter, setTabFilter] = useState('active');

  const fetchPolls = useCallback(async (preservePollId = null) => {
    try {
      setLoading(true);
      const res = await api.get('/voting/polls');
      const raw = res.data?.data || res.data || [];
      const list = Array.isArray(raw) ? raw : [];
      setPosts(list);

      const activeList = list.filter((p) => p.status === 'active');
      const defaultPoll = activeList.length > 0 ? activeList[0] : list[0];
      const targetId = preservePollId || selectedPoll?.id || defaultPoll?.id;
      if (targetId) {
        fetchPollDetail(targetId);
      } else {
        setSelectedPoll(null);
      }
    } catch (err) {
      console.error('Failed to load polls:', err);
      toast.error('Failed to load voting polls');
    } finally {
      setLoading(false);
    }
  }, [selectedPoll?.id]);

  const fetchPollDetail = async (pollId) => {
    try {
      setLoadingDetail(true);
      const res = await api.get(`/voting/polls/${pollId}`);
      const detail = res.data?.data || res.data;
      setSelectedPoll(detail);
    } catch (err) {
      console.error('Failed to load poll details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  // Socket.io live updates
  useEffect(() => {
    if (!socket) return;

    const handleVoteResults = (data) => {
      if (selectedPoll && String(data.pollId || data.poll_id) === String(selectedPoll.id)) {
        fetchPollDetail(selectedPoll.id);
      }
    };

    socket.on('vote:cast', handleVoteResults);
    socket.on('vote:results', handleVoteResults);

    return () => {
      socket.off('vote:cast', handleVoteResults);
      socket.off('vote:results', handleVoteResults);
    };
  }, [socket, selectedPoll]);

  // Cast Vote Handler
  const handleCastVote = async (vendorId, vendorName) => {
    if (!selectedPoll) return;
    if (selectedPoll.status !== 'active') {
      toast.error('This poll is closed. Voting has concluded.');
      return;
    }

    if (typeof window !== 'undefined' && window.confirm) {
      if (!window.confirm(`Confirm your vote for "${vendorName}"? Your vote cannot be changed once submitted.`)) {
        return;
      }
    }

    try {
      setVotingInProgress(true);
      const response = await api.post(`/voting/polls/${selectedPoll.id}/vote`, {
        vendor_id: Number(vendorId),
      });

      toast.success(response.data?.message || `Your vote for ${vendorName} has been recorded!`);
      await fetchPollDetail(selectedPoll.id);
      await fetchPolls(selectedPoll.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit vote');
    } finally {
      setVotingInProgress(false);
    }
  };

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/v1\/?$/, '');
    return `${base}/${filePath.replace(/\\/g, '/').replace(/^\/?/, '')}`;
  };

  // Filtered Polls for Left Column
  const filteredPolls = useMemo(() => {
    return polls.filter((p) => {
      if (tabFilter === 'active') return p.status === 'active';
      if (tabFilter === 'closed') return p.status === 'closed';
      return true;
    });
  }, [polls, tabFilter]);

  const handleSelectTab = (tab) => {
    setTabFilter(tab);
    const matching = polls.filter((p) => (tab === 'active' ? p.status === 'active' : p.status === 'closed'));
    if (matching.length > 0 && selectedPoll?.status !== tab) {
      fetchPollDetail(matching[0].id);
    }
  };

  // Chart data
  const chartData = useMemo(() => {
    if (!selectedPoll || !selectedPoll.vendors) return [];
    const totalVotes = selectedPoll.vendors.reduce(
      (acc, curr) => acc + Number(curr.vote_count || curr.votes || 0),
      0
    );

    return selectedPoll.vendors.map((v) => {
      const vCount = Number(v.vote_count || v.votes || 0);
      const pct = totalVotes > 0 ? ((vCount / totalVotes) * 100).toFixed(1) : 0;
      const isVoted =
        Number(selectedPoll.user_voted_vendor_id) === Number(v.id) ||
        Number(selectedPoll.my_vote_vendor_id) === Number(v.id) ||
        Number(selectedPoll.user_vote_id) === Number(v.id) ||
        Number(selectedPoll.voted_vendor_id) === Number(v.id);
      return {
        name: v.company ? `${v.name} (${v.company})` : v.name,
        shortName: v.name.length > 12 ? v.name.slice(0, 12) + '…' : v.name,
        votes: vCount,
        percentage: Number(pct),
        isVoted,
      };
    });
  }, [selectedPoll]);

  // Determine winner if closed
  const winnerVendor = useMemo(() => {
    if (!selectedPoll || selectedPoll.status !== 'closed' || !selectedPoll.vendors?.length) {
      return null;
    }
    const sorted = [...selectedPoll.vendors].sort(
      (a, b) => Number(b.vote_count || b.votes || 0) - Number(a.vote_count || a.votes || 0)
    );
    return sorted[0];
  }, [selectedPoll]);

  // Did the logged-in user vote?
  const hasUserVoted = Boolean(
    selectedPoll?.has_voted ||
      selectedPoll?.user_voted_vendor_id ||
      selectedPoll?.my_vote_vendor_id ||
      selectedPoll?.user_voted ||
      selectedPoll?.voted_vendor_id
  );

  const myVotedVendorId =
    selectedPoll?.user_voted_vendor_id ||
    selectedPoll?.my_vote_vendor_id ||
    selectedPoll?.user_vote_id ||
    selectedPoll?.voted_vendor_id;

  const barColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiChartBar className="w-7 h-7 text-primary-600" />
            Community Polls & Vendor Voting
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Cast your resident ballot on maintenance contractors, security vendor quotations, and layout development decisions.
          </p>
        </div>

        <button
          onClick={() => fetchPolls(selectedPoll?.id)}
          title="Refresh polls"
          className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition self-start sm:self-auto"
        >
          <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Poll List with Tabs */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200 pb-3 mb-3">
            <button
              onClick={() => handleSelectTab('active')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                tabFilter === 'active'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Active Polls
            </button>
            <button
              onClick={() => handleSelectTab('closed')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                tabFilter === 'closed'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Closed / Results
            </button>
          </div>

          <div className="flex-1 divide-y divide-gray-100 overflow-y-auto max-h-[750px] space-y-2">
            {filteredPolls.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No {tabFilter} polls at the moment.
              </div>
            ) : (
              filteredPolls.map((p) => {
                const isSelected = selectedPoll?.id === p.id;
                const isActive = p.status === 'active';
                return (
                  <div
                    key={p.id}
                    onClick={() => fetchPollDetail(p.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition border ${
                      isSelected
                        ? 'bg-primary-50/70 border-primary-300 ring-1 ring-primary-300'
                        : 'bg-white hover:bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.is_anonymous && (
                        <span className="text-[10px] text-purple-700 font-semibold">Anonymous</span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{p.title}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</p>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100">
                      <span>Ends: {p.end_date ? format(new Date(p.end_date), 'dd MMM yyyy') : '—'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Poll Detail, Vendor Options, Voting & Bar Chart */}
        <div className="lg:col-span-2 space-y-6">
          {loadingDetail ? (
            <div className="py-24 bg-white rounded-2xl border border-gray-100 text-center">
              <LoadingSpinner message="Loading voting ballot..." />
            </div>
          ) : !selectedPoll ? (
            <div className="py-24 bg-white rounded-2xl border border-dashed border-gray-300 text-center text-gray-400 text-sm">
              Select an active or closed poll to view options and cast your vote.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Poll Top Info Banner */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          selectedPoll.poll_type === 'resolution_passing'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {selectedPoll.poll_type === 'resolution_passing'
                          ? `Resolution: ${selectedPoll.resolution_task_type || 'General'}`
                          : `Vendor Selection: ${selectedPoll.service_category || 'Service'}`}
                      </span>

                      <span
                        className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          selectedPoll.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {selectedPoll.status === 'active' ? 'Voting Live' : 'Voting Concluded'}
                      </span>
                      {selectedPoll.is_anonymous && (
                        <span className="text-xs font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                          🔒 Secret Ballot
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedPoll.title}</h2>
                  </div>

                  <span className="text-xs text-gray-400 self-start sm:self-auto">
                    {selectedPoll.status === 'active' ? 'Closes: ' : 'Closed: '}
                    {selectedPoll.end_date ? format(new Date(selectedPoll.end_date), 'dd MMM yyyy, hh:mm a') : '—'}
                  </span>
                </div>

                {/* Eligibility Notice */}
                {selectedPoll.is_user_eligible === false && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center gap-2">
                    <span>⚠️</span>
                    <span>
                      {selectedPoll.eligibility_reason || 'Voting is restricted to designated residents for this proposal.'}
                    </span>
                  </div>
                )}

                {/* Voter Turnout Progress */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700">Participation Turnout:</span>
                    <span className="font-bold text-primary-700">
                      {selectedPoll.total_votes || 0} / {selectedPoll.eligible_voters_count || 'All'} residents ({selectedPoll.turnout_percentage || 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, selectedPoll.turnout_percentage || 0)}%` }}
                    />
                  </div>
                </div>

                {selectedPoll.description && (
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 whitespace-pre-wrap leading-relaxed">
                    {selectedPoll.description}
                  </p>
                )}

                {/* Winner Callout if Closed */}
                {winnerVendor && (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-xl shadow-md flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🏆</span>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-100">
                          Winner Selected by Residents
                        </span>
                        <h4 className="text-base font-extrabold">
                          {winnerVendor.name} {winnerVendor.company ? `(${winnerVendor.company})` : ''}
                        </h4>
                      </div>
                    </div>
                    <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                      {winnerVendor.vote_count || winnerVendor.votes || 0} Votes Won
                    </span>
                  </div>
                )}
              </div>

              {/* Vendors Quotation Options (Voting Cards) */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Proposals & Quotations</h3>
                    <p className="text-xs text-gray-500">
                      {selectedPoll.status === 'active'
                        ? hasUserVoted
                          ? 'You have already voted on this poll.'
                          : 'Review vendor quotations and cast your vote below.'
                        : 'Voting is concluded.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {!selectedPoll.vendors || selectedPoll.vendors.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">
                      No vendor proposals configured for this poll.
                    </div>
                  ) : (
                    selectedPoll.vendors.map((vendor, idx) => {
                      const isVotedForThis = myVotedVendorId === vendor.id;
                      const isWinner = winnerVendor?.id === vendor.id;

                      return (
                        <div
                          key={vendor.id || idx}
                          className={`p-5 rounded-2xl border transition ${
                            isVotedForThis
                              ? 'bg-blue-50/70 border-primary-500 ring-2 ring-primary-300'
                              : isWinner
                              ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300'
                              : 'bg-white hover:bg-gray-50/80 border-gray-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-800 text-xs font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <h4 className="text-base font-bold text-gray-900">{vendor.name}</h4>
                                {isVotedForThis && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-primary-600 text-white">
                                    <HiCheckCircle className="w-3.5 h-3.5" />
                                    Your Vote
                                  </span>
                                )}
                                {isWinner && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-500 text-white">
                                    <HiTrophy className="w-3.5 h-3.5" />
                                    Winner
                                  </span>
                                )}
                              </div>

                              {vendor.company && (
                                <p className="text-xs text-gray-500 font-medium pl-8">
                                  {vendor.company} • Contact: {vendor.contact || 'N/A'}
                                </p>
                              )}
                            </div>

                            {/* Quotation & Vote Button */}
                            <div className="flex items-center gap-4 sm:self-center pl-8 sm:pl-0">
                              {vendor.quotation && (
                                <div className="text-right">
                                  <span className="text-[10px] uppercase font-bold text-gray-400 block">
                                    Quotation
                                  </span>
                                  <span className="text-base font-black text-primary-700">
                                    ₹{Number(vendor.quotation).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              )}

                              {selectedPoll.status === 'active' && (
                                <>
                                  {isVotedForThis && (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-200 shadow-xs">
                                      <HiCheckCircle className="w-4 h-4 text-green-600" />
                                      Your Vote
                                    </span>
                                  )}
                                  {!hasUserVoted && selectedPoll.is_user_eligible !== false && (
                                    <button
                                      type="button"
                                      disabled={votingInProgress}
                                      onClick={() => handleCastVote(vendor.id, vendor.name)}
                                      className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm hover:scale-105 active:scale-95 transition disabled:opacity-50"
                                    >
                                      Vote For This
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {vendor.notes && (
                            <p className="text-xs text-gray-600 mt-3 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                              {vendor.notes}
                            </p>
                          )}

                          {vendor.document && (
                            <div className="mt-3">
                              <a
                                href={resolveFileUrl(vendor.document)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-semibold"
                              >
                                <HiDocumentText className="w-4 h-4" />
                                <span>View Detailed Quotation Document &rarr;</span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Live Results Bar Chart */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Voting Results & Analytics</h3>
                    <p className="text-xs text-gray-500">Live tally of all resident ballots</p>
                  </div>
                  <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                    {chartData.reduce((acc, c) => acc + c.votes, 0)} Total Votes
                  </span>
                </div>

                <div className="h-64 w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                      No vendor options available to display.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="shortName" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-gray-900 text-white p-2.5 rounded-lg text-xs shadow-lg">
                                  <p className="font-semibold">{d.name}</p>
                                  <p className="mt-1 text-primary-300 font-bold">
                                    {d.votes} Votes ({d.percentage}%)
                                  </p>
                                  {d.isVoted && <p className="text-green-400 font-semibold mt-0.5">✓ You voted here</p>}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.isVoted ? '#2563eb' : barColors[index % barColors.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
