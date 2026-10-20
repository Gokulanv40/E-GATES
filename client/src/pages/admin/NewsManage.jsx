import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  HiNewspaper,
  HiPlus,
  HiPencilSquare,
  HiTrash,
  HiArrowPath,
  HiPaperClip,
  HiPhoto,
  HiMicrophone,
  HiStop,
  HiPlay,
  HiSpeakerWave,
  HiBookmark,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import AudioPlayer from '../../components/common/AudioPlayer';

export default function AdminNewsManage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [selectedPost, setSelectedPost] = useState(null);
  const [postToDelete, setPostToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'General',
    is_pinned: false,
    imageFile: null,
    attachmentFile: null,
    audioBlob: null,
  });

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/news');
      const raw = res.data?.data || res.data || [];
      setPosts(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load news:', err);
      toast.error('Failed to load news announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Clean recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    let clean = filePath.replace(/\\/g, '/');
    const idx = clean.indexOf('uploads/');
    if (idx !== -1) {
      clean = clean.substring(idx);
    }
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/api\/v1\/?$/, '');
    return `${base}/${clean.replace(/^\/?/, '')}`;
  };

  // Start voice recorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);
        setFormData((prev) => ({ ...prev, audioBlob }));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      toast.error('Microphone permission denied or not available.');
    }
  };

  // Stop voice recorder
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsRecording(false);
  };

  // Discard recording
  const discardRecording = () => {
    stopRecording();
    setRecordedAudioUrl(null);
    setRecordingDuration(0);
    setFormData((prev) => ({ ...prev, audioBlob: null }));
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData({
      title: '',
      content: '',
      category: 'General',
      is_pinned: false,
      imageFile: null,
      attachmentFile: null,
      audioBlob: null,
    });
    setRecordedAudioUrl(null);
    setRecordingDuration(0);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (post) => {
    setSelectedPost(post);
    setFormData({
      title: post.title || '',
      content: post.content || '',
      category: post.category || 'General',
      is_pinned: Boolean(post.is_pinned),
      imageFile: null,
      attachmentFile: null,
      audioBlob: null,
    });
    setRecordedAudioUrl(post.voice_message ? resolveFileUrl(post.voice_message) : null);
    setIsEditModalOpen(true);
  };

  // Submit Create
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('content', formData.content.trim());
      data.append('category', formData.category);
      data.append('is_pinned', formData.is_pinned ? 'true' : 'false');

      if (formData.imageFile) {
        data.append('image', formData.imageFile);
      }
      if (formData.attachmentFile) {
        data.append('attachment', formData.attachmentFile);
      }
      if (formData.audioBlob) {
        data.append('voice_message', formData.audioBlob, 'voice_announcement.webm');
      }

      await api.post('/news', data);
      toast.success('News announcement published!');
      setIsCreateModalOpen(false);
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditPost = async (e) => {
    e.preventDefault();
    if (!selectedPost) return;

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('title', formData.title.trim());
      data.append('content', formData.content.trim());
      data.append('category', formData.category);
      data.append('is_pinned', formData.is_pinned ? 'true' : 'false');

      if (formData.imageFile) {
        data.append('image', formData.imageFile);
      }
      if (formData.attachmentFile) {
        data.append('attachment', formData.attachmentFile);
      }
      if (formData.audioBlob) {
        data.append('voice_message', formData.audioBlob, 'voice_announcement.webm');
      }

      await api.put(`/news/${selectedPost.id}`, data);
      toast.success('News announcement updated!');
      setIsEditModalOpen(false);
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update news');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Pin
  const handleTogglePin = async (post) => {
    try {
      await api.put(`/news/${post.id}/pin`);
      toast.success(post.is_pinned ? 'Unpinned' : 'Pinned to top of resident feed');
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update pin');
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    try {
      setSubmitting(true);
      await api.delete(`/news/${postToDelete.id}`);
      toast.success('News post deleted');
      setIsDeleteConfirmOpen(false);
      fetchPosts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete post');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered & Sorted (Pinned first, then date)
  const filteredPosts = useMemo(() => {
    return posts
      .filter((p) => {
        if (categoryFilter === 'all') return true;
        return p.category === categoryFilter;
      })
      .sort((a, b) => {
        if (a.is_pinned === b.is_pinned) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        return a.is_pinned ? -1 : 1;
      });
  }, [posts, categoryFilter]);

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'Urgent':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-200">Urgent</span>;
      case 'Meeting':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">Meeting</span>;
      case 'Maintenance':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Maintenance</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">General</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiNewspaper className="w-7 h-7 text-primary-600" />
            News & Announcements Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Publish circulars, emergency bulletins, audio voice messages, and media documents to residents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPosts}
            title="Refresh news"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <HiPlus className="w-4 h-4" />
            <span>Publish Announcement</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        {['all', 'Urgent', 'Meeting', 'Maintenance', 'General'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              categoryFilter === cat
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {cat === 'all' ? `All Announcements (${posts.length})` : cat}
          </button>
        ))}
      </div>

      {/* Posts Cards Grid */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-100">
          <HiArrowPath className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading announcements...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
          <HiNewspaper className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">No announcements found</p>
          <p className="text-xs text-gray-400 mt-1">Publish an update to notify layout members.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition hover:shadow-md ${
                post.is_pinned ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
              }`}
            >
              <div>
                {/* Optional Top Image */}
                {post.image && (
                  <div className="h-44 w-full bg-gray-100 overflow-hidden">
                    <img
                      src={resolveFileUrl(post.image)}
                      alt={post.title}
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                  </div>
                )}

                <div className="p-5 space-y-3">
                  {/* Category & Pin & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {getCategoryBadge(post.category)}
                      {post.is_pinned && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          📌 PINNED
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400">
                      {post.created_at ? format(new Date(post.created_at), 'dd MMM yyyy') : ''}
                    </span>
                  </div>

                  {/* Title & Content */}
                  <div>
                    <h3 className="text-base font-bold text-gray-900 line-clamp-2">{post.title}</h3>
                    <p className="text-xs text-gray-600 line-clamp-3 mt-1.5 whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>

                  {/* Audio Player if present */}
                  {post.voice_message && (
                    <div className="pt-1">
                      <AudioPlayer
                        src={resolveFileUrl(post.voice_message)}
                        title="Official Voice Circular"
                      />
                    </div>
                  )}

                  {/* Document Attachment Link */}
                  {post.attachment && (
                    <a
                      href={resolveFileUrl(post.attachment)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-semibold bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200 transition"
                    >
                      <HiPaperClip className="w-4 h-4 text-gray-500" />
                      <span>Download Attachment Document</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Bottom Actions Toolbar */}
              <div className="p-4 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => handleTogglePin(post)}
                  className={`text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded transition ${
                    post.is_pinned
                      ? 'text-amber-700 hover:bg-amber-100'
                      : 'text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <HiBookmark className="w-3.5 h-3.5" />
                  <span>{post.is_pinned ? 'Unpin' : 'Pin to Top'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(post)}
                    title="Edit Announcement"
                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <HiPencilSquare className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setPostToDelete(post);
                      setIsDeleteConfirmOpen(true);
                    }}
                    title="Delete Announcement"
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Announcement */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Publish News Announcement"
        size="lg"
      >
        <form onSubmit={handleCreatePost} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Announcement Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Layout Annual General Meeting & Maintenance Notice"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="General">General</option>
                <option value="Urgent">Urgent Notice</option>
                <option value="Meeting">Community Meeting</option>
                <option value="Maintenance">Infrastructure Maintenance</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-800">Pin Announcement at the Top</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Content / Details
            </label>
            <textarea
              rows={4}
              placeholder="Detailed description or agenda for the residents..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Voice Recording / Voice Message */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
              Audio Voice Broadcast (Tamil / English)
            </span>

            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  <HiMicrophone className="w-4 h-4" />
                  <span>Record Voice Message</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg shadow-sm transition animate-pulse"
                >
                  <HiStop className="w-4 h-4 text-red-400" />
                  <span>Stop Recording ({recordingDuration}s)</span>
                </button>
              )}

              {recordedAudioUrl && (
                <div className="flex items-center gap-2">
                  <audio controls src={recordedAudioUrl} className="h-8 max-w-xs" />
                  <button
                    type="button"
                    onClick={discardRecording}
                    className="text-xs text-red-600 hover:underline font-semibold"
                  >
                    Delete Voice
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Media Attachments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Upload Banner Image
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFormData({ ...formData, imageFile: e.target.files[0] || null })}
                className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Upload Document (PDF / DOC)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) =>
                  setFormData({ ...formData, attachmentFile: e.target.files[0] || null })
                }
                className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isRecording}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Announcement */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit News Announcement"
        size="lg"
      >
        <form onSubmit={handleEditPost} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="General">General</option>
                <option value="Urgent">Urgent</option>
                <option value="Meeting">Meeting</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-800">Pin to Top</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Content
            </label>
            <textarea
              rows={4}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Media Attachments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Replace Banner Image
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={(e) => setFormData({ ...formData, imageFile: e.target.files[0] || null })}
                className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                Replace Document
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) =>
                  setFormData({ ...formData, attachmentFile: e.target.files[0] || null })
                }
                className="w-full text-xs text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={submitting}
        title="Delete News Announcement"
        message={`Are you sure you want to delete "${postToDelete?.title}"? This cannot be undone.`}
        confirmText="Yes, Delete Post"
        isDanger={true}
      />
    </div>
  );
}
