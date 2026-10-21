import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiChartBar,
  HiPlus,
  HiTrash,
  HiPencilSquare,
  HiCheckCircle,
  HiXCircle,
  HiArrowDownTray,
  HiArrowPath,
  HiUserGroup,
  HiBuildingStorefront,
  HiCurrencyRupee,
  HiDocumentText,
  HiTrophy,
  HiLockClosed,
  HiStopCircle,
  HiWrenchScrewdriver,
  HiScale,
  HiMapPin,
  HiIdentification,
  HiShieldCheck,
  HiUser,
  HiGlobeAlt,
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
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const SERVICE_CATEGORIES = [
  'Plumber',
  'Electrician',
  'Painter',
  'Security Agency',
  'Waste & Sanitation',
  'Civil Works / Masonry',
  'Gardening & Landscaping',
  'Lift Maintenance',
  'CCTV & Intercom',
  'Other Service',
];

const RESOLUTION_TASK_TYPES = [
  'Infrastructure & Road Tarring',
  'Security, CCTV & Gate Automation',
  'Water Supply, Borewell & Pipeline',
  'Streetlights & Common Electricity',
  'Parks, Greenery & Children Play Area',
  'Maintenance Fee Revision',
  'Layout Bylaws & Rules Amendment',
  'Annual Financial Budget & Audit',
  'Other Resolution',
];

export default function AdminVotingManage() {
  const { socket } = useSocket();

  const [polls, setPolls] = useState([]);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [associationMembers, setAssociationMembers] = useState([]);

  // Modals
  const [isCreatePollOpen, setIsCreatePollOpen] = useState(false);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pollToDelete, setPollToDelete] = useState(null);

  // Create Poll Form
  const [pollForm, setPollForm] = useState({
    poll_type: 'vendor_selection', // 'vendor_selection' | 'resolution_passing' | 'election'
    service_category: 'Plumber',
    resolution_task_type: 'Infrastructure & Road Tarring',
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    is_anonymous: false,
    target_audience: 'all', // 'all' | 'street' | 'selected'
    target_street: '',
    target_user_ids: [],
    // For vendor selection: 1 or more vendor options
    vendors: [
      { name: '', company: '', contact: '', quotation: '', notes: '' },
    ],
    // For election polling
    election_type: 'all_roles', // 'all_roles' | 'single_role'
    internal_officer_id: '',
    internal_officer_name: '',
    internal_officer_contact: '',
    external_officer_name: '',
    external_officer_contact: '',
    external_officer_org: '',
    election_roles_builder: [
      {
        role_name: 'President',
        candidates: [
          { name: '', contact: '', notes: '' },
          { name: '', contact: '', notes: '' },
        ],
      },
    ],
  });

  // Election roles builder handlers
  const handleAddElectionRole = () => {
    setPollForm((prev) => ({
      ...prev,
      election_roles_builder: [
        ...prev.election_roles_builder,
        {
          role_name: '',
          candidates: [
            { name: '', contact: '', notes: '' },
            { name: '', contact: '', notes: '' },
          ],
        },
      ],
    }));
  };

  const handleRemoveElectionRole = (rIdx) => {
    if (pollForm.election_roles_builder.length <= 1) return;
    setPollForm((prev) => ({
      ...prev,
      election_roles_builder: prev.election_roles_builder.filter((_, idx) => idx !== rIdx),
    }));
  };

  const handleRoleNameChange = (rIdx, value) => {
    setPollForm((prev) => {
      const next = [...prev.election_roles_builder];
      next[rIdx] = { ...next[rIdx], role_name: value };
      return { ...prev, election_roles_builder: next };
    });
  };

  const handleAddCandidateToRole = (rIdx) => {
    setPollForm((prev) => {
      const next = [...prev.election_roles_builder];
      next[rIdx] = {
        ...next[rIdx],
        candidates: [...next[rIdx].candidates, { name: '', contact: '', notes: '' }],
      };
      return { ...prev, election_roles_builder: next };
    });
  };

  const handleRemoveCandidateFromRole = (rIdx, cIdx) => {
    setPollForm((prev) => {
      const next = [...prev.election_roles_builder];
      if (next[rIdx].candidates.length <= 1) return prev;
      next[rIdx] = {
        ...next[rIdx],
        candidates: next[rIdx].candidates.filter((_, idx) => idx !== cIdx),
      };
      return { ...prev, election_roles_builder: next };
    });
  };

  const handleCandidateFieldChange = (rIdx, cIdx, field, value) => {
    setPollForm((prev) => {
      const next = [...prev.election_roles_builder];
      const nextCands = [...next[rIdx].candidates];
      nextCands[cIdx] = { ...nextCands[cIdx], [field]: value };
      next[rIdx] = { ...next[rIdx], candidates: nextCands };
      return { ...prev, election_roles_builder: next };
    });
  };

  const handleInternalOfficerSelect = (userId) => {
    const member = associationMembers.find((m) => String(m.id) === String(userId));
    if (member) {
      setPollForm((prev) => ({
        ...prev,
        internal_officer_id: member.id,
        internal_officer_name: member.name,
        internal_officer_contact: member.door_number
          ? `Door ${member.door_number}${member.phone ? `, Tel: ${member.phone}` : ''}`
          : member.phone || member.email || '',
      }));
    } else {
      setPollForm((prev) => ({
        ...prev,
        internal_officer_id: '',
        internal_officer_name: '',
        internal_officer_contact: '',
      }));
    }
  };

  // Add Single Vendor Form (for adding more to an existing active poll)
  const [vendorForm, setVendorForm] = useState({
    name: '',
    company: '',
    contact: '',
    quotation: '',
    notes: '',
    documentFile: null,
  });

  const [submitting, setSubmitting] = useState(false);

  // Fetch all polls
  const fetchPolls = useCallback(async (preserveSelectedId = null) => {
    try {
      setLoading(true);
      const [pollsRes, usersRes] = await Promise.allSettled([
        api.get('/voting/polls'),
        api.get('/users'),
      ]);

      let list = [];
      if (pollsRes.status === 'fulfilled') {
        const raw = pollsRes.value.data?.data || pollsRes.value.data || [];
        list = Array.isArray(raw) ? raw : [];
        setPolls(list);
      }

      if (usersRes.status === 'fulfilled') {
        const rawUsers = usersRes.value.data?.data || usersRes.value.data || [];
        const mems = Array.isArray(rawUsers) ? rawUsers.filter((u) => u.status === 'approved') : [];
        setAssociationMembers(mems);
      }

      // Select targeted or first poll
      const targetId = preserveSelectedId || selectedPoll?.id || list[0]?.id;
      if (targetId) {
        fetchPollDetail(targetId);
      } else {
        setSelectedPoll(null);
      }
    } catch (err) {
      console.error('Failed to load polls:', err);
      toast.error('Failed to fetch voting polls');
    } finally {
      setLoading(false);
    }
  }, [selectedPoll?.id]);

  // Fetch poll detail with vendors and live results
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

  // Socket.io for live updates
  useEffect(() => {
    if (!socket) return;

    const handleVoteUpdate = (data) => {
      if (selectedPoll && String(data.pollId || data.poll_id) === String(selectedPoll.id)) {
        toast('New vote cast in this poll!', { icon: '🗳️' });
        fetchPollDetail(selectedPoll.id);
      }
    };

    const handlePollEnded = (data) => {
      if (selectedPoll && String(data.poll_id) === String(selectedPoll.id)) {
        toast.success(data.auto_ended ? 'All eligible members voted! Poll automatically concluded.' : 'Poll has been closed.');
        fetchPollDetail(selectedPoll.id);
        fetchPolls(selectedPoll.id);
      }
    };

    socket.on('vote:cast', handleVoteUpdate);
    socket.on('vote:results', handleVoteUpdate);
    socket.on('poll:ended', handlePollEnded);

    return () => {
      socket.off('vote:cast', handleVoteUpdate);
      socket.off('vote:results', handleVoteUpdate);
      socket.off('poll:ended', handlePollEnded);
    };
  }, [socket, selectedPoll]);

  // Handle Vendor Form Dynamic Addition in Poll Creation
  const handleAddVendorOption = () => {
    setPollForm((prev) => ({
      ...prev,
      vendors: [
        ...prev.vendors,
        { name: '', company: '', contact: '', quotation: '', notes: '' },
      ],
    }));
  };

  const handleRemoveVendorOption = (index) => {
    if (pollForm.vendors.length <= 1) return;
    setPollForm((prev) => ({
      ...prev,
      vendors: prev.vendors.filter((_, i) => i !== index),
    }));
  };

  const handleVendorFieldChange = (index, field, value) => {
    setPollForm((prev) => {
      const nextVendors = [...prev.vendors];
      nextVendors[index] = { ...nextVendors[index], [field]: value };
      return { ...prev, vendors: nextVendors };
    });
  };

  // Create Poll Submit
  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!pollForm.title.trim() || !pollForm.start_date || !pollForm.end_date) {
      toast.error('Title, start date, and end date are required');
      return;
    }

    if (pollForm.poll_type === 'vendor_selection') {
      const validVendors = pollForm.vendors.filter((v) => v.name.trim());
      if (validVendors.length < 2) {
        toast.error('Please provide at least 2 vendor proposals for members to choose between');
        return;
      }
    }

    if (pollForm.poll_type === 'election') {
      if (!pollForm.internal_officer_name.trim()) {
        toast.error('Please select an Internal Polling Officer from approved association members');
        return;
      }
      if (!pollForm.external_officer_name.trim()) {
        toast.error('Please specify the External Polling Officer name');
        return;
      }
      const validRoles = pollForm.election_roles_builder.filter((r) => r.role_name.trim());
      if (validRoles.length === 0) {
        toast.error('Please provide at least one role/designation for the election');
        return;
      }
      for (const r of validRoles) {
        const cands = (r.candidates || []).filter((c) => c.name.trim());
        if (cands.length < 1) {
          toast.error(`Please add at least 1 candidate for role "${r.role_name}"`);
          return;
        }
      }
    }

    if (pollForm.target_audience === 'street' && !pollForm.target_street.trim()) {
      toast.error('Please specify the target street/block name');
      return;
    }

    if (pollForm.target_audience === 'selected' && (!pollForm.target_user_ids || pollForm.target_user_ids.length === 0)) {
      toast.error('Please select at least one member for the designated committee list');
      return;
    }

    try {
      setSubmitting(true);
      const candidatesPayload = [];
      const rolesPayload = [];
      if (pollForm.poll_type === 'election') {
        pollForm.election_roles_builder.forEach((r) => {
          const rName = r.role_name.trim();
          if (rName) {
            rolesPayload.push(rName);
            (r.candidates || []).forEach((c) => {
              if (c.name.trim()) {
                candidatesPayload.push({
                  name: c.name.trim(),
                  company: rName,
                  contesting_role: rName,
                  contact: c.contact.trim(),
                  notes: c.notes.trim(),
                });
              }
            });
          }
        });
      }

      const payload = {
        title: pollForm.title.trim(),
        description: pollForm.description.trim(),
        start_date: new Date(pollForm.start_date).toISOString(),
        end_date: new Date(pollForm.end_date).toISOString(),
        is_anonymous: Boolean(pollForm.is_anonymous),
        poll_type: pollForm.poll_type,
        service_category: pollForm.poll_type === 'vendor_selection' ? pollForm.service_category : null,
        resolution_task_type: pollForm.poll_type === 'resolution_passing' ? pollForm.resolution_task_type : null,
        target_audience: pollForm.target_audience,
        target_street: pollForm.target_audience === 'street' ? pollForm.target_street.trim() : null,
        target_user_ids: pollForm.target_audience === 'selected' ? pollForm.target_user_ids : [],
        vendors: pollForm.poll_type === 'vendor_selection' ? pollForm.vendors.filter((v) => v.name.trim()) : [],
        // Election payload
        election_type: pollForm.poll_type === 'election' ? pollForm.election_type : null,
        internal_officer_name: pollForm.poll_type === 'election' ? pollForm.internal_officer_name.trim() : null,
        internal_officer_contact: pollForm.poll_type === 'election' ? pollForm.internal_officer_contact.trim() : null,
        external_officer_name: pollForm.poll_type === 'election' ? pollForm.external_officer_name.trim() : null,
        external_officer_contact: pollForm.poll_type === 'election' ? `${pollForm.external_officer_contact.trim()}${pollForm.external_officer_org ? ` (${pollForm.external_officer_org.trim()})` : ''}` : null,
        election_roles: rolesPayload,
        candidates: candidatesPayload,
      };

      const res = await api.post('/voting/polls', payload);
      toast.success(
        pollForm.poll_type === 'election'
          ? 'Association Election poll created successfully with polling officers!'
          : pollForm.poll_type === 'resolution_passing'
          ? 'Resolution poll created with automatic Yes/No options!'
          : 'Service vendor poll created successfully!'
      );
      setIsCreatePollOpen(false);

      // Reset Form
      setPollForm({
        poll_type: 'vendor_selection',
        service_category: 'Plumber',
        resolution_task_type: 'Infrastructure & Road Tarring',
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        is_anonymous: false,
        target_audience: 'all',
        target_street: '',
        target_user_ids: [],
        vendors: [{ name: '', company: '', contact: '', quotation: '', notes: '' }],
        election_type: 'all_roles',
        internal_officer_id: '',
        internal_officer_name: '',
        internal_officer_contact: '',
        external_officer_name: '',
        external_officer_contact: '',
        external_officer_org: '',
        election_roles_builder: [
          {
            role_name: 'President',
            candidates: [
              { name: '', contact: '', notes: '' },
              { name: '', contact: '', notes: '' },
            ],
          },
        ],
      });

      const newPoll = res.data?.data || res.data;
      fetchPolls(newPoll?.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create poll');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Vendor Proposal (To existing poll)
  const handleAddVendor = async (e) => {
    e.preventDefault();
    if (!selectedPoll) return;
    if (!vendorForm.name.trim()) {
      toast.error('Vendor or quotation name is required');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('name', vendorForm.name.trim());
      data.append('company', vendorForm.company.trim());
      data.append('contact', vendorForm.contact.trim());
      data.append('quotation', vendorForm.quotation ? String(vendorForm.quotation) : '');
      data.append('notes', vendorForm.notes.trim());

      if (vendorForm.documentFile) {
        data.append('document', vendorForm.documentFile);
      }

      await api.post(`/voting/polls/${selectedPoll.id}/vendors`, data);
      toast.success('Vendor proposal added to poll!');
      setIsAddVendorOpen(false);
      setVendorForm({
        name: '',
        company: '',
        contact: '',
        quotation: '',
        notes: '',
        documentFile: null,
      });
      fetchPollDetail(selectedPoll.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add vendor proposal');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Vendor
  const handleDeleteVendor = async (vendorId) => {
    if (!confirm('Remove this proposal from the poll?')) return;
    try {
      await api.delete(`/voting/vendors/${vendorId}`);
      toast.success('Proposal removed');
      fetchPollDetail(selectedPoll.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove proposal');
    }
  };

  // Admin "End Poll Now" button
  const handleEndPollNow = async () => {
    if (!selectedPoll) return;
    if (
      !confirm(
        `Are you sure you want to end poll "${selectedPoll.title}" now? Voting will conclude immediately and final results will be locked for all members.`
      )
    ) {
      return;
    }

    try {
      await api.post(`/voting/polls/${selectedPoll.id}/end`);
      toast.success('Poll ended immediately by admin choice. Results are finalized!');
      fetchPollDetail(selectedPoll.id);
      fetchPolls(selectedPoll.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end poll');
    }
  };

  // Confirm Delete Poll
  const handleConfirmDeletePoll = async () => {
    if (!pollToDelete) return;
    try {
      setSubmitting(true);
      await api.delete(`/voting/polls/${pollToDelete.id}`);
      toast.success('Poll deleted successfully');
      setIsDeleteConfirmOpen(false);
      setPollToDelete(null);
      fetchPolls();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete poll');
    } finally {
      setSubmitting(false);
    }
  };

  // Export Excel
  const handleExportExcel = async (pollId) => {
    try {
      toast.loading('Generating Excel report...', { id: 'export' });
      const response = await api.get(`/voting/polls/${pollId}/export/excel`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `poll-${pollId}-results.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded!', { id: 'export' });
    } catch (err) {
      toast.error('Failed to export Excel', { id: 'export' });
    }
  };

  // Winner vendor calculation
  const winnerVendor = useMemo(() => {
    if (!selectedPoll || !selectedPoll.vendors || selectedPoll.vendors.length === 0) return null;
    let max = -1;
    let winner = null;
    selectedPoll.vendors.forEach((v) => {
      const count = Number(v.vote_count || v.votes || 0);
      if (count > max && count > 0) {
        max = count;
        winner = v;
      }
    });
    return winner;
  }, [selectedPoll]);

  // Chart data
  const chartData = useMemo(() => {
    if (!selectedPoll || !selectedPoll.vendors) return [];
    return selectedPoll.vendors.map((v) => ({
      name: v.name,
      shortName: v.name.length > 18 ? v.name.substring(0, 16) + '...' : v.name,
      votes: Number(v.vote_count || v.votes || 0),
      percentage: v.percentage || 0,
      isWinner: winnerVendor?.id === v.id,
    }));
  }, [selectedPoll, winnerVendor]);

  const barColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiChartBar className="w-7 h-7 text-primary-600" />
            Voting & Polls Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Service Vendor Selections, Layout Resolution Voting, Targeted Street Polling, and Live Results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchPolls(selectedPoll?.id)}
            title="Refresh"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreatePollOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <HiPlus className="w-4 h-4" />
            <span>Create New Poll</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left List (1 col) + Right Detail (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Polls List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              All Association Polls ({polls.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-100 overflow-y-auto max-h-[700px] flex-1">
            {polls.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">
                No voting polls created yet. Click "Create New Poll" to start one.
              </div>
            ) : (
              polls.map((poll) => {
                const isSelected = selectedPoll?.id === poll.id;
                const isClosed = poll.status === 'closed' || poll.computed_status === 'closed';

                return (
                  <div
                    key={poll.id}
                    onClick={() => fetchPollDetail(poll.id)}
                    className={`p-4 cursor-pointer transition ${
                      isSelected
                        ? 'bg-primary-50/60 border-l-4 border-primary-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          poll.poll_type === 'election'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : poll.poll_type === 'resolution_passing'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {poll.poll_type === 'election'
                          ? `🗳️ Election (${poll.election_type === 'single_role' ? 'Single Role' : 'All Roles'})`
                          : poll.poll_type === 'resolution_passing'
                          ? 'Resolution'
                          : 'Vendor Select'}
                      </span>

                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          isClosed
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-100 text-green-800 animate-pulse'
                        }`}
                      >
                        {isClosed ? 'Closed' : 'Live Active'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{poll.title}</h3>

                    {poll.poll_type === 'election' && (
                      <p className="text-[11px] font-medium text-amber-700">
                        {poll.internal_officer_name ? `Officers: ${poll.internal_officer_name} & ${poll.external_officer_name || 'External'}` : 'Association Committee Election'}
                      </p>
                    )}
                    {poll.service_category && (
                      <p className="text-[11px] font-medium text-blue-600">
                        Category: {poll.service_category}
                      </p>
                    )}
                    {poll.resolution_task_type && (
                      <p className="text-[11px] font-medium text-purple-600">
                        Task: {poll.resolution_task_type}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                      <span>{poll.total_votes || 0} votes cast</span>
                      <span>
                        Ends {poll.end_date ? format(new Date(poll.end_date), 'dd MMM yyyy') : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Poll Detail & Live Results */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedPoll ? (
            <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center text-gray-400">
              Select a poll from the list or create a new one to view live votes and results.
            </div>
          ) : (
            <>
              {/* Poll Header Card */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          selectedPoll.poll_type === 'election'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : selectedPoll.poll_type === 'resolution_passing'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {selectedPoll.poll_type === 'election'
                          ? `🗳️ Association Election: ${selectedPoll.election_type === 'single_role' ? 'Single Role at a Time' : 'All Roles at a Time'}`
                          : selectedPoll.poll_type === 'resolution_passing'
                          ? `Resolution: ${selectedPoll.resolution_task_type || 'General'}`
                          : `Vendor Selection: ${selectedPoll.service_category || 'Service'}`}
                      </span>

                      <span
                        className={`text-xs font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          selectedPoll.status === 'closed'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {selectedPoll.status === 'closed' ? 'Closed' : 'Voting In Progress'}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900">{selectedPoll.title}</h2>
                    {selectedPoll.description && (
                      <p className="text-xs text-gray-500 mt-1">{selectedPoll.description}</p>
                    )}
                  </div>

                  {/* Actions: End Poll Now, Export, Delete */}
                  <div className="flex items-center gap-2">
                    {selectedPoll.status === 'active' && (
                      <button
                        onClick={handleEndPollNow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                      >
                        <HiStopCircle className="w-4 h-4" />
                        <span>End Poll Now</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleExportExcel(selectedPoll.id)}
                      className="p-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-xs font-medium transition"
                      title="Download Excel Report"
                    >
                      <HiArrowDownTray className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setPollToDelete(selectedPoll);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="p-2 border border-gray-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition"
                      title="Delete Poll"
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Election Polling Officers Banner (If election) */}
                {selectedPoll.poll_type === 'election' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl mt-0.5">🏛️</span>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                          Internal Polling Officer (Resident Member)
                        </span>
                        <p className="font-bold text-gray-900 text-sm mt-0.5">
                          {selectedPoll.internal_officer_name || 'Not assigned'}
                        </p>
                        {selectedPoll.internal_officer_contact && (
                          <p className="text-gray-600 text-[11px] mt-0.5">{selectedPoll.internal_officer_contact}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 sm:border-l sm:border-amber-200 sm:pl-3.5">
                      <span className="text-xl mt-0.5">🌐</span>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">
                          External Polling Officer (Observer / Returning Officer)
                        </span>
                        <p className="font-bold text-gray-900 text-sm mt-0.5">
                          {selectedPoll.external_officer_name || 'Not assigned'}
                        </p>
                        {selectedPoll.external_officer_contact && (
                          <p className="text-gray-600 text-[11px] mt-0.5">{selectedPoll.external_officer_contact}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Secret Ballot Note for Admins */}
                {selectedPoll.poll_type === 'election' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                    <span className="text-base">🔒</span>
                    <span>
                      <strong>Secret Ballot Enforced:</strong> Resident members only cast their vote. Individual vote tallies are hidden from member screens. Only the winner(s) will be visible to members after election completion.
                    </span>
                  </div>
                )}

                {/* Voter Turnout Progress Bar */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700 flex items-center gap-1">
                      <HiUserGroup className="w-4 h-4 text-primary-600" />
                      Voter Turnout & Participation:
                    </span>
                    <span className="font-bold text-primary-700">
                      {selectedPoll.total_votes || 0} / {selectedPoll.eligible_voters_count || 'All'} eligible members voted ({selectedPoll.turnout_percentage || 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, selectedPoll.turnout_percentage || 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                    <span>
                      Target Audience:{' '}
                      <strong className="text-gray-800">
                        {selectedPoll.target_audience === 'street'
                          ? `Street: ${selectedPoll.target_street}`
                          : selectedPoll.target_audience === 'selected'
                          ? 'Designated Committee / Selected Members'
                          : 'All Association Members'}
                      </strong>
                    </span>
                    <span>
                      {selectedPoll.status === 'closed'
                        ? 'Poll Session Ended'
                        : `Scheduled until: ${selectedPoll.end_date ? format(new Date(selectedPoll.end_date), 'dd MMM yyyy, hh:mm a') : 'TBD'}`}
                    </span>
                  </div>
                </div>

                {/* Election Winners per Role (If election and closed) */}
                {selectedPoll.poll_type === 'election' && selectedPoll.status === 'closed' && selectedPoll.role_winners_summary?.length > 0 && (
                  <div className="p-4 bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 text-white rounded-xl shadow-md space-y-3">
                    <div className="flex items-center gap-2 border-b border-amber-400/40 pb-2">
                      <span className="text-2xl">🏆</span>
                      <div>
                        <h3 className="text-sm font-extrabold tracking-wide uppercase">Official Election Winners Announced</h3>
                        <p className="text-[11px] text-amber-100">Duly elected Executive Committee by association member vote</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {selectedPoll.role_winners_summary.map((rw, rIdx) => (
                        <div key={rIdx} className="bg-white/15 backdrop-blur-sm p-3 rounded-lg border border-white/20">
                          <span className="text-[10px] font-bold text-amber-200 uppercase tracking-wider block">{rw.role}</span>
                          {rw.winners.map((win, wIdx) => (
                            <div key={wIdx} className="mt-1">
                              <p className="font-extrabold text-sm text-white flex items-center gap-1">
                                <span>🎖️</span> {win.name}
                              </p>
                              {win.vote_count !== null && (
                                <span className="text-[11px] text-amber-100 font-semibold">{win.vote_count} votes</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Non-election Winner Declaration Banner (If poll is closed) */}
                {selectedPoll.poll_type !== 'election' && selectedPoll.status === 'closed' && winnerVendor && (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-xl shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                        🏆
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100 block">
                          {selectedPoll.poll_type === 'resolution_passing' ? 'Winning Decision' : 'Selected Vendor / Winning Proposal'}
                        </span>
                        <h3 className="text-base font-extrabold">{winnerVendor.name}</h3>
                        {winnerVendor.quotation && (
                          <span className="text-xs font-semibold text-amber-100">
                            Quote: ₹{parseFloat(winnerVendor.quotation).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-amber-100 block">Votes Secured</span>
                      <span className="text-xl font-black">{winnerVendor.vote_count || 0}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Results Bar Chart */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Live Polling Results</h3>
                    <p className="text-xs text-gray-500">Real-time vote tallies updated instantly as members poll</p>
                  </div>
                  <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
                    {selectedPoll.total_votes || 0} Total Votes
                  </span>
                </div>

                <div className="h-64 w-full">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                      No options or proposals added to this poll yet.
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
                              fill={entry.isWinner ? '#f59e0b' : barColors[index % barColors.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Vendors / Options Breakdown List */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {selectedPoll.poll_type === 'election'
                        ? 'Election Contesting Candidates & Tallies'
                        : selectedPoll.poll_type === 'resolution_passing'
                        ? 'Resolution Choices'
                        : 'Vendor Quotations & Options'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedPoll.poll_type === 'election'
                        ? 'Confidential vote counts visible only to Association Admin'
                        : 'Breakdown of options and current tallies'}
                    </p>
                  </div>

                  {selectedPoll.status === 'active' && selectedPoll.poll_type === 'vendor_selection' && (
                    <button
                      onClick={() => setIsAddVendorOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      <HiPlus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {!selectedPoll.vendors || selectedPoll.vendors.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400 italic">
                      No options found. Click "Add Option" to add proposals.
                    </div>
                  ) : (
                    selectedPoll.vendors.map((vendor, idx) => {
                      const vVotes = Number(vendor.vote_count || vendor.votes || 0);
                      const total = selectedPoll.total_votes || 1;
                      const percentage = vendor.percentage !== undefined ? vendor.percentage : Math.round((vVotes / total) * 100);
                      const isWinner = vendor.is_winner || (winnerVendor?.id === vendor.id && selectedPoll.poll_type !== 'election');

                      return (
                        <div
                          key={vendor.id || idx}
                          className={`p-4 rounded-xl border transition ${
                            isWinner
                              ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-300'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-gray-900">{vendor.name}</h4>
                                {selectedPoll.poll_type === 'election' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                    Role: {vendor.contesting_role || vendor.company || 'Executive Member'}
                                  </span>
                                )}
                                {isWinner && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                                    <HiTrophy className="w-3 h-3 text-amber-600" /> {selectedPoll.status === 'closed' ? 'Elected Winner' : 'Leading'}
                                  </span>
                                )}
                              </div>

                              {vendor.company && selectedPoll.poll_type !== 'election' && (
                                <p className="text-xs text-gray-500">Company: {vendor.company}</p>
                              )}
                              {vendor.contact && (
                                <p className="text-xs text-gray-500">Contact/Door: {vendor.contact}</p>
                              )}
                              {vendor.notes && (
                                <p className="text-xs text-gray-600 italic">"{vendor.notes}"</p>
                              )}
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1">
                              {vendor.quotation && (
                                <span className="text-sm font-bold text-gray-900 flex items-center">
                                  ₹{parseFloat(vendor.quotation).toLocaleString()}
                                </span>
                              )}
                              <span className="text-xs font-bold text-primary-600">
                                {vVotes} Votes ({percentage}%)
                              </span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isWinner ? 'bg-amber-500' : 'bg-primary-600'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL: CREATE NEW POLL (VENDOR SELECTION OR RESOLUTION PASSING)
         ========================================================================= */}
      <Modal
        isOpen={isCreatePollOpen}
        onClose={() => setIsCreatePollOpen(false)}
        title="Create New Voting & Poll Process"
        size="lg"
      >
        <form onSubmit={handleCreatePoll} className="space-y-5">
          {/* Step 1: Poll Type Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Select Poll Type *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPollForm({ ...pollForm, poll_type: 'vendor_selection' })}
                className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                  pollForm.poll_type === 'vendor_selection'
                    ? 'border-primary-600 bg-primary-50/50 text-primary-900 ring-1 ring-primary-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <HiWrenchScrewdriver className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">Service Vendor Selection</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Compare contractor quotes (plumber, electrician, painter).
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPollForm({ ...pollForm, poll_type: 'resolution_passing' })}
                className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                  pollForm.poll_type === 'resolution_passing'
                    ? 'border-purple-600 bg-purple-50/50 text-purple-900 ring-1 ring-purple-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <HiScale className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold">Resolution Passing (Yes/No)</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Layout decisions, streetlights, gates with Yes / No member ballot.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPollForm({ ...pollForm, poll_type: 'election' })}
                className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 ${
                  pollForm.poll_type === 'election'
                    ? 'border-amber-600 bg-amber-50/60 text-amber-950 ring-1 ring-amber-500'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">🗳️</span>
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Association Election Polling</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Executive committee election (all roles or single role) with polling officers & secret ballot.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Controls by Poll Type */}
          {pollForm.poll_type === 'vendor_selection' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Service Category *
              </label>
              <select
                value={pollForm.service_category}
                onChange={(e) => setPollForm({ ...pollForm, service_category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {SERVICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {pollForm.poll_type === 'resolution_passing' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Resolution Task / Project Type *
              </label>
              <select
                value={pollForm.resolution_task_type}
                onChange={(e) => setPollForm({ ...pollForm, resolution_task_type: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {RESOLUTION_TASK_TYPES.map((task) => (
                  <option key={task} value={task}>
                    {task}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Election Setup Section */}
          {pollForm.poll_type === 'election' && (
            <div className="space-y-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
              {/* Election Scope: All Roles vs Single Role */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
                  Election Scope / Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      pollForm.election_type === 'all_roles'
                        ? 'bg-amber-100/70 border-amber-500 text-amber-950 font-semibold'
                        : 'bg-white border-gray-200 hover:border-amber-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="election_type"
                      checked={pollForm.election_type === 'all_roles'}
                      onChange={() => setPollForm({ ...pollForm, election_type: 'all_roles' })}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold block">All Roles at a Time</span>
                      <span className="text-[11px] text-gray-500 block">
                        Full Executive Committee ballot across multiple roles (President, Secretary, Treasurer, etc.)
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                      pollForm.election_type === 'single_role'
                        ? 'bg-amber-100/70 border-amber-500 text-amber-950 font-semibold'
                        : 'bg-white border-gray-200 hover:border-amber-300 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="election_type"
                      checked={pollForm.election_type === 'single_role'}
                      onChange={() => setPollForm({ ...pollForm, election_type: 'single_role' })}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="text-xs font-bold block">Only One Role at a Time</span>
                      <span className="text-[11px] text-gray-500 block">
                        Dedicated election focused on a specific single post (e.g. President only)
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Polling Officers Assignment */}
              <div className="pt-2 border-t border-amber-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-900">
                    Official Polling Officers (Nominated by Admin) *
                  </label>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    2 Officers Required
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Select 1 resident member as the Internal Polling Officer, and enter 1 outside observer as the External Polling Officer.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Internal Polling Officer (Picked from Association Members) */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      🏛️ Internal Polling Officer (Resident Member) *
                    </span>
                    <select
                      value={pollForm.internal_officer_id}
                      onChange={(e) => handleInternalOfficerSelect(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      required
                    >
                      <option value="">-- Choose Approved Member --</option>
                      {associationMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.door_number ? `(Door ${m.door_number})` : ''} - {m.phone || m.email}
                        </option>
                      ))}
                    </select>
                    {pollForm.internal_officer_contact && (
                      <p className="text-[11px] text-gray-500 italic">
                        Contact: {pollForm.internal_officer_contact}
                      </p>
                    )}
                  </div>

                  {/* External Polling Officer (Outside person) */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      🌐 External Polling Officer (Outside Observer) *
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Officer Full Name *"
                      value={pollForm.external_officer_name}
                      onChange={(e) => setPollForm({ ...pollForm, external_officer_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Phone / Contact"
                        value={pollForm.external_officer_contact}
                        onChange={(e) => setPollForm({ ...pollForm, external_officer_contact: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Agency / Org / Title"
                        value={pollForm.external_officer_org}
                        onChange={(e) => setPollForm({ ...pollForm, external_officer_org: e.target.value })}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Title & Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Poll Title *
            </label>
            <input
              type="text"
              required
              placeholder={
                pollForm.poll_type === 'election'
                  ? 'e.g. Annual Executive Committee General Election 2026-2027'
                  : pollForm.poll_type === 'vendor_selection'
                  ? 'e.g. Layout Overhead Tank & Motor Plumbing Contractor Selection'
                  : 'e.g. Installation of Boom Barrier & 24/7 Security Gate at 1st Cross Road'
              }
              value={pollForm.title}
              onChange={(e) => setPollForm({ ...pollForm, title: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description / Proposal Details
            </label>
            <textarea
              rows={3}
              placeholder="Provide background, quotation summaries, cost sharing, and guidelines for voters..."
              value={pollForm.description}
              onChange={(e) => setPollForm({ ...pollForm, description: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Target Audience / Voter Eligibility */}
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Voter Eligibility & Target Audience *
            </label>
            <div className="flex flex-wrap gap-4 text-xs font-medium text-gray-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="target_audience"
                  checked={pollForm.target_audience === 'all'}
                  onChange={() => setPollForm({ ...pollForm, target_audience: 'all' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span>All Association Members</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="target_audience"
                  checked={pollForm.target_audience === 'street'}
                  onChange={() => setPollForm({ ...pollForm, target_audience: 'street' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span>Specific Street / Block Members Only</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="target_audience"
                  checked={pollForm.target_audience === 'selected'}
                  onChange={() => setPollForm({ ...pollForm, target_audience: 'selected' })}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span>Designated Committee / Selected Members</span>
              </label>
            </div>

            {pollForm.target_audience === 'street' && (
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Specify Target Street / Block Name (e.g. 1st Cross Street, Main Avenue):
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1st Cross Street"
                  value={pollForm.target_street}
                  onChange={(e) => setPollForm({ ...pollForm, target_street: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {pollForm.target_audience === 'selected' && (
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-gray-600">
                    Select Committee Members Allowed to Vote:
                  </label>
                  <span className="text-[10px] text-primary-600 font-bold">
                    {(pollForm.target_user_ids || []).length} selected
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-white">
                  {associationMembers.length === 0 ? (
                    <p className="text-xs text-gray-400 p-2">No approved members found in association.</p>
                  ) : (
                    associationMembers.map((m) => {
                      const isChecked = (pollForm.target_user_ids || []).includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setPollForm({
                                  ...pollForm,
                                  target_user_ids: [...(pollForm.target_user_ids || []), m.id],
                                });
                              } else {
                                setPollForm({
                                  ...pollForm,
                                  target_user_ids: (pollForm.target_user_ids || []).filter((id) => id !== m.id),
                                });
                              }
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="font-semibold text-gray-800">{m.name}</span>
                          <span className="text-gray-400 text-[11px]">
                            ({m.email} {m.door_number ? `• Door: ${m.door_number}` : ''})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Vendors Input (Only for Service Vendor Selection) */}
          {pollForm.poll_type === 'vendor_selection' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Vendor Candidates / Options ({pollForm.vendors.length})
                </label>
                <button
                  type="button"
                  onClick={handleAddVendorOption}
                  className="text-xs font-bold text-primary-600 hover:text-primary-800 flex items-center gap-1"
                >
                  <HiPlus className="w-3.5 h-3.5" /> Add Another Vendor Option
                </button>
              </div>

              {pollForm.vendors.map((vendor, vIdx) => (
                <div
                  key={vIdx}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-primary-800">
                      Option #{vIdx + 1}
                    </span>
                    {pollForm.vendors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVendorOption(vIdx)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Remove Option"
                      >
                        <HiTrash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Vendor / Agency Name *"
                      value={vendor.name}
                      onChange={(e) => handleVendorFieldChange(vIdx, 'name', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      placeholder="Quotation (₹)"
                      value={vendor.quotation}
                      onChange={(e) => handleVendorFieldChange(vIdx, 'quotation', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Contact / Phone"
                      value={vendor.contact}
                      onChange={(e) => handleVendorFieldChange(vIdx, 'contact', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Short proposal notes or terms (optional)"
                    value={vendor.notes}
                    onChange={(e) => handleVendorFieldChange(vIdx, 'notes', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded-lg"
                  />
                </div>
              ))}
            </div>
          ) : pollForm.poll_type === 'resolution_passing' ? (
            /* Resolution passing Yes/No note */
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between text-xs text-purple-900">
              <span className="font-semibold">Automatic Ballot Options:</span>
              <div className="flex gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  ✓ Yes (In Favor / Approve)
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                  ✗ No (Against / Reject)
                </span>
              </div>
            </div>
          ) : (
            /* Election Contesting Roles & Candidates Builder */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-900">
                    {pollForm.election_type === 'single_role'
                      ? 'Contesting Role & Candidates *'
                      : `Executive Committee Roles & Candidates (${pollForm.election_roles_builder.length} Roles) *`}
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Type role names manually. Members can stand for any role they desire by notifying the admin.
                  </p>
                </div>

                {pollForm.election_type === 'all_roles' && (
                  <button
                    type="button"
                    onClick={handleAddElectionRole}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg border border-amber-300 transition"
                  >
                    <HiPlus className="w-3.5 h-3.5" />
                    <span>Add Another Role</span>
                  </button>
                )}
              </div>

              {pollForm.election_roles_builder.map((roleObj, rIdx) => (
                <div
                  key={rIdx}
                  className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {rIdx + 1}
                      </span>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900">
                          Role / Designation Name * (Write manually)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. President, Secretary, Treasurer, Vice President"
                          value={roleObj.role_name}
                          onChange={(e) => handleRoleNameChange(rIdx, e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white font-bold text-gray-900 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    {pollForm.election_type === 'all_roles' && pollForm.election_roles_builder.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveElectionRole(rIdx)}
                        className="text-gray-400 hover:text-red-600 p-1.5 self-end mb-1"
                        title="Remove Role"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Contesting Candidates under this role */}
                  <div className="space-y-2 pt-2 border-t border-amber-200/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-700">
                        Candidates Standing for {roleObj.role_name || 'this role'} ({(roleObj.candidates || []).length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddCandidateToRole(rIdx)}
                        className="text-[11px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                      >
                        <HiPlus className="w-3 h-3" /> Add Candidate
                      </button>
                    </div>

                    {(roleObj.candidates || []).map((cand, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-2.5 bg-white rounded-lg border border-gray-200 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-gray-500">
                            Candidate #{cIdx + 1}
                          </span>
                          {roleObj.candidates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCandidateFromRole(rIdx, cIdx)}
                              className="text-gray-400 hover:text-red-600 p-0.5"
                              title="Remove Candidate"
                            >
                              <HiTrash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Candidate Full Name *"
                            value={cand.name}
                            onChange={(e) => handleCandidateFieldChange(rIdx, cIdx, 'name', e.target.value)}
                            className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="Door / Contact / Flat Details"
                            value={cand.contact}
                            onChange={(e) => handleCandidateFieldChange(rIdx, cIdx, 'contact', e.target.value)}
                            className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Candidate manifesto or note (optional)"
                          value={cand.notes}
                          onChange={(e) => handleCandidateFieldChange(rIdx, cIdx, 'notes', e.target.value)}
                          className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scheduling Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={pollForm.start_date}
                onChange={(e) => setPollForm({ ...pollForm, start_date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                End Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={pollForm.end_date}
                onChange={(e) => setPollForm({ ...pollForm, end_date: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Anonymous Ballot Checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={pollForm.is_anonymous}
                onChange={(e) => setPollForm({ ...pollForm, is_anonymous: e.target.checked })}
                className="rounded text-primary-600 focus:ring-primary-500"
              />
              <span>Keep ballot anonymous (resident identities hidden in results)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsCreatePollOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Creating Poll...' : 'Start Scheduled Poll'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: ADD VENDOR OPTION TO EXISTING POLL */}
      <Modal
        isOpen={isAddVendorOpen}
        onClose={() => setIsAddVendorOpen(false)}
        title={`Add Option — ${selectedPoll?.title || ''}`}
        size="md"
      >
        <form onSubmit={handleAddVendor} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Vendor / Option Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Master Plumbing Services"
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Company / Agency
              </label>
              <input
                type="text"
                placeholder="e.g. Master Enterprises"
                value={vendorForm.company}
                onChange={(e) => setVendorForm({ ...vendorForm, company: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Contact Person / Phone
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={vendorForm.contact}
                onChange={(e) => setVendorForm({ ...vendorForm, contact: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Quotation (INR ₹)
            </label>
            <input
              type="number"
              placeholder="e.g. 45000"
              value={vendorForm.quotation}
              onChange={(e) => setVendorForm({ ...vendorForm, quotation: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Proposal Notes
            </label>
            <textarea
              rows={2}
              placeholder="Warranty terms, completion timeline, etc."
              value={vendorForm.notes}
              onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsAddVendorOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Adding...' : 'Add Proposal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeletePoll}
        title="Delete Voting Poll"
        message={`Are you sure you want to delete "${pollToDelete?.title}"? Note: polls with cast votes cannot be deleted.`}
        confirmText="Delete Poll"
        isDestructive
        loading={submitting}
      />
    </div>
  );
}
