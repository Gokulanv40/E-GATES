import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HiDocumentText,
  HiArrowUpTray,
  HiArrowDownTray,
  HiTrash,
  HiArrowPath,
  HiDocument,
  HiDocumentChartBar,
  HiPhoto,
  HiEye,
  HiListBullet,
  HiSquares2X2,
} from 'react-icons/hi2';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function AdminDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState('grid');
  const [typeFilter, setTypeFilter] = useState('all');

  // Upload Modal
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    file: null,
  });

  // Delete Confirm
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/documents');
      const raw = res.data?.data || res.data || [];
      setDocuments(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      toast.error('Failed to load documents library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Download Handler
  const handleDownload = async (doc) => {
    try {
      toast.loading(`Downloading ${doc.title}...`, { id: 'download' });
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Extract filename from doc.file_path or title
      const ext = doc.file_path ? doc.file_path.split('.').pop() : 'pdf';
      link.download = `${doc.title.replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download complete!', { id: 'download' });
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download document', { id: 'download' });
    }
  };

  // Upload Submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.title.trim() || !uploadForm.file) {
      toast.error('Title and document file are required');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('title', uploadForm.title.trim());
      data.append('description', uploadForm.description.trim());
      data.append('document', uploadForm.file);
      data.append('file', uploadForm.file);

      await api.post('/documents', data);
      toast.success('Document uploaded to library!');
      setIsUploadModalOpen(false);
      setUploadForm({ title: '', description: '', file: null });
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    try {
      setSubmitting(true);
      await api.delete(`/documents/${docToDelete.id}`);
      toast.success('Document deleted');
      setIsDeleteConfirmOpen(false);
      fetchDocuments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    } finally {
      setSubmitting(false);
    }
  };

  const getDocTypeIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('pdf')) {
      return <HiDocumentText className="w-8 h-8 text-rose-500" />;
    }
    if (t.includes('sheet') || t.includes('xls') || t.includes('csv')) {
      return <HiDocumentChartBar className="w-8 h-8 text-emerald-500" />;
    }
    if (t.includes('image') || t.includes('jpg') || t.includes('png')) {
      return <HiPhoto className="w-8 h-8 text-purple-500" />;
    }
    return <HiDocument className="w-8 h-8 text-blue-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  // Filtered
  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (typeFilter === 'all') return true;
      const t = (d.file_type || d.file_path || '').toLowerCase();
      if (typeFilter === 'pdf') return t.includes('pdf');
      if (typeFilter === 'excel') return t.includes('xls') || t.includes('csv') || t.includes('sheet');
      if (typeFilter === 'image') return t.includes('png') || t.includes('jpg') || t.includes('jpeg');
      return true;
    });
  }, [documents, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <HiDocumentText className="w-7 h-7 text-primary-600" />
            Association Documents & Bylaws Library
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Store and share official association bylaws, layout survey maps, meeting minutes, and financial audit files.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <HiSquares2X2 className="w-4 h-4" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <HiListBullet className="w-4 h-4" />
              <span>List</span>
            </button>
          </div>

          <button
            onClick={fetchDocuments}
            title="Refresh"
            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
          >
            <HiArrowPath className={`w-5 h-5 ${loading ? 'animate-spin text-primary-600' : ''}`} />
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <HiArrowUpTray className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        {[
          { id: 'all', label: `All Documents (${documents.length})` },
          { id: 'pdf', label: 'PDF Documents' },
          { id: 'excel', label: 'Spreadsheets (Excel/CSV)' },
          { id: 'image', label: 'Images & Layout Maps' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              typeFilter === tab.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid or List Display */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-gray-100">
          <HiArrowPath className="w-8 h-8 text-primary-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-gray-500">Loading document repository...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
          <HiDocumentText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">No documents found</p>
          <p className="text-xs text-gray-400 mt-1">Upload files to populate the association library.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between hover:border-primary-300 hover:shadow-md transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    {getDocTypeIcon(doc.file_type || doc.file_path)}
                  </div>
                  <button
                    onClick={() => {
                      setDocToDelete(doc);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
                    title="Delete Document"
                  >
                    <HiTrash className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-gray-900 line-clamp-1">{doc.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                  {doc.description || 'Official association record'}
                </p>

                <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
                  <span>{doc.created_at ? format(new Date(doc.created_at), 'dd MMM yyyy') : ''}</span>
                  {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  onClick={() => handleDownload(doc)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold rounded-xl border border-primary-100 transition"
                >
                  <HiArrowDownTray className="w-4 h-4" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Mode */
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Document Title</th>
                <th className="px-4 py-3">Uploaded Date</th>
                <th className="px-4 py-3">File Size</th>
                <th className="px-4 py-3">Uploaded By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {getDocTypeIcon(doc.file_type || doc.file_path)}
                      <div>
                        <p className="text-sm font-bold text-gray-900">{doc.title}</p>
                        <p className="text-xs text-gray-400 truncate max-w-sm">{doc.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {doc.created_at ? format(new Date(doc.created_at), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {formatFileSize(doc.file_size) || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {doc.uploaded_by_name || 'Admin'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 font-semibold rounded-lg transition"
                      >
                        <HiArrowDownTray className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => {
                          setDocToDelete(doc);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <HiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Upload Document */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Document to Library"
        size="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Layout Bylaws & Building Guidelines 2026"
              value={uploadForm.title}
              onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description / Tags
            </label>
            <textarea
              rows={3}
              placeholder="Summary of contents, effective date, resolution number..."
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Choose Document File (PDF, XLSX, DOC, PNG) *
            </label>
            <input
              type="file"
              required
              onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] || null })}
              className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Uploading...' : 'Upload Document'}
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
        title="Delete Document"
        message={`Are you sure you want to remove "${docToDelete?.title}" from the library?`}
        confirmText="Yes, Delete Document"
        isDanger={true}
      />
    </div>
  );
}
