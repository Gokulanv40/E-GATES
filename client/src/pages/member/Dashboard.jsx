import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiShieldExclamation,
  HiPhone,
  HiChartBar,
  HiExclamationCircle,
  HiNewspaper,
  HiCalendar,
  HiArrowPath,
  HiBuildingOffice2,
  HiArrowRight,
  HiXMark,
  HiCheckCircle,
  HiSpeakerWave,
  HiMegaphone,
  HiChartBarSquare,
  HiChatBubbleLeftRight,
  HiDocumentText,
  HiArrowDownTray,
  HiEye,
  HiMagnifyingGlass,
  HiFolderOpen,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useSOS } from '../../hooks/useSOS';
import { useSocket } from '../../hooks/useSocket';
import api from '../../services/api';
import StatsCard from '../../components/common/StatsCard';
import Modal from '../../components/common/Modal';
import AudioPlayer from '../../components/common/AudioPlayer';

export default function MemberDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { socket } = useSocket();

  const {
    showTypeSelector,
    setShowTypeSelector,
    selectedType,
    showCancel,
    cancelCountdown,
    isSending,
    isTriggered,
    lastAlert,
    selectTypeAndStartCountdown,
    triggerSOS,
    cancelSOS,
    resetSOS,
  } = useSOS();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeNotices: 0,
    activePolls: 0,
    myComplaintsOpen: 0,
    totalDocuments: 0,
  });

  const [recentNews, setRecentNews] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [docFilter, setDocFilter] = useState('all');

  // Socket SOS incoming alert popup
  const [incomingSOS, setIncomingSOS] = useState(null);

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    let clean = filePath.replace(/\\/g, '/');
    const idx = clean.indexOf('uploads/');
    if (idx !== -1) {
      clean = clean.substring(idx);
    }
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/v1\/?$/, '');
    return `${base}/${clean.replace(/^\/?/, '')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleDownloadDocument = async (doc) => {
    try {
      toast.loading(`Downloading ${doc.title}...`, { id: 'download' });
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = doc.file_path ? doc.file_path.split('.').pop() : 'pdf';
      link.download = `${doc.title.replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download complete', { id: 'download' });
    } catch (err) {
      console.error('Download failed:', err);
      const fileUrl = resolveFileUrl(doc.file_path);
      if (fileUrl) {
        window.open(fileUrl, '_blank');
        toast.dismiss('download');
      } else {
        toast.error('Failed to download document', { id: 'download' });
      }
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      const q = docSearch.toLowerCase();
      const matchSearch =
        !docSearch ||
        d.title?.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (docFilter === 'all') return true;

      const ext = (d.file_path || '').split('.').pop()?.toLowerCase();
      if (docFilter === 'pdf') return ext === 'pdf';
      if (docFilter === 'image') return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      if (docFilter === 'other') return !['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext);
      return true;
    });
  }, [documents, docSearch, docFilter]);

  const fetchMemberDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [complaintsRes, pollsRes, newsRes, eventsRes, docsRes] = await Promise.allSettled([
        api.get('/complaints'),
        api.get('/voting/polls'),
        api.get('/news'),
        api.get('/events'),
        api.get('/documents'),
      ]);

      const complaints = complaintsRes.status === 'fulfilled' ? (complaintsRes.value.data?.data || complaintsRes.value.data || []) : [];
      const polls = pollsRes.status === 'fulfilled' ? (pollsRes.value.data?.data || pollsRes.value.data || []) : [];
      const news = newsRes.status === 'fulfilled' ? (newsRes.value.data?.data || newsRes.value.data || []) : [];
      const events = eventsRes.status === 'fulfilled' ? (eventsRes.value.data?.data || eventsRes.value.data || []) : [];
      const docs = docsRes.status === 'fulfilled' ? (docsRes.value.data?.data || docsRes.value.data || []) : [];

      const openComplaintsCount = complaints.filter(
        (c) => c.status === 'open' || c.status === 'in_progress'
      ).length;

      const activePollsCount = polls.filter((p) => p.status === 'active').length;
      const docList = Array.isArray(docs) ? docs : [];

      setDocuments(docList);
      setStats({
        activeNotices: news.length,
        activePolls: activePollsCount,
        myComplaintsOpen: openComplaintsCount,
        totalDocuments: docList.length,
      });

      // Top 3 news
      setRecentNews(news.slice(0, 3));

      // Top 2 upcoming events
      const now = new Date();
      const upcoming = events
        .filter((e) => new Date(e.event_date) >= now)
        .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
        .slice(0, 2);
      setUpcomingEvents(upcoming.length > 0 ? upcoming : events.slice(0, 2));
    } catch (err) {
      console.error('Failed to load member dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemberDashboard();
  }, [fetchMemberDashboard]);

  // Socket listener for emergency broadcast with siren effect
  useEffect(() => {
    if (!socket) return;

    const handleIncomingSOS = (alert) => {
      // Siren effect
      try {
        const siren = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        siren.play().catch(() => {});
      } catch (e) {}

      setIncomingSOS(alert);
      toast.error(`COMMUNITY SOS: Emergency trigger at ${alert.door_no ? `Door #${alert.door_no}` : 'our layout'}!`, {
        duration: 9000,
        style: {
          background: '#b91c1c',
          color: '#ffffff',
          fontWeight: 'bold',
        },
      });
    };

    socket.on('sos:trigger', handleIncomingSOS);

    return () => {
      socket.off('sos:trigger', handleIncomingSOS);
    };
  }, [socket]);

  const emergencyTypes = [
    { type: 'Medical', icon: '🚑', desc: 'Ambulance & Paramedic emergency' },
    { type: 'Fire', icon: '🔥', desc: 'Fire incident or smoke hazard' },
    { type: 'Theft/Intruder', icon: '🚨', desc: 'Break-in, trespasser or theft' },
    { type: 'Women Safety', icon: '🛡️', desc: 'Immediate security assistance' },
    { type: 'Other', icon: '⚠️', desc: 'Urgent general layout distress' },
  ];

  const assocName = user?.association_name || 'Layout Association';

  return (
    <div className="space-y-6">
      {/* Association Name Prominently Displayed in the Middle / Center */}
      <div className="text-center py-4 sm:py-5 px-3 sm:px-6 bg-gradient-to-b from-blue-50/80 to-white rounded-2xl sm:rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 text-primary-800 text-xs font-bold uppercase tracking-wider mb-2">
          <HiBuildingOffice2 className="w-4 h-4" />
          <span>Resident Portal</span>
        </div>

        <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight break-words">
          {assocName}
        </h1>

        <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-lg mx-auto">
          Welcome back, <strong className="text-gray-800">{user?.name}</strong>{' '}
          {user?.door_no ? `(Door #${user.door_no})` : ''} • Member Code:{' '}
          <span className="font-mono font-bold text-primary-700">{user?.member_code || 'PENDING'}</span>
        </p>
      </div>


      {/* 5-Second Cancel Countdown Overlay Banner */}
      {showCancel && (
        <div className="bg-red-900 border-2 border-red-500 text-white rounded-2xl p-5 shadow-2xl animate-bounce flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-xl font-black">
              {cancelCountdown}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Dispatching "{selectedType}" Emergency SOS in {cancelCountdown} seconds!
              </h3>
              <p className="text-xs text-red-200">
                Designated contacts, security and local patrol are being alerted with your coordinates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={cancelSOS}
            className="px-6 py-2.5 bg-white text-red-800 hover:bg-gray-100 font-extrabold text-sm rounded-xl shadow-lg transition"
          >
            Cancel SOS
          </button>
        </div>
      )}

      {/* Post-dispatch Confirmation Banner */}
      {isTriggered && (
        <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-4 text-green-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <HiCheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-sm">Emergency Alert Dispatched</p>
              <p className="text-green-700">
                Your emergency request ({lastAlert?.emergency_type || 'SOS'}) has been transmitted. Keep your phone line clear.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetSOS}
            className="text-xs font-semibold px-3 py-1.5 bg-green-200 hover:bg-green-300 rounded-lg text-green-900 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/member/news')}
          className="cursor-pointer transform hover:scale-[1.01] transition"
        >
          <StatsCard
            title="Recent Notices"
            value={loading ? '...' : (stats.activeNotices || recentNews.length)}
            icon={HiMegaphone}
            variant="blue"
            subtitle="Click to view news"
          />
        </div>

        <div
          onClick={() => navigate('/member/voting')}
          className="cursor-pointer transform hover:scale-[1.01] transition"
        >
          <StatsCard
            title="Active Polls"
            value={loading ? '...' : stats.activePolls}
            icon={HiChartBarSquare}
            variant="green"
            subtitle="Click to vote"
          />
        </div>

        <div
          onClick={() => navigate('/member/complaints')}
          className="cursor-pointer transform hover:scale-[1.01] transition"
        >
          <StatsCard
            title="My Complaints"
            value={loading ? '...' : stats.myComplaintsOpen}
            icon={HiChatBubbleLeftRight}
            variant="yellow"
            subtitle="Click to track issues"
          />
        </div>

        <div
          onClick={() => setIsDocumentsModalOpen(true)}
          className="cursor-pointer transform hover:scale-[1.01] transition"
        >
          <StatsCard
            title="Community Documents"
            value={loading ? '...' : documents.length}
            icon={HiDocumentText}
            variant="purple"
            subtitle="Click to show all files"
          />
        </div>
      </div>

      {/* News & Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent News (Top 3) - 2 Cols */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HiNewspaper className="w-5 h-5 text-primary-600" />
              <h2 className="text-base font-bold text-gray-900">Latest Association Announcements</h2>
            </div>
            <button
              onClick={() => navigate('/member/news')}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              Full Feed &rarr;
            </button>
          </div>

          <div className="flex-1 divide-y divide-gray-100">
            {recentNews.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No recent announcements posted.
              </div>
            ) : (
              recentNews.map((news) => (
                <div key={news.id} className="py-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      {news.category || 'General'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {news.created_at ? format(new Date(news.created_at), 'dd MMM yyyy') : ''}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{news.title}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{news.content}</p>

                  {news.voice_message && (
                    <div className="pt-1">
                      <AudioPlayer
                        src={
                          news.voice_message.startsWith('http')
                            ? news.voice_message
                            : `${import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5000'}/${news.voice_message.replace(/\\/g, '/').replace(/^\/?/, '')}`
                        }
                        title="Voice Note"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Events (Top 2) & Quick Links */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HiCalendar className="w-5 h-5 text-green-600" />
                <h2 className="text-base font-bold text-gray-900">Upcoming Events</h2>
              </div>
              <button
                onClick={() => navigate('/member/events')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                Calendar &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400">
                  No upcoming events scheduled.
                </div>
              ) : (
                upcomingEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => navigate('/member/events')}
                    className="p-3 bg-gray-50 hover:bg-primary-50/50 cursor-pointer rounded-xl border border-gray-100 transition"
                    title="Click to view event on calendar"
                  >
                    <span className="text-[11px] font-bold text-primary-700 block">
                      {evt.event_date ? format(new Date(evt.event_date), 'dd MMM yyyy, hh:mm a') : 'TBD'}
                    </span>
                    <h4 className="text-xs font-bold text-gray-900 mt-0.5">{evt.title}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">📍 {evt.location || 'Layout Grounds'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
              Quick Shortcuts
            </h3>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => navigate('/member/events')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition"
              >
                <span className="flex items-center gap-2">
                  <HiCalendar className="w-4 h-4 text-green-600" />
                  <span>Community Events & Calendar</span>
                </span>
                <HiArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => navigate('/member/voting')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition"
              >
                <span className="flex items-center gap-2">
                  <HiChartBarSquare className="w-4 h-4 text-purple-600" />
                  <span>Vote in Active Polls</span>
                </span>
                <HiArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => setIsDocumentsModalOpen(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition"
              >
                <span className="flex items-center gap-2">
                  <HiDocumentText className="w-4 h-4 text-blue-600" />
                  <span>View Community Documents</span>
                </span>
                <HiArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => navigate('/member/complaints')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition"
              >
                <span className="flex items-center gap-2">
                  <HiChatBubbleLeftRight className="w-4 h-4 text-amber-600" />
                  <span>File a Grievance</span>
                </span>
                <HiArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => navigate('/member/profile')}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold transition"
              >
                <span>My Profile & Proofs</span>
                <HiArrowRight className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Emergency Type Selector (Reacts Immediately on Click) */}
      <Modal
        isOpen={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        title="🚨 Emergency Situation (Instant Dispatch)"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Click any situation below to immediately dispatch emergency distress to association security and neighbors:
          </p>

          <button
            type="button"
            onClick={() => triggerSOS('Immediate Distress')}
            disabled={isSending}
            className="w-full p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
          >
            <HiShieldExclamation className="w-5 h-5 text-white" />
            <span>🚨 SEND IMMEDIATE SOS (GENERAL DISTRESS)</span>
          </button>

          <div className="space-y-2 pt-1">
            {emergencyTypes.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => triggerSOS(item.type)}
                disabled={isSending}
                className="w-full p-3 rounded-xl border border-gray-200 hover:border-red-500 hover:bg-red-50/50 flex items-center justify-between transition group text-left cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 group-hover:text-red-700">
                      {item.type}
                    </h4>
                    <p className="text-[11px] text-gray-500">{item.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-red-600 opacity-90 group-hover:opacity-100">
                  <span>Send Now</span>
                  <HiArrowRight className="w-4 h-4 text-red-600" />
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowTypeSelector(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Live Incoming SOS Popup (For all residents in association) */}
      <Modal
        isOpen={Boolean(incomingSOS)}
        onClose={() => setIncomingSOS(null)}
        title="🚨 COMMUNITY SOS EMERGENCY ALERT"
        size="md"
      >
        {incomingSOS && (
          <div className="space-y-4 text-center py-2">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-3xl mx-auto animate-ping">
              🚨
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-red-600">
                Active Community Incident
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-1">
                {incomingSOS.emergency_type || 'EMERGENCY'}
              </h3>
              <p className="text-sm text-gray-700 mt-1">
                Triggered by <strong>{incomingSOS.user_name || 'Resident'}</strong>{' '}
                {incomingSOS.door_no ? `at Door #${incomingSOS.door_no}` : ''}
              </p>
            </div>

            {incomingSOS.latitude && incomingSOS.longitude && (
              <a
                href={`https://maps.google.com/?q=${incomingSOS.latitude},${incomingSOS.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 shadow transition"
              >
                <span>View Incident GPS Location</span>
              </a>
            )}

            <div className="pt-3 border-t border-gray-100 flex justify-center">
              <button
                type="button"
                onClick={() => setIncomingSOS(null)}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Association Documents Library */}
      <Modal
        isOpen={isDocumentsModalOpen}
        onClose={() => setIsDocumentsModalOpen(false)}
        title="Association Document Library"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs sm:text-sm text-gray-500">
              Access official bylaws, layout maps, audited accounts, circulars and notices uploaded by the association.
            </p>
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-primary-50 text-primary-700 border border-primary-200 self-start sm:self-auto whitespace-nowrap">
              {filteredDocuments.length} Available
            </span>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="Search documents by title or description..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'pdf', 'image', 'other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDocFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition ${
                    docFilter === type
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {type === 'all' ? 'All Files' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Documents Stream / Table */}
          {filteredDocuments.length === 0 ? (
            <div className="py-12 text-center">
              <HiFolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">No documents found</p>
              <p className="text-xs text-gray-400 mt-1">
                {docSearch ? 'Try a different search query' : 'No public documents uploaded by the association yet.'}
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1 divide-y divide-gray-100">
              {filteredDocuments.map((doc) => {
                const ext = doc.file_path ? doc.file_path.split('.').pop()?.toUpperCase() : 'DOC';
                const fileUrl = resolveFileUrl(doc.file_path);
                return (
                  <div
                    key={doc.id}
                    className="pt-2.5 first:pt-0 flex items-start justify-between gap-3 p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs shrink-0 border border-primary-200">
                        {ext}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{doc.title}</h4>
                        {doc.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{doc.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                          {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                          {doc.created_at && (
                            <>
                              <span>•</span>
                              <span>{format(new Date(doc.created_at), 'dd MMM yyyy')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View / Open"
                          className="p-2 text-gray-500 hover:text-primary-600 hover:bg-white rounded-lg border border-gray-200 shadow-sm transition"
                        >
                          <HiEye className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc)}
                        title="Download Document"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                      >
                        <HiArrowDownTray className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsDocumentsModalOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
