import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiNewspaper,
  HiBookmark,
  HiPaperClip,
  HiArrowDownTray,
  HiArrowPath,
  HiMagnifyingGlass,
  HiSpeakerWave,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import AudioPlayer from '../../components/common/AudioPlayer';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

export default function MemberNewsFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const fetchNews = useCallback(async () => {
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
    fetchNews();
  }, [fetchNews]);

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

  // Filtered & Sorted (Pinned first)
  const filteredPosts = useMemo(() => {
    return posts
      .filter((p) => {
        const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
        let matchSearch = true;
        if (searchTerm.trim()) {
          const lower = searchTerm.toLowerCase();
          matchSearch =
            (p.title && p.title.toLowerCase().includes(lower)) ||
            (p.content && p.content.toLowerCase().includes(lower));
        }
        return matchCat && matchSearch;
      })
      .sort((a, b) => {
        if (a.is_pinned === b.is_pinned) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        return a.is_pinned ? -1 : 1;
      });
  }, [posts, categoryFilter, searchTerm]);

  // Paginated
  const totalPages = Math.ceil(filteredPosts.length / itemsPerPage) || 1;
  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPosts.slice(start, start + itemsPerPage);
  }, [filteredPosts, currentPage, itemsPerPage]);

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'Urgent':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-800 border border-red-300">Urgent</span>;
      case 'Meeting':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">Meeting</span>;
      case 'Maintenance':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Maintenance</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">General</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiNewspaper className="w-7 h-7 text-primary-600" />
            Association News & Circulars
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Stay updated with official layout notices, meeting minutes, emergency advisories, and voice circulars.
          </p>
        </div>

        <button
          onClick={fetchNews}
          title="Refresh Feed"
          className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition self-start sm:self-auto"
        >
          <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'Urgent', 'Meeting', 'Maintenance', 'General'].map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setCategoryFilter(cat);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                categoryFilter === cat
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat === 'all' ? `All (${posts.length})` : cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs w-full">
          <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Feed Content */}
      {loading ? (
        <div className="py-24 bg-white rounded-2xl border border-gray-100 text-center">
          <LoadingSpinner message="Loading association news feed..." />
        </div>
      ) : filteredPosts.length === 0 ? (
        <EmptyState
          title="No announcements found"
          description="There are no news posts matching your selected category."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedPosts.map((post) => (
            <article
              key={post.id}
              className={`bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition hover:shadow-md ${
                post.is_pinned ? 'border-amber-300 ring-2 ring-amber-100' : 'border-gray-100'
              }`}
            >
              <div>
                {/* Image Banner if present */}
                {post.image && (
                  <div className="h-48 w-full bg-gray-100 overflow-hidden">
                    <img
                      src={resolveFileUrl(post.image)}
                      alt={post.title}
                      className="w-full h-full object-cover hover:scale-105 transition duration-300"
                    />
                  </div>
                )}

                <div className="p-5 space-y-3">
                  {/* Category, Pin & Timestamp */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {getCategoryBadge(post.category)}
                      {post.is_pinned && (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          <HiBookmark className="w-3 h-3 text-amber-600" />
                          PINNED
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {post.created_at ? format(new Date(post.created_at), 'dd MMM yyyy') : ''}
                    </span>
                  </div>

                  {/* Title & Content */}
                  <div>
                    <h2 className="text-base font-bold text-gray-900 leading-snug">{post.title}</h2>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap mt-2 leading-relaxed">
                      {post.content}
                    </p>
                  </div>

                  {/* Audio Player for Voice Message */}
                  {post.voice_message && (
                    <div className="pt-2">
                      <AudioPlayer
                        src={resolveFileUrl(post.voice_message)}
                        title="Voice Circular"
                      />
                    </div>
                  )}

                  {/* Attachment File Download */}
                  {post.attachment && (
                    <div className="pt-2">
                      <a
                        href={resolveFileUrl(post.attachment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-primary-700 rounded-lg text-xs font-semibold border border-gray-200 transition"
                      >
                        <HiPaperClip className="w-4 h-4 text-gray-500" />
                        <span>Download Official Document</span>
                        <HiArrowDownTray className="w-3.5 h-3.5 ml-1" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
                <span>Published by Layout Association Admin</span>
                <span>{post.category || 'General'}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 hover:bg-gray-50"
          >
            &larr; Previous
          </button>
          <span className="text-xs font-semibold text-gray-600 px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 disabled:opacity-40 hover:bg-gray-50"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
