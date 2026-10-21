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
  HiUserGroup,
  HiUser,
  HiShieldCheck,
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
  const [selectedElectionCandidates, setSelectedElectionCandidates] = useState({});

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
      setSelectedElectionCandidates({});
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

  // Cast Vote Handler for standard polls
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

  // Election Candidate Selection & Ballot submission
  const handleSelectElectionCandidate = (roleName, candidateId) => {
    setSelectedElectionCandidates((prev) => ({
      ...prev,
      [roleName]: Number(candidateId),
    }));
  };

  const handleCastElectionBallot = async () => {
    if (!selectedPoll) return;
    if (selectedPoll.status !== 'active') {
      toast.error('This election is closed. Voting has concluded.');
      return;
    }

    const chosenIds = Object.values(selectedElectionCandidates).filter(Boolean);
    if (chosenIds.length === 0) {
      toast.error('Please select at least one candidate for your election ballot');
      return;
    }

    const roleNames = Object.keys(electionRoleGroups);
    if (selectedPoll.election_type === 'all_roles' && chosenIds.length < roleNames.length) {
      if (!window.confirm(`You selected candidates for ${chosenIds.length} of ${roleNames.length} roles. Submit your ballot now?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Submit your official election ballot? Your vote is strictly confidential and cannot be changed.`)) {
        return;
      }
    }

    try {
      setVotingInProgress(true);
      const response = await api.post(`/voting/polls/${selectedPoll.id}/vote`, {
        candidate_ids: chosenIds,
      });

      toast.success(response.data?.message || 'Your election ballot has been securely submitted!');
      await fetchPollDetail(selectedPoll.id);
      await fetchPolls(selectedPoll.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit election ballot');
    } finally {
      setVotingInProgress(false);
    }
  };

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/api\/v1\/?$/, '');
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

  // Group election candidates by role
  const electionRoleGroups = useMemo(() => {
    if (!selectedPoll || selectedPoll.poll_type !== 'election' || !selectedPoll.vendors) return {};
    const groups = {};
    selectedPoll.vendors.forEach((v) => {
      const roleName = (v.contesting_role || v.company || 'Executive Committee Member').trim();
      if (!groups[roleName]) {
        groups[roleName] = [];
      }
      groups[roleName].push(v);
    });
    return groups;
  }, [selectedPoll]);

  // Voted candidate IDs
  const myVotedVendorIds = useMemo(() => {
    if (!selectedPoll) return [];
    if (Array.isArray(selectedPoll.user_voted_vendor_ids) && selectedPoll.user_voted_vendor_ids.length > 0) {
      return selectedPoll.user_voted_vendor_ids.map(Number);
    }
    const single = selectedPoll.user_voted_vendor_id || selectedPoll.my_vote_vendor_id || selectedPoll.user_vote_id || selectedPoll.voted_vendor_id;
    return single ? [Number(single)] : [];
  }, [selectedPoll]);

  // Chart data (Hidden for secret ballot election polls)
  const chartData = useMemo(() => {
    if (!selectedPoll || !selectedPoll.vendors || selectedPoll.poll_type === 'election') return [];
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
        Number(selectedPoll.voted_vendor_id) === Number(v.id) ||
        myVotedVendorIds.includes(Number(v.id));
      return {
        name: v.company ? `${v.name} (${v.company})` : v.name,
        shortName: v.name.length > 12 ? v.name.slice(0, 12) + '…' : v.name,
        votes: vCount,
        percentage: Number(pct),
        isVoted,
      };
    });
  }, [selectedPoll, myVotedVendorIds]);

  // Determine winner if closed (for non-election polls)
  const winnerVendor = useMemo(() => {
    if (!selectedPoll || selectedPoll.status !== 'closed' || selectedPoll.poll_type === 'election' || !selectedPoll.vendors?.length) {
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
      selectedPoll?.voted_vendor_id ||
      (Array.isArray(selectedPoll?.user_voted_vendor_ids) && selectedPoll.user_voted_vendor_ids.length > 0)
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
                          p.poll_type === 'election'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {p.poll_type === 'election' ? '🗳️ Election' : p.status}
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
                          selectedPoll.poll_type === 'election'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : selectedPoll.poll_type === 'resolution_passing'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {selectedPoll.poll_type === 'election'
                          ? `🗳️ Association Election (${selectedPoll.election_type === 'single_role' ? 'Single Role' : 'All Roles'})`
                          : selectedPoll.poll_type === 'resolution_passing'
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

                {/* Polling Officers Banner (For Election) */}
                {selectedPoll.poll_type === 'election' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                        🏛️ Internal Polling Officer (Resident Member)
                      </span>
                      <p className="font-bold text-gray-900 text-sm mt-0.5">
                        {selectedPoll.internal_officer_name || 'Not assigned'}
                      </p>
                      {selectedPoll.internal_officer_contact && (
                        <p className="text-gray-600 text-[11px] mt-0.5">{selectedPoll.internal_officer_contact}</p>
                      )}
                    </div>

                    <div className="sm:border-l sm:border-amber-200 sm:pl-3.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                        🌐 External Polling Officer (Observer / Returning Officer)
                      </span>
                      <p className="font-bold text-gray-900 text-sm mt-0.5">
                        {selectedPoll.external_officer_name || 'Not assigned'}
                      </p>
                      {selectedPoll.external_officer_contact && (
                        <p className="text-gray-600 text-[11px] mt-0.5">{selectedPoll.external_officer_contact}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Secret Ballot Active Banner (For Election) */}
                {selectedPoll.poll_type === 'election' && selectedPoll.status === 'active' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2">
                    <span className="text-base">🔒</span>
                    <span>
                      <strong>Secret Ballot Active:</strong> In accordance with election regulations, all votes are strictly confidential. Live vote counts are hidden during voting. Only the elected winners will be announced once the election is concluded.
                    </span>
                  </div>
                )}

                {/* Official Election Winners Announcement (If Election Closed) */}
                {selectedPoll.poll_type === 'election' && selectedPoll.status === 'closed' && (
                  <div className="p-5 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white rounded-2xl shadow-md space-y-4">
                    <div className="flex items-center gap-3 border-b border-amber-400/40 pb-3">
                      <span className="text-3xl">🏆</span>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-100">
                          Official Election Results Declared
                        </span>
                        <h3 className="text-lg font-black">Winning Association Executive Committee</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedPoll.role_winners_summary && selectedPoll.role_winners_summary.length > 0 ? (
                        selectedPoll.role_winners_summary.map((rw, idx) => (
                          <div key={idx} className="bg-white/15 backdrop-blur-sm p-4 rounded-xl border border-white/20 space-y-1">
                            <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider block">
                              Elected Post: {rw.role}
                            </span>
                            {rw.winners.map((win) => (
                              <div key={win.id}>
                                <h4 className="text-base font-extrabold text-white flex items-center gap-1.5">
                                  <span>🎖️</span> {win.name}
                                </h4>
                                {win.contact && <p className="text-xs text-amber-100">{win.contact}</p>}
                                {win.notes && <p className="text-[11px] text-amber-200 italic mt-0.5">"{win.notes}"</p>}
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-amber-100 col-span-2">No winners recorded for this election.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Non-Election Winner Callout if Closed */}
                {selectedPoll.poll_type !== 'election' && winnerVendor && (
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

              {/* =========================================================================
                  ELECTION BALLOT VIEW (IF ELECTION POLL)
                 ========================================================================= */}
              {selectedPoll.poll_type === 'election' ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <span>🗳️</span> Official Confidential Election Ballot
                      </h3>
                      <p className="text-xs text-gray-500">
                        {selectedPoll.status === 'active'
                          ? hasUserVoted
                            ? 'Your official ballot has been submitted and recorded by the Polling Officers.'
                            : selectedPoll.election_type === 'single_role'
                            ? 'Select your preferred candidate for this post and cast your vote below.'
                            : 'Select 1 preferred candidate for each executive committee role and submit your complete ballot.'
                          : 'Voting for this election is now concluded.'}
                      </p>
                    </div>

                    {hasUserVoted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-green-50 text-green-700 border border-green-200">
                        <HiCheckCircle className="w-4 h-4 text-green-600" />
                        Ballot Submitted
                      </span>
                    )}
                  </div>

                  {/* Ballot Role by Role */}
                  <div className="space-y-6">
                    {Object.keys(electionRoleGroups).length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-400">
                        No contesting candidates configured for this election.
                      </div>
                    ) : (
                      Object.entries(electionRoleGroups).map(([roleName, candidates], rIdx) => {
                        const hasSelectedForThisRole = Boolean(selectedElectionCandidates[roleName]);
                        const isVotedForThisRole = candidates.some((c) => myVotedVendorIds.includes(Number(c.id)));

                        return (
                          <div
                            key={rIdx}
                            className="bg-white rounded-2xl border-2 border-amber-200/90 shadow-sm overflow-hidden space-y-0"
                          >
                            {/* Prominent Role Election Heading */}
                            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                              <div className="flex items-center gap-3">
                                <span className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs text-white font-black flex items-center justify-center text-sm shadow-inner">
                                  #{rIdx + 1}
                                </span>
                                <div>
                                  <h4 className="text-base font-black tracking-wide uppercase flex items-center gap-2">
                                    <span>🗳️</span> {roleName} Election
                                  </h4>
                                  <p className="text-xs text-amber-100 font-medium">
                                    {candidates.length} candidate{candidates.length > 1 ? 's' : ''} contesting for {roleName} • Pick 1 candidate below
                                  </p>
                                </div>
                              </div>

                              <div>
                                {isVotedForThisRole ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-white text-green-700 px-3 py-1 rounded-full shadow-xs">
                                    <HiCheckCircle className="w-4 h-4 text-green-600" />
                                    Vote Cast for this Role
                                  </span>
                                ) : hasSelectedForThisRole ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-white text-amber-900 px-3 py-1 rounded-full shadow-xs">
                                    ✓ 1 Selected
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-800/60 text-amber-100 px-3 py-1 rounded-full">
                                    Selection Pending
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Contesting Candidates for this Role */}
                            <div className="p-4 bg-amber-50/20">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {candidates.map((cand, cIdx) => {
                                  const isMyChoice = myVotedVendorIds.includes(Number(cand.id));
                                  const isSelectedInDraft = selectedElectionCandidates[roleName] === cand.id;
                                  const isWinner = cand.is_winner && selectedPoll.status === 'closed';

                                  return (
                                    <div
                                      key={cand.id}
                                      onClick={() => {
                                        if (selectedPoll.status === 'active' && !hasUserVoted && selectedPoll.is_user_eligible !== false) {
                                          handleSelectElectionCandidate(roleName, cand.id);
                                        }
                                      }}
                                      className={`p-4 rounded-xl border-2 transition relative flex flex-col justify-between ${
                                        isMyChoice
                                          ? 'bg-green-50/80 border-green-500 ring-2 ring-green-300 shadow-sm'
                                          : isSelectedInDraft
                                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400 shadow-sm'
                                          : isWinner
                                          ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300'
                                          : selectedPoll.status === 'active' && !hasUserVoted
                                          ? 'bg-white hover:border-amber-400 cursor-pointer border-gray-200 hover:shadow-xs'
                                          : 'bg-white border-gray-200'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                          <div className="flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold flex items-center justify-center">
                                              {cIdx + 1}
                                            </span>
                                            <h5 className="text-sm font-extrabold text-gray-900">
                                              {cand.name}
                                            </h5>
                                          </div>

                                          <div>
                                            {isMyChoice ? (
                                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">
                                                <HiCheckCircle className="w-3.5 h-3.5" />
                                                Your Vote
                                              </span>
                                            ) : selectedPoll.status === 'active' && !hasUserVoted && selectedPoll.is_user_eligible !== false ? (
                                              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-900">
                                                <input
                                                  type="radio"
                                                  name={`role_selection_${roleName}`}
                                                  checked={isSelectedInDraft}
                                                  onChange={() => handleSelectElectionCandidate(roleName, cand.id)}
                                                  className="w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                                />
                                                <span className={isSelectedInDraft ? 'text-amber-800' : 'text-gray-400'}>
                                                  {isSelectedInDraft ? 'Selected' : 'Vote'}
                                                </span>
                                              </label>
                                            ) : null}
                                          </div>
                                        </div>

                                        {cand.contact && (
                                          <p className="text-xs text-gray-500 font-medium pl-7">
                                            📍 {cand.contact}
                                          </p>
                                        )}

                                        {cand.notes && (
                                          <p className="text-xs text-gray-700 italic mt-2.5 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            "{cand.notes}"
                                          </p>
                                        )}
                                      </div>

                                      {isWinner && (
                                        <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between">
                                          <span className="text-xs bg-amber-500 text-white px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                                            <HiTrophy className="w-3.5 h-3.5" /> Official Elected Winner
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Submit Ballot Button */}
                  {selectedPoll.status === 'active' && !hasUserVoted && selectedPoll.is_user_eligible !== false && (
                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                      <button
                        type="button"
                        disabled={votingInProgress || Object.values(selectedElectionCandidates).filter(Boolean).length === 0}
                        onClick={handleCastElectionBallot}
                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <span>🗳️</span>
                        <span>
                          {votingInProgress ? 'Submitting Ballot...' : 'Submit Official Confidential Election Ballot'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* =========================================================================
                    STANDARD VENDOR / RESOLUTION PROPOSALS VIEW
                   ========================================================================= */
                <>
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          {selectedPoll.poll_type === 'resolution_passing' ? 'Resolution Choices' : 'Proposals & Quotations'}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {selectedPoll.status === 'active'
                            ? hasUserVoted
                              ? 'You have already voted on this poll.'
                              : 'Review options and cast your vote below.'
                            : 'Voting is concluded.'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {!selectedPoll.vendors || selectedPoll.vendors.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400">
                          No options configured for this poll.
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

                  {/* Live Results Bar Chart (For Vendor & Resolution Polls) */}
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
                          No options available to display.
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
