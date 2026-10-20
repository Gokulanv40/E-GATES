import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiUsers,
  HiUserPlus,
  HiChartBar,
  HiExclamationCircle,
  HiShieldExclamation,
  HiNewspaper,
  HiCalendar,
  HiPlus,
  HiArrowPath,
  HiBuildingOffice2,
  HiEye,
  HiArrowRight,
  HiMagnifyingGlass,
  HiMapPin,
  HiPhone,
  HiXMark,
  HiCheckCircle,
  HiClock,
  HiBookmark,
  HiSpeakerWave,
  HiPaperClip,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import StatsCard from '../../components/common/StatsCard';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [associationInfo, setAssociationInfo] = useState(null);

  // Full datasets for 50/50 dashboard
  const [membersList, setMembersList] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [pollsList, setPollsList] = useState([]);
  const [complaintsList, setComplaintsList] = useState([]);
  const [sosList, setSosList] = useState([]);
  const [newsList, setNewsList] = useState([]);
  const [eventsList, setEventsList] = useState([]);

  // Stats Counters (No maintenance dues)
  const [stats, setStats] = useState({
    totalMembers: 0,
    pendingApprovals: 0,
    activePolls: 0,
    openComplaints: 0,
    sosToday: 0,
  });

  // Filter & Search states for News Board (Left 50%)
  const [newsSearch, setNewsSearch] = useState('');
  const [newsCategory, setNewsCategory] = useState('all');

  // Filter & Search states for Active Members (Right 50%)
  const [memberSearch, setMemberSearch] = useState('');

  // Drilldown Modal state: null | 'members' | 'complaints' | 'sos'
  const [activeDrilldown, setActiveDrilldown] = useState(null);
  const [modalSearch, setModalSearch] = useState('');
  const [modalFilter, setModalFilter] = useState('all');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        assocRes,
        usersRes,
        pendingRes,
        pollsRes,
        complaintsRes,
        sosRes,
        newsRes,
        eventsRes,
      ] = await Promise.allSettled([
        user?.association_id ? api.get(`/associations/${user.association_id}`) : Promise.reject(),
        api.get('/users'),
        api.get('/users/pending'),
        api.get('/voting/polls'),
        api.get('/complaints'),
        api.get('/sos/alerts'),
        api.get('/news'),
        api.get('/events'),
      ]);

      if (assocRes.status === 'fulfilled') {
        setAssociationInfo(assocRes.value.data?.data || assocRes.value.data);
      }

      const rawUsers = usersRes.status === 'fulfilled' ? (usersRes.value.data?.data || usersRes.value.data || []) : [];
      const rawPending = pendingRes.status === 'fulfilled' ? (pendingRes.value.data?.data || pendingRes.value.data || []) : [];
      const rawPolls = pollsRes.status === 'fulfilled' ? (pollsRes.value.data?.data || pollsRes.value.data || []) : [];
      const rawComplaints = complaintsRes.status === 'fulfilled' ? (complaintsRes.value.data?.data || complaintsRes.value.data || []) : [];
      const rawSos = sosRes.status === 'fulfilled' ? (sosRes.value.data?.data || sosRes.value.data || []) : [];
      const rawNews = newsRes.status === 'fulfilled' ? (newsRes.value.data?.data || newsRes.value.data || []) : [];
      const rawEvents = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.data || eventsRes.value.data || []) : [];

      const membersOnly = rawUsers.filter((u) => u.role === 'member');
      setMembersList(membersOnly);
      setPendingList(rawPending);
      setPollsList(rawPolls);
      setComplaintsList(rawComplaints);
      setSosList(rawSos);
      setNewsList(rawNews);
      setEventsList(rawEvents);

      const activePollsCount = rawPolls.filter((p) => p.status === 'active').length;
      const openComplaintsCount = rawComplaints.filter((c) => c.status === 'open' || c.status === 'in_progress').length;

      const todayStr = new Date().toISOString().split('T')[0];
      const sosTodayCount = rawSos.filter((s) => {
        const d = s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : '';
        return d === todayStr;
      }).length;

      setStats({
        totalMembers: membersOnly.length,
        pendingApprovals: rawPending.length,
        activePolls: activePollsCount,
        openComplaints: openComplaintsCount,
        sosToday: sosTodayCount,
      });
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
      toast.error('Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [user?.association_id]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const assocDisplayName =
    associationInfo?.name || user?.association_name || 'Layout Association Portal';

  // Filtered News for Left Half
  const filteredNews = useMemo(() => {
    return newsList
      .filter((n) => {
        const matchCat = newsCategory === 'all' || n.category === newsCategory;
        const q = newsSearch.toLowerCase();
        const matchSearch =
          !newsSearch ||
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q);
        return matchCat && matchSearch;
      })
      .sort((a, b) => {
        if (a.is_pinned === b.is_pinned) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        return a.is_pinned ? -1 : 1;
      });
  }, [newsList, newsCategory, newsSearch]);

  // Filtered Members for Right Half
  const filteredActiveMembers = useMemo(() => {
    return membersList.filter((m) => {
      if (!memberSearch) return true;
      const q = memberSearch.toLowerCase();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.door_no?.toLowerCase().includes(q) ||
        m.street?.toLowerCase().includes(q)
      );
    });
  }, [membersList, memberSearch]);

  // Active or Recent SOS Alerts
  const activeSosAlerts = useMemo(() => {
    return sosList.filter((s) => s.status === 'triggered' || s.status === 'in_progress');
  }, [sosList]);

  // Upcoming Community Events
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return eventsList
      .filter((e) => new Date(e.event_date) >= now)
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  }, [eventsList]);

  // Filtered members for modal
  const modalFilteredMembers = useMemo(() => {
    return membersList.filter((m) => {
      if (!modalSearch) return true;
      const q = modalSearch.toLowerCase();
      return (
        m.name?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.door_no?.toLowerCase().includes(q) ||
        m.street?.toLowerCase().includes(q) ||
        m.member_code?.toLowerCase().includes(q)
      );
    });
  }, [membersList, modalSearch]);

  // Filtered complaints for modal
  const modalFilteredComplaints = useMemo(() => {
    return complaintsList.filter((c) => {
      const matchFilter =
        modalFilter === 'all' ||
        (modalFilter === 'open' && (c.status === 'open' || c.status === 'in_progress')) ||
        c.status === modalFilter;

      if (!matchFilter) return false;
      if (!modalSearch) return true;
      const q = modalSearch.toLowerCase();
      return (
        c.title?.toLowerCase().includes(q) ||
        c.category?.toLowerCase().includes(q) ||
        c.user_name?.toLowerCase().includes(q) ||
        c.door_no?.toLowerCase().includes(q)
      );
    });
  }, [complaintsList, modalFilter, modalSearch]);

  // Filtered SOS for modal
  const modalFilteredSos = useMemo(() => {
    return sosList.filter((s) => {
      if (!modalSearch) return true;
      const q = modalSearch.toLowerCase();
      return (
        s.user_name?.toLowerCase().includes(q) ||
        s.emergency_type?.toLowerCase().includes(q) ||
        s.user_door_no?.toLowerCase().includes(q) ||
        s.user_phone?.includes(q)
      );
    });
  }, [sosList, modalSearch]);

  const openModal = (type) => {
    setActiveDrilldown(type);
    setModalSearch('');
    setModalFilter('all');
  };

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/api\/v1\/?$/, '');
    return `${base}/${filePath.replace(/\\/g, '/').replace(/^\/?/, '')}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header (Minimal) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            {assocDisplayName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {associationInfo?.city ? `${associationInfo.city} • ` : ''}
            {associationInfo?.address || 'Community Administration Portal'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboardData}
            title="Refresh dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 shadow-sm transition"
          >
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin text-primary-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Stats Cards Row (5 Cards - Maintenance removed) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatsCard
          title="Active Members"
          value={stats.totalMembers}
          icon={HiUsers}
          variant="blue"
          subtitle="Click to view all"
          onClick={() => openModal('members')}
        />
        <StatsCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={HiUserPlus}
          variant="yellow"
          subtitle={user?.is_main_admin ? "Review & approve" : "Main Admin approval"}
          onClick={() => navigate(user?.is_main_admin ? '/admin/approvals' : '/admin/users')}
        />
        <StatsCard
          title="Active Polls"
          value={stats.activePolls}
          icon={HiChartBar}
          variant="green"
          subtitle="Ongoing voting"
          onClick={() => navigate('/admin/voting')}
        />
        <StatsCard
          title="Open Complaints"
          value={stats.openComplaints}
          icon={HiExclamationCircle}
          variant="purple"
          subtitle="Pending tickets"
          onClick={() => openModal('complaints')}
        />
        <StatsCard
          title="Active SOS (Today)"
          value={stats.sosToday}
          icon={HiShieldExclamation}
          variant={stats.sosToday > 0 ? 'red' : 'blue'}
          subtitle="Distress alerts"
          onClick={() => openModal('sos')}
        />
      </div>

      {/* =========================================================================
          50 / 50 SPLIT:
          LEFT HALF: DAILY NEWS AND NOTICE BOARD
          RIGHT HALF: ACTIVE MEMBERS, ACTIVE SOS ALERTS, COMMUNITY EVENTS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ==================== LEFT HALF: DAILY NEWS & NOTICES ==================== */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <HiNewspaper className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Daily News & Notice Board</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Official announcements, notices, and updates published to residents
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/news')}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                <HiPlus className="w-3.5 h-3.5" />
                <span>Post Notice</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
              {['all', 'Urgent', 'Meeting', 'General'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setNewsCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                    newsCategory === cat
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <HiMagnifyingGlass className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search notices..."
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* News Feed Stream */}
          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1 divide-y divide-gray-100">
            {filteredNews.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">
                No news or notices published matching your filter. Click "+ Post Notice" to publish.
              </div>
            ) : (
              filteredNews.map((news) => {
                const isUrgent = news.category === 'Urgent';
                const isMeeting = news.category === 'Meeting';

                return (
                  <div key={news.id} className="pt-3.5 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {news.is_pinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                            <HiBookmark className="w-3 h-3 text-amber-600" /> Pinned
                          </span>
                        )}
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            isUrgent
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : isMeeting
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {news.category || 'General'}
                        </span>
                      </div>

                      <span className="text-[11px] text-gray-400 font-medium">
                        {news.created_at ? format(new Date(news.created_at), 'dd MMM yyyy, hh:mm a') : ''}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900 hover:text-primary-600 transition">
                      {news.title}
                    </h3>

                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {news.content}
                    </p>

                    {/* Image / Attachment / Voice Message Indicator */}
                    {(news.image || news.attachment || news.voice_message) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        {news.image && (
                          <a
                            href={resolveFileUrl(news.image)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary-600 hover:underline font-semibold"
                          >
                            <HiPaperClip className="w-3.5 h-3.5" /> View Photo
                          </a>
                        )}
                        {news.attachment && (
                          <a
                            href={resolveFileUrl(news.attachment)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary-600 hover:underline font-semibold"
                          >
                            <HiPaperClip className="w-3.5 h-3.5" /> View Document
                          </a>
                        )}
                        {news.voice_message && (
                          <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-semibold">
                            <HiSpeakerWave className="w-3.5 h-3.5" /> Voice Announcement
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
            <span className="text-gray-400 font-medium">
              Showing {filteredNews.length} of {newsList.length} announcements
            </span>
            <button
              onClick={() => navigate('/admin/news')}
              className="text-primary-600 hover:text-primary-800 font-bold inline-flex items-center gap-1"
            >
              Open Full News Manager &rarr;
            </button>
          </div>
        </div>

        {/* ==================== RIGHT HALF: 3 STACKED SECTIONS ==================== */}
        <div className="space-y-6">
          {/* SECTION 1: ACTIVE MEMBERS DIRECTORY */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <HiUsers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Active Members Directory ({membersList.length})
                  </h3>
                </div>
              </div>

              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs font-bold text-primary-600 hover:text-primary-800 inline-flex items-center gap-1"
              >
                Manage Users &rarr;
              </button>
            </div>

            {/* Quick search */}
            <div className="relative">
              <HiMagnifyingGlass className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search member by name, door no, phone..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Members Quick List */}
            <div className="space-y-2 max-h-56 overflow-y-auto divide-y divide-gray-50">
              {filteredActiveMembers.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No active members matching "{memberSearch}"
                </div>
              ) : (
                filteredActiveMembers.slice(0, 5).map((m) => (
                  <div key={m.id} className="pt-2 first:pt-0 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xs">
                        {m.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{m.name}</h4>
                        <p className="text-[11px] text-gray-500">
                          Door #{m.door_no || 'N/A'} • {m.street || 'Layout'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <a
                        href={`tel:${m.phone}`}
                        className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1 justify-end"
                      >
                        <HiPhone className="w-3 h-3" /> {m.phone || 'N/A'}
                      </a>
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.2 rounded font-medium">
                        Approved Resident
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredActiveMembers.length > 5 && (
              <div className="pt-1 text-center">
                <button
                  onClick={() => openModal('members')}
                  className="text-xs text-primary-600 hover:text-primary-800 font-semibold"
                >
                  + View {filteredActiveMembers.length - 5} more members
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: ACTIVE SOS ALERTS */}
          <div className="bg-white rounded-2xl p-5 border border-red-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <HiShieldExclamation className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    Active SOS Emergency Alerts
                    {activeSosAlerts.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                    )}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => navigate('/admin/sos-alerts')}
                className="text-xs font-bold text-red-600 hover:text-red-800 inline-flex items-center gap-1"
              >
                Command Center &rarr;
              </button>
            </div>

            {/* Active Distress Signals */}
            {activeSosAlerts.length === 0 ? (
              <div className="py-4 bg-emerald-50/50 rounded-xl border border-emerald-100 p-3 flex items-center gap-2 text-xs text-emerald-800">
                <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-bold">All Clear in Association</p>
                  <p className="text-[11px] text-emerald-700">No active emergency distress signals at this time.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeSosAlerts.map((sos) => (
                  <div
                    key={sos.id}
                    className="p-3 bg-red-50/80 rounded-xl border border-red-200 flex items-center justify-between gap-3 animate-pulse"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-red-700 uppercase">
                          🚨 {sos.emergency_type || 'SOS Alarm'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {sos.created_at ? format(new Date(sos.created_at), 'hh:mm a') : ''}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-900 mt-0.5">
                        {sos.user_name} (Door: {sos.user_door_no || 'N/A'}, {sos.user_street || ''})
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${sos.user_phone}`}
                        className="px-2.5 py-1 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center gap-1"
                      >
                        <HiPhone className="w-3 h-3" /> Call
                      </a>
                      {sos.latitude && sos.longitude && (
                        <a
                          href={`https://maps.google.com/?q=${sos.latitude},${sos.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 flex items-center gap-1"
                        >
                          <HiMapPin className="w-3 h-3" /> GPS
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: COMMUNITY EVENTS & FESTIVALS */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
                  <HiCalendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Upcoming Events & Festivals
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/admin/events')}
                  className="text-xs font-bold text-primary-600 hover:text-primary-800 inline-flex items-center gap-1"
                >
                  Full 12M Calendar &rarr;
                </button>
              </div>
            </div>

            {/* Events List */}
            <div className="space-y-2.5 max-h-56 overflow-y-auto divide-y divide-gray-50">
              {upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No upcoming community events or festivals scheduled.
                </div>
              ) : (
                upcomingEvents.slice(0, 4).map((evt) => (
                  <div key={evt.id} className="pt-2 first:pt-0 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-primary-700 block">
                        {evt.event_date ? format(new Date(evt.event_date), 'dd MMM yyyy, hh:mm a') : 'TBD'}
                      </span>
                      <h4 className="text-xs font-bold text-gray-900 line-clamp-1">{evt.title}</h4>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1">
                        <HiMapPin className="w-3 h-3 text-red-500" />
                        {evt.location || 'Community Grounds'}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate('/admin/events')}
                      className="text-[11px] text-primary-600 font-semibold hover:underline flex-shrink-0 pt-1"
                    >
                      Details &rarr;
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
              <span className="text-gray-400">Annual Festivals Pre-Loaded</span>
              <button
                onClick={() => navigate('/admin/events')}
                className="text-xs font-bold text-primary-600 hover:text-primary-700"
              >
                + Add / Manage Events
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          DRILLDOWN MODALS (Active Members, Complaints, SOS)
         ========================================================================= */}

      {/* MODAL 1: ACTIVE MEMBERS DRILLDOWN */}
      <Modal
        isOpen={activeDrilldown === 'members'}
        onClose={() => setActiveDrilldown(null)}
        title={`Registered Association Members (${membersList.length})`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <HiMagnifyingGlass className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search member, door no, phone..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={() => {
                setActiveDrilldown(null);
                navigate('/admin/users');
              }}
              className="text-xs font-bold text-primary-600 hover:text-primary-800 inline-flex items-center gap-1"
            >
              Open Manage Users <HiArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto max-h-[60vh] border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5">Member Name</th>
                  <th className="px-3 py-2.5">Door No / Street</th>
                  <th className="px-3 py-2.5">Phone & Email</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modalFilteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      No members matching "{modalSearch}"
                    </td>
                  </tr>
                ) : (
                  modalFilteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 transition">
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {m.name}
                        {m.member_code && (
                          <span className="block text-[10px] text-gray-400 font-normal">
                            Code: {m.member_code}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-gray-800">{m.door_no || 'N/A'}</span>
                        <span className="block text-[10px] text-gray-500">{m.street || 'Main Layout'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="block font-medium text-gray-800">{m.phone || 'N/A'}</span>
                        <span className="text-[10px] text-gray-500">{m.email}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                          {m.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400">
                        {m.created_at ? format(new Date(m.created_at), 'dd MMM yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: COMPLAINTS DRILLDOWN */}
      <Modal
        isOpen={activeDrilldown === 'complaints'}
        onClose={() => setActiveDrilldown(null)}
        title={`Member Grievances & Tickets (${complaintsList.length})`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['all', 'open', 'resolved', 'closed'].map((f) => (
                <button
                  key={f}
                  onClick={() => setModalFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    modalFilter === f
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'open' ? 'Pending' : f}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60">
              <HiMagnifyingGlass className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search ticket, title..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[60vh] border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5">Title & Category</th>
                  <th className="px-3 py-2.5">Resident</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Filed On</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modalFilteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      No complaints found.
                    </td>
                  </tr>
                ) : (
                  modalFilteredComplaints.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-gray-900 block">{c.title}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">{c.category || 'General'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-gray-800">{c.user_name || 'Resident'}</span>
                        <span className="block text-[10px] text-gray-400">Door: {c.door_no || 'N/A'}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.priority === 'urgent'
                              ? 'bg-red-100 text-red-800'
                              : c.priority === 'high'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {c.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            c.status === 'open' || c.status === 'in_progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {c.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-400">
                        {c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy') : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: SOS DISTRESS ALERTS DRILLDOWN */}
      <Modal
        isOpen={activeDrilldown === 'sos'}
        onClose={() => setActiveDrilldown(null)}
        title={`Emergency Distress SOS Alerts (${sosList.length})`}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Immediate distress events logged by layout residents with GPS coordinates.
            </p>
            <button
              onClick={() => {
                setActiveDrilldown(null);
                navigate('/admin/sos-alerts');
              }}
              className="text-xs font-bold text-red-600 hover:text-red-800"
            >
              Emergency Command Center &rarr;
            </button>
          </div>

          <div className="overflow-x-auto max-h-[60vh] border border-gray-100 rounded-xl">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-red-50 text-red-900 font-bold uppercase text-[10px] tracking-wider sticky top-0 border-b border-red-100">
                <tr>
                  <th className="px-3 py-2.5">Distress Type</th>
                  <th className="px-3 py-2.5">Resident & Door</th>
                  <th className="px-3 py-2.5">Phone Contact</th>
                  <th className="px-3 py-2.5">Triggered At</th>
                  <th className="px-3 py-2.5">GPS Location</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {modalFilteredSos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">
                      No SOS alerts recorded.
                    </td>
                  </tr>
                ) : (
                  modalFilteredSos.map((s) => (
                    <tr key={s.id} className="hover:bg-red-50/30 transition">
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-red-600 block flex items-center gap-1">
                          <HiShieldExclamation className="w-3.5 h-3.5" />
                          {s.emergency_type || 'Emergency'}
                        </span>
                        {s.is_test && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-gray-200 text-gray-700">
                            TEST DRILL
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-gray-900 block">{s.user_name || 'Resident'}</span>
                        <span className="text-[10px] text-gray-500">Door: {s.user_door_no || 'N/A'}, {s.user_street || ''}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <a
                          href={`tel:${s.user_phone}`}
                          className="font-semibold text-primary-600 hover:underline flex items-center gap-1"
                        >
                          <HiPhone className="w-3 h-3" /> {s.user_phone || 'N/A'}
                        </a>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">
                        {s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                      </td>
                      <td className="px-3 py-2.5">
                        {s.latitude && s.longitude ? (
                          <a
                            href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[10px] transition"
                          >
                            <HiMapPin className="w-3 h-3 text-blue-500" />
                            Google Maps
                          </a>
                        ) : (
                          <span className="text-gray-400 text-[10px]">No GPS</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.status === 'triggered'
                              ? 'bg-red-100 text-red-800 animate-pulse'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
