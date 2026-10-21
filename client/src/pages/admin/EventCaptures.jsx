import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HiFilm,
  HiCamera,
  HiPhoto,
  HiVideoCamera,
  HiPlus,
  HiTrash,
  HiPencilSquare,
  HiHeart,
  HiShare,
  HiArrowDownTray,
  HiLink,
  HiMagnifyingGlass,
  HiCalendar,
  HiMapPin,
  HiXMark,
  HiArrowPath,
  HiEye,
  HiCheck,
  HiBuildingOffice2,
  HiArrowUpTray,
  HiSparkles,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function EventCaptures() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  // Data State
  const [captures, setCaptures] = useState([]);
  const [stats, setStats] = useState({
    total_captures: 0,
    total_photos: 0,
    total_videos: 0,
    total_events: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all'); // 'all' | 'photo' | 'video'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'popular' | 'event_date'

  // Super Admin Association Filter
  const [associations, setAssociations] = useState([]);
  const [selectedAssocFilter, setSelectedAssocFilter] = useState('all');

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]); // [{ file, preview, isVideo, name, size }]
  const [uploadAssocId, setUploadAssocId] = useState('');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    event_date: new Date().toISOString().split('T')[0],
  });
  const fileInputRef = useRef(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCapture, setEditingCapture] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    event_date: '',
  });

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingCapture, setDeletingCapture] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lightbox Media Viewer State
  const [lightboxCapture, setLightboxCapture] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [likedMap, setLikedMap] = useState({});

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

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Fetch associations for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      api.get('/associations')
        .then((res) => {
          const list = res.data?.data || res.data || [];
          setAssociations(Array.isArray(list) ? list : []);
        })
        .catch((err) => console.warn('Could not load associations:', err));
    }
  }, [isSuperAdmin]);

  // Fetch captures
  const fetchCaptures = async () => {
    try {
      setLoading(true);
      const params = {
        media_type: mediaTypeFilter,
        search: searchQuery,
        sort: sortOrder,
      };

      if (isSuperAdmin && selectedAssocFilter !== 'all') {
        params.association_id = selectedAssocFilter;
      }

      const res = await api.get('/event-captures', { params });
      const data = res.data?.data || [];
      setCaptures(Array.isArray(data) ? data : []);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      toast.error('Failed to load event captures');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptures();
  }, [mediaTypeFilter, sortOrder, selectedAssocFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCaptures();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // File selection for Upload
  const handleFilesSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newEntries = files.map((file) => {
      const isVideo = file.type.startsWith('video/');
      const preview = isVideo ? null : URL.createObjectURL(file);
      return {
        file,
        preview,
        isVideo,
        name: file.name,
        size: file.size,
      };
    });

    setUploadFiles((prev) => [...prev, ...newEntries]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveUploadFile = (index) => {
    setUploadFiles((prev) => {
      const target = prev[index];
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleOpenUpload = () => {
    setUploadFiles([]);
    setUploadForm({
      title: '',
      description: '',
      event_date: new Date().toISOString().split('T')[0],
    });
    setUploadAssocId(isSuperAdmin && selectedAssocFilter !== 'all' ? selectedAssocFilter : '');
    setIsUploadOpen(true);
  };

  // Submit Upload
  const handleSaveUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.title.trim()) {
      toast.error('Please enter the event title');
      return;
    }
    if (!uploadForm.event_date) {
      toast.error('Please select the event date');
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();

      formData.append('title', uploadForm.title.trim());
      formData.append('event_date', uploadForm.event_date);

      if (uploadForm.description.trim()) {
        formData.append('description', uploadForm.description.trim());
      }
      if (isSuperAdmin && uploadAssocId) {
        formData.append('association_id', uploadAssocId);
      }

      uploadFiles.forEach((item) => {
        formData.append('media', item.file);
      });

      const res = await api.post('/event-captures', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(res.data?.message || 'Event capture saved successfully!');
      setIsUploadOpen(false);
      setUploadFiles([]);
      await fetchCaptures();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save event capture');
    } finally {
      setIsUploading(false);
    }
  };

  // Edit Handlers
  const handleOpenEdit = (capture) => {
    setEditingCapture(capture);
    setEditForm({
      title: capture.title || '',
      description: capture.description || '',
      event_date: capture.event_date ? capture.event_date.substring(0, 10) : '',
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingCapture) return;

    if (!editForm.title.trim()) {
      toast.error('Please enter the event title');
      return;
    }
    if (!editForm.event_date) {
      toast.error('Please select the event date');
      return;
    }

    try {
      setIsUpdating(true);
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        event_date: editForm.event_date,
      };

      await api.put(`/event-captures/${editingCapture.id}`, payload);
      toast.success('Capture details updated!');
      setIsEditOpen(false);
      setEditingCapture(null);
      await fetchCaptures();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update capture');
    } finally {
      setIsUpdating(false);
    }
  };

  // Delete Handlers
  const handleOpenDelete = (capture) => {
    setDeletingCapture(capture);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCapture) return;
    try {
      setIsDeleting(true);
      await api.delete(`/event-captures/${deletingCapture.id}`);
      toast.success('Event capture deleted.');
      setIsDeleteOpen(false);
      setDeletingCapture(null);
      if (lightboxCapture?.id === deletingCapture.id) {
        setLightboxCapture(null);
      }
      await fetchCaptures();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete capture');
    } finally {
      setIsDeleting(false);
    }
  };

  // Like handler
  const handleLike = async (capture, e) => {
    if (e) e.stopPropagation();
    if (likedMap[capture.id]) {
      toast('You already cheered this capture!', { icon: '❤️' });
      return;
    }

    try {
      setLikedMap((prev) => ({ ...prev, [capture.id]: true }));
      setCaptures((prev) =>
        prev.map((c) => (c.id === capture.id ? { ...c, likes_count: (c.likes_count || 0) + 1 } : c))
      );
      if (lightboxCapture?.id === capture.id) {
        setLightboxCapture((prev) => ({ ...prev, likes_count: (prev.likes_count || 0) + 1 }));
      }
      await api.post(`/event-captures/${capture.id}/like`);
    } catch (err) {
      console.warn('Like request failed:', err);
    }
  };

  // Copy share link
  const handleCopyLink = (capture, e) => {
    if (e) e.stopPropagation();
    const url = resolveFileUrl(capture.file_path);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(capture.id);
      toast.success('Direct media link copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  // Share via WhatsApp
  const handleShareWhatsApp = (capture, e) => {
    if (e) e.stopPropagation();
    const url = resolveFileUrl(capture.file_path);
    const text = `🎉 *${capture.title || 'Event Capture'}*\n📍 ${capture.event_name || 'Community Event'}\n📅 ${formatDate(capture.event_date)}\n\nView Media:\n${url}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // Direct immediate download
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (capture, e) => {
    if (e) e.stopPropagation();
    if (!capture || !capture.file_path) {
      toast.error('No file available to download');
      return;
    }

    const toastId = toast.loading('Starting download...');
    setDownloadingId(capture.id);

    try {
      const fileUrl = resolveFileUrl(capture.file_path);

      // 1. Fetch file as blob for immediate direct browser save
      const response = await fetch(fileUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();

      // Determine proper file extension & clean filename
      const extMatch = capture.file_path.match(/\.[a-zA-Z0-9]+$/);
      const ext = extMatch ? extMatch[0] : (capture.media_type === 'video' ? '.mp4' : '.jpg');
      let fileName = capture.file_name || `${(capture.title || 'event-capture').replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
      if (!fileName.toLowerCase().endsWith(ext.toLowerCase())) {
        fileName += ext;
      }

      // Create ObjectURL and trigger click
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.setAttribute('download', fileName);
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      }, 2000);

      toast.success('Download started!', { id: toastId });
    } catch (err) {
      console.warn('Direct blob download error, triggering backend attachment download:', err);
      // Fallback: Direct attachment download endpoint
      const baseApi = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/api\/v1\/?$/, '');
      const downloadEndpoint = `${baseApi}/api/v1/event-captures/${capture.id}/download`;

      const link = document.createElement('a');
      link.href = downloadEndpoint;
      link.setAttribute('download', capture.file_name || `event-capture-${capture.id}`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 2000);

      toast.success('Download started!', { id: toastId });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Overview Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-indigo-200 text-xs font-semibold">
              <HiSparkles className="w-4 h-4 text-amber-300" />
              <span>Community Event Memories & Highlights</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Event Captures & Gallery
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm leading-relaxed">
              Upload event videos, share high-resolution festival photographs, and preserve memories from layout celebrations, sports meets, and community gatherings.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenUpload}
                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-indigo-950/40 transition"
              >
                <HiPlus className="w-5 h-5" />
                <span>Upload Captures</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchCaptures}
              title="Refresh Gallery"
              className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 rounded-2xl transition text-white"
            >
              <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 block">
              Total Captures
            </span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
              {Number(stats?.total_captures ?? captures.length)}
            </span>
          </div>

          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 block flex items-center gap-1.5">
              <HiPhoto className="w-4 h-4 text-emerald-400" />
              <span>Event Photos</span>
            </span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
              {Number(stats?.total_photos ?? captures.filter((c) => c.media_type === 'photo').length)}
            </span>
          </div>

          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 block flex items-center gap-1.5">
              <HiFilm className="w-4 h-4 text-amber-400" />
              <span>Event Videos</span>
            </span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
              {Number(stats?.total_videos ?? captures.filter((c) => c.media_type === 'video').length)}
            </span>
          </div>
        </div>
      </div>

      {/* Super Admin Association Filter */}
      {isSuperAdmin && (
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <HiBuildingOffice2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <span className="font-bold text-gray-800">Filter By Association:</span>
          </div>
          <select
            value={selectedAssocFilter}
            onChange={(e) => setSelectedAssocFilter(e.target.value)}
            className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Registered Associations</option>
            {associations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.city || 'Tamil Nadu'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 2. Filter & Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        {/* Type Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setMediaTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mediaTypeFilter === 'all'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Captures
          </button>
          <button
            type="button"
            onClick={() => setMediaTypeFilter('photo')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mediaTypeFilter === 'photo'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HiPhoto className="w-3.5 h-3.5" />
            <span>Photos</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaTypeFilter('video')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              mediaTypeFilter === 'video'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <HiFilm className="w-3.5 h-3.5" />
            <span>Videos</span>
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <HiMagnifyingGlass className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search captures by title..."
              className="w-full pl-9 pr-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="event_date">Event Date</option>
            <option value="popular">Most Liked ❤️</option>
          </select>
        </div>
      </div>

      {/* 3. Media Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
          <HiArrowPath className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading event captures...</span>
        </div>
      ) : captures.length === 0 ? (
        <div className="py-16 px-4 text-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
            <HiFilm className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            No event captures found
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
            {searchQuery || mediaTypeFilter !== 'all' || (isSuperAdmin && selectedAssocFilter !== 'all')
              ? 'No captures match your current search or filter criteria. Try clearing filters.'
              : 'Start building your community album! Upload event videos and photos from festivals, sports days, and layout celebrations.'}
          </p>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenUpload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition"
            >
              <HiPlus className="w-4 h-4" />
              <span>Upload First Event Capture</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {captures.map((capture) => {
            const isVideo = capture.media_type === 'video';
            const mediaUrl = resolveFileUrl(capture.file_path);

            return (
              <div
                key={capture.id}
                className="group bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Media Preview Box */}
                <div
                  onClick={() => setLightboxCapture(capture)}
                  className="relative aspect-video sm:aspect-square bg-slate-900 cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  {!capture.file_path ? (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-slate-800 to-indigo-950 p-4 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                        <HiCalendar className="w-6 h-6" />
                      </div>
                      <span className="text-white font-bold text-xs truncate max-w-full px-2">
                        {capture.title}
                      </span>
                      <span className="text-indigo-200 text-[10px] mt-0.5">
                        {formatDate(capture.event_date)}
                      </span>
                    </div>
                  ) : isVideo ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      <video
                        src={mediaUrl}
                        preload="metadata"
                        className="w-full h-full object-cover pointer-events-none opacity-90 group-hover:scale-105 transition duration-500"
                      />
                      {/* Video Play Overlay */}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/20 transition">
                        <div className="w-12 h-12 rounded-full bg-indigo-600/90 hover:bg-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                          <HiVideoCamera className="w-6 h-6 ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={capture.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-xs ${
                        !capture.file_path
                          ? 'bg-slate-900/80 text-indigo-200 border border-indigo-400/30'
                          : isVideo
                          ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-400/30'
                          : 'bg-emerald-900/80 text-emerald-200 border border-emerald-400/30'
                      }`}
                    >
                      {!capture.file_path ? (
                        <>
                          <HiCalendar className="w-3 h-3" />
                          <span>Event</span>
                        </>
                      ) : isVideo ? (
                        <>
                          <HiFilm className="w-3 h-3" />
                          <span>Video</span>
                        </>
                      ) : (
                        <>
                          <HiPhoto className="w-3 h-3" />
                          <span>Photo</span>
                        </>
                      )}
                    </span>

                    {capture.file_size ? (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 text-white/90 backdrop-blur-md">
                        {formatFileSize(capture.file_size)}
                      </span>
                    ) : null}
                  </div>

                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between p-3 pointer-events-none">
                    <span className="text-white text-xs font-semibold flex items-center gap-1">
                      <HiEye className="w-4 h-4 text-indigo-300" />
                      <span>Click to view</span>
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Event Date Badge */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      {capture.event_date && (
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1.5">
                          <HiCalendar className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{formatDate(capture.event_date)}</span>
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      title={capture.title}
                      className="text-xs sm:text-sm font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition"
                    >
                      {capture.title}
                    </h3>

                    {/* Description */}
                    {capture.description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                        {capture.description}
                      </p>
                    )}
                  </div>

                  {/* Actions & Sharing Footer */}
                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                    {/* Like Button */}
                    <button
                      type="button"
                      onClick={(e) => handleLike(capture, e)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                        likedMap[capture.id]
                          ? 'bg-rose-50 text-rose-600'
                          : 'text-gray-500 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title="Cheer / Like"
                    >
                      <HiHeart
                        className={`w-4 h-4 ${likedMap[capture.id] ? 'fill-rose-500 text-rose-500' : ''}`}
                      />
                      <span>{capture.likes_count || 0}</span>
                    </button>

                    {/* Sharing Buttons */}
                    <div className="flex items-center gap-1">
                      {/* WhatsApp Share */}
                      <button
                        type="button"
                        onClick={(e) => handleShareWhatsApp(capture, e)}
                        title="Share on WhatsApp"
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                      >
                        <HiShare className="w-4 h-4" />
                      </button>

                      {/* Copy Link */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(capture, e)}
                        title="Copy Direct Link"
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        {copiedId === capture.id ? (
                          <HiCheck className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <HiLink className="w-4 h-4" />
                        )}
                      </button>

                      {/* Download */}
                      <button
                        type="button"
                        onClick={(e) => handleDownload(capture, e)}
                        disabled={downloadingId === capture.id}
                        title="Download Immediately"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                      >
                        {downloadingId === capture.id ? (
                          <HiArrowPath className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <HiArrowDownTray className="w-4 h-4" />
                        )}
                      </button>

                      {/* Admin Edit & Delete */}
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(capture);
                            }}
                            title="Edit Details"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition ml-1"
                          >
                            <HiPencilSquare className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDelete(capture);
                            }}
                            title="Delete Capture"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL: Upload Event Captures (Photos & Videos) */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Event Captures (Photos & Videos)"
        size="lg"
      >
        <form onSubmit={handleSaveUpload} className="space-y-4 max-h-[82vh] overflow-y-auto px-1 pr-1.5">
          <p className="text-xs text-gray-500">
            Upload videos (.mp4, .webm, .mov) and high-resolution photographs (.jpg, .png, .webp) from layout celebrations to share with residents.
          </p>

          {/* Super Admin Association Selector */}
          {isSuperAdmin && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Target Association (Optional)
              </label>
              <select
                value={uploadAssocId}
                onChange={(e) => setUploadAssocId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Default (First Active Association)</option>
                {associations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title - MANDATORY */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              placeholder="e.g. Pongal Celebration / Cultural Night"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Event Date - MANDATORY */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Event Date *
            </label>
            <input
              type="date"
              required
              value={uploadForm.event_date}
              onChange={(e) => setUploadForm({ ...uploadForm, event_date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Drag & Drop File Upload Area - OPTIONAL */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                Upload Event Videos & Photos (Optional)
              </label>
              <span className="text-[11px] text-gray-400">Max 20 files, up to 150MB each</span>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,video/mp4,video/webm,video/quicktime,video/x-matroska"
              className="hidden"
              onChange={handleFilesSelect}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/30 hover:bg-indigo-50/50 rounded-2xl p-5 transition flex flex-col items-center justify-center text-center group"
            >
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-110 transition">
                <HiArrowUpTray className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-gray-800">
                Click to browse or drop videos and photos here
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                MP4, WEBM, MOV videos or JPG, PNG, WEBP photos
              </p>
            </div>

            {/* Selected Files Preview List */}
            {uploadFiles.length > 0 && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700 pb-1 border-b border-gray-100">
                  <span>Selected Media ({uploadFiles.length})</span>
                  <button
                    type="button"
                    onClick={() => setUploadFiles([])}
                    className="text-[11px] text-rose-600 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
                {uploadFiles.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.preview ? (
                        <img
                          src={item.preview}
                          alt="Thumb"
                          className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                          <HiFilm className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-gray-800 truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {item.isVideo ? 'Video' : 'Photo'} • {formatFileSize(item.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveUploadFile(idx)}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded-lg"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description / Notes - OPTIONAL */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              placeholder="Highlights, sports winners, special moments, or details..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsUploadOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Event Capture</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* 5. MODAL: Edit Capture Details */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Event Capture Details"
        size="md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Event Date *
            </label>
            <input
              type="date"
              required
              value={editForm.event_date}
              onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-md disabled:opacity-50"
            >
              {isUpdating ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. MODAL: Lightbox Full-Screen Media Viewer */}
      {lightboxCapture && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 transition-opacity"
          onClick={() => setLightboxCapture(null)}
        >
          {/* Top Bar */}
          <div
            className="flex items-center justify-between text-white z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-white/15">
                {lightboxCapture.media_type === 'video' ? '🎬 Event Video' : '📸 Event Photo'}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold truncate">
                  {lightboxCapture.title}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                  {formatDate(lightboxCapture.event_date)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLightboxCapture(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition flex-shrink-0"
            >
              <HiXMark className="w-6 h-6" />
            </button>
          </div>

          {/* Media Centerpiece */}
          <div
            className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {!lightboxCapture.file_path ? (
              <div className="max-w-lg w-full bg-slate-800/90 border border-white/10 rounded-3xl p-8 text-center text-white shadow-2xl flex flex-col items-center">
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                  <HiCalendar className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">{lightboxCapture.title}</h2>
                <p className="text-sm text-gray-300 mb-1">
                  Event Date: <strong className="text-white">{formatDate(lightboxCapture.event_date)}</strong>
                </p>
                {lightboxCapture.description && (
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed max-w-md">
                    {lightboxCapture.description}
                  </p>
                )}
              </div>
            ) : lightboxCapture.media_type === 'video' ? (
              <video
                src={resolveFileUrl(lightboxCapture.file_path)}
                controls
                autoPlay
                className="max-h-[70vh] sm:max-h-[76vh] max-w-full rounded-2xl shadow-2xl bg-black"
              />
            ) : (
              <img
                src={resolveFileUrl(lightboxCapture.file_path)}
                alt={lightboxCapture.title}
                className="max-h-[70vh] sm:max-h-[76vh] max-w-full object-contain rounded-2xl shadow-2xl"
              />
            )}
          </div>

          {/* Bottom Bar: Caption, Likes, and Share */}
          <div
            className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 sm:p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-200">
              {lightboxCapture.description ? (
                <p>{lightboxCapture.description}</p>
              ) : (
                <p className="text-gray-400 italic">No additional description recorded.</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Like */}
              <button
                type="button"
                onClick={(e) => handleLike(lightboxCapture, e)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  likedMap[lightboxCapture.id]
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <HiHeart className="w-4 h-4" />
                <span>{lightboxCapture.likes_count || 0} Likes</span>
              </button>

              {/* Share WhatsApp */}
              <button
                type="button"
                onClick={(e) => handleShareWhatsApp(lightboxCapture, e)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <HiShare className="w-4 h-4" />
                <span>Share WhatsApp</span>
              </button>

              {/* Copy Link */}
              {lightboxCapture.file_path && (
                <button
                  type="button"
                  onClick={(e) => handleCopyLink(lightboxCapture, e)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                >
                  {copiedId === lightboxCapture.id ? (
                    <>
                      <HiCheck className="w-4 h-4 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <HiLink className="w-4 h-4" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              )}

              {/* Download */}
              {lightboxCapture.file_path && (
                <button
                  type="button"
                  onClick={(e) => handleDownload(lightboxCapture, e)}
                  disabled={downloadingId === lightboxCapture.id}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
                >
                  {downloadingId === lightboxCapture.id ? (
                    <HiArrowPath className="w-4 h-4 animate-spin" />
                  ) : (
                    <HiArrowDownTray className="w-4 h-4" />
                  )}
                  <span>{downloadingId === lightboxCapture.id ? 'Downloading...' : 'Download'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Event Capture"
        message={`Are you sure you want to permanently delete "${deletingCapture?.title}"? The media file will be removed from storage.`}
        confirmText="Delete Capture"
        loading={isDeleting}
      />
    </div>
  );
}
