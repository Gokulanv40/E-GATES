import React, { useState, useEffect, useRef } from 'react';
import {
  HiUser,
  HiEnvelope,
  HiPhone,
  HiHome,
  HiBuildingOffice2,
  HiKey,
  HiLanguage,
  HiShieldCheck,
  HiPencilSquare,
  HiCheckCircle,
  HiDocumentText,
  HiArrowTopRightOnSquare,
  HiArrowDownTray,
  HiArrowUpTray,
  HiMapPin,
  HiIdentification,
  HiClock,
  HiXCircle,
  HiXMark,
  HiArrowPath,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(user || {});

  // Document upload state (page-level)
  const [ebFile, setEbFile] = useState(null);
  const [taxFile, setTaxFile] = useState(null);
  const [showEbUpload, setShowEbUpload] = useState(false);
  const [showTaxUpload, setShowTaxUpload] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const ebInputRef = useRef(null);
  const taxInputRef = useRef(null);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    language: user?.language || 'en',
    door_no: user?.door_no || '',
    street: user?.street || '',
    layout_name: user?.layout_name || '',
    taluk: user?.taluk || '',
    district: user?.district || '',
    state: user?.state || '',
  });

  // Modal-level document upload state
  const [modalEbFile, setModalEbFile] = useState(null);
  const [modalTaxFile, setModalTaxFile] = useState(null);
  const modalEbInputRef = useRef(null);
  const modalTaxInputRef = useRef(null);

  // Change Password Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);

  // Helper to resolve static file paths to backend URL
  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/api\/v1\/?$/, '');
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

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Fetch updated user info
  useEffect(() => {
    if (!user?.id) return;
    const fetchFreshProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/users/${user.id}`);
        const fresh = res.data?.data || res.data;
        if (fresh) {
          setProfileData(fresh);
          setEditForm({
            name: fresh.name || '',
            phone: fresh.phone || '',
            email: fresh.email || '',
            language: fresh.language || 'en',
            door_no: fresh.door_no || '',
            street: fresh.street || '',
            layout_name: fresh.layout_name || '',
            taluk: fresh.taluk || '',
            district: fresh.district || '',
            state: fresh.state || '',
          });
        }
      } catch (err) {
        console.warn('Could not fetch fresh profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFreshProfile();
  }, [user?.id]);

  // Handle Save Address Proof Documents directly from profile page
  const handleSaveDocuments = async (e) => {
    if (e) e.preventDefault();
    if (!ebFile && !taxFile) {
      toast.error('Please select at least one document to upload');
      return;
    }

    try {
      setUploadingDocs(true);
      const formData = new FormData();
      if (ebFile) formData.append('eb_bill_proof', ebFile);
      if (taxFile) formData.append('property_tax_receipt', taxFile);

      const res = await api.put(`/users/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = res.data?.data || res.data;
      if (updated) {
        setProfileData(updated);
        updateUser(updated);
      }

      setEbFile(null);
      setTaxFile(null);
      setShowEbUpload(false);
      setShowTaxUpload(false);
      toast.success('Address proof documents saved successfully in profile!');
    } catch (err) {
      console.error('Failed to save documents:', err);
      toast.error(err.response?.data?.message || 'Failed to save documents');
    } finally {
      setUploadingDocs(false);
    }
  };

  // Open Edit Profile modal and synchronize state
  const handleOpenEditModal = () => {
    setEditForm({
      name: profileData.name || '',
      phone: profileData.phone || '',
      email: profileData.email || '',
      language: profileData.language || 'en',
      door_no: profileData.door_no || '',
      street: profileData.street || '',
      layout_name: profileData.layout_name || '',
      taluk: profileData.taluk || '',
      district: profileData.district || '',
      state: profileData.state || '',
    });
    setModalEbFile(null);
    setModalTaxFile(null);
    setIsEditProfileOpen(true);
  };

  // Handle Edit Profile Form Submission (all fields + documents included)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Full name is required');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('name', editForm.name.trim());
      formData.append('phone', editForm.phone.trim());
      formData.append('email', editForm.email.trim());
      formData.append('language', editForm.language);
      formData.append('door_no', editForm.door_no.trim());
      formData.append('street', editForm.street.trim());
      formData.append('layout_name', editForm.layout_name.trim());
      formData.append('taluk', editForm.taluk.trim());
      formData.append('district', editForm.district.trim());
      formData.append('state', editForm.state.trim());

      // If user selected new documents inside the edit modal
      if (modalEbFile) {
        formData.append('eb_bill_proof', modalEbFile);
      }
      if (modalTaxFile) {
        formData.append('property_tax_receipt', modalTaxFile);
      }

      const res = await api.put(`/users/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updated = res.data?.data || res.data;
      if (updated) {
        setProfileData(updated);
        updateUser(updated);
      }

      setModalEbFile(null);
      setModalTaxFile(null);
      toast.success('All registration details & documents updated successfully!');
      setIsEditProfileOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/users/${user.id}`, {
        password: passwordForm.newPassword,
        current_password: passwordForm.currentPassword,
      });

      toast.success('Password changed successfully!');
      setIsChangePasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  const initials = profileData.name
    ? profileData.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const isAdmin = profileData.role === 'admin' || profileData.role === 'super_admin';

  return (
    <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto pb-10">
      {/* Top Banner & Profile Avatar Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 relative overflow-hidden">
        {/* Background glow decoration */}
        <div
          className={`absolute top-0 right-0 w-64 h-64 rounded-full filter blur-3xl opacity-10 pointer-events-none ${
            isAdmin ? 'bg-purple-600' : 'bg-primary-600'
          }`}
        />

        <div
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center flex-shrink-0 shadow-lg ring-4 ${
            isAdmin
              ? 'bg-gradient-to-tr from-purple-600 to-indigo-700 ring-purple-100'
              : 'bg-gradient-to-tr from-primary-600 to-teal-600 ring-primary-100'
          }`}
        >
          {initials}
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2 w-full">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {profileData.name}
            </h1>

            {/* Role Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider ${
                isAdmin
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}
            >
              <HiShieldCheck className="w-3.5 h-3.5" />
              {isAdmin ? 'Association Admin' : 'Resident Member'}
            </span>

            {/* Code Badge */}
            <span className="font-mono text-[11px] sm:text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
              Code: {profileData.member_code || 'PENDING'}
            </span>

            {/* Approval Status */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full ${
                profileData.status === 'approved'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : profileData.status === 'pending'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {profileData.status === 'approved' ? (
                <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              ) : profileData.status === 'pending' ? (
                <HiClock className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <HiXCircle className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span className="capitalize">{profileData.status || 'Active'}</span>
            </span>
          </div>

          <div className="flex items-center justify-center sm:justify-start text-xs sm:text-sm text-gray-600 font-medium pt-0.5">
            <span className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-center sm:text-left">
              <HiBuildingOffice2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="break-words">{profileData.association_name || 'Layout Resident Association'}</span>
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-gray-400">
            Registered on:{' '}
            {profileData.created_at
              ? new Date(profileData.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </p>

          {/* Action buttons */}
          <div className="pt-2 sm:pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-center sm:justify-start gap-2.5 sm:gap-3">
            <button
              onClick={handleOpenEditModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              <HiPencilSquare className="w-4 h-4" />
              <span>Edit Registration Details</span>
            </button>

            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition"
            >
              <HiKey className="w-4 h-4 text-gray-600" />
              <span>Change Password</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Personal Details & Layout Residence Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Section 1: Personal & Contact Information */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <HiEnvelope className="w-5 h-5 text-primary-600" />
              Personal & Contact Information
            </h2>
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Step 2 of Reg
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">Full Name</span>
              <span className="text-sm font-bold text-gray-900">{profileData.name || '—'}</span>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                Mobile Phone Number
              </span>
              <span className="text-sm font-bold text-gray-900">{profileData.phone || '—'}</span>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                Email Address
              </span>
              <span className="text-sm font-bold text-gray-900">{profileData.email || '—'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                  Registered Role
                </span>
                <span className="text-xs font-bold text-primary-700 capitalize">
                  {profileData.role === 'admin' ? 'Association Admin' : 'Resident Member'}
                </span>
              </div>

              <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                  Language Preference
                </span>
                <span className="text-xs font-bold text-gray-800 uppercase">
                  {profileData.language === 'ta' ? 'தமிழ் (Tamil)' : 'English (en)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Layout Residence Address */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <HiHome className="w-5 h-5 text-emerald-600" />
              Layout Residence Address
            </h2>
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Step 3 of Reg
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                Door / Plot No
              </span>
              <span className="text-sm font-bold text-gray-900">{profileData.door_no || '—'}</span>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                Street / Cross
              </span>
              <span className="text-sm font-bold text-gray-900">{profileData.street || '—'}</span>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 sm:col-span-2">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                Layout / Colony Name
              </span>
              <span className="text-sm font-bold text-gray-900">{profileData.layout_name || '—'}</span>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">Taluk</span>
              <span className="text-sm font-bold text-gray-900">{profileData.taluk || '—'}</span>
            </div>

            <div className="p-3 bg-gray-50/80 rounded-xl border border-gray-100">
              <span className="text-gray-400 block font-semibold uppercase text-[10px]">
                District & State
              </span>
              <span className="text-sm font-bold text-gray-900">
                {profileData.district || '—'}
                {profileData.state ? `, ${profileData.state}` : ''}
              </span>
            </div>
          </div>

          {/* Formatted Postal Representation */}
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-start gap-2.5">
            <HiMapPin className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 font-medium leading-relaxed">
              {[
                profileData.door_no ? `Door / Plot ${profileData.door_no}` : null,
                profileData.street,
                profileData.layout_name,
                profileData.taluk ? `${profileData.taluk} Taluk` : null,
                profileData.district,
                profileData.state,
              ]
                .filter(Boolean)
                .join(', ') || 'No complete address recorded yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Address Proof Documents (Step 4 of Reg) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-1 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-600 flex-shrink-0" />
            <h2 className="text-xs sm:text-base font-bold text-gray-900 leading-tight">
              4. ADDRESS PROOF DOCUMENTS (MANDATORY FOR VERIFICATION)
            </h2>
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Step 4 of Reg
          </span>
        </div>

        <p className="text-xs text-gray-500">
          Uploaded verification documents saved in your profile. You can view, download, or upload updated documents anytime.
        </p>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 pt-1">
          {/* Document 1: Electricity (EB) Bill Proof */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-800">
              Electricity (EB) Bill Proof
            </label>

            {profileData.eb_bill_proof ? (
              /* Already Uploaded Card */
              <div className="p-4 rounded-2xl border border-sky-100 bg-sky-50/50 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                      <HiDocumentText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Electricity Bill Document</h4>
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <HiCheckCircle className="w-3 h-3 text-emerald-600" /> Saved in Profile
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-sky-100">
                  <a
                    href={resolveFileUrl(profileData.eb_bill_proof)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-sky-100/50 text-sky-700 border border-sky-200 text-xs font-bold rounded-xl transition shadow-xs"
                  >
                    <HiArrowTopRightOnSquare className="w-4 h-4" />
                    <span>View Proof Document</span>
                  </a>
                  <a
                    href={resolveFileUrl(profileData.eb_bill_proof)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 bg-white hover:bg-sky-100/50 text-sky-700 border border-sky-200 rounded-xl transition shadow-xs"
                    title="Download File"
                  >
                    <HiArrowDownTray className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              /* Upload Dropzone (matching registration form screenshot) */
              <div>
                <input
                  type="file"
                  ref={ebInputRef}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('File exceeds 5MB limit');
                        return;
                      }
                      setEbFile(file);
                    }
                  }}
                />

                {!ebFile ? (
                  <div
                    onClick={() => ebInputRef.current?.click()}
                    className="border-2 border-dashed border-sky-200 hover:border-primary-400 bg-sky-50/20 hover:bg-sky-50/50 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] group"
                  >
                    <div className="w-11 h-11 rounded-full bg-sky-100 group-hover:bg-primary-100 text-sky-600 group-hover:text-primary-600 flex items-center justify-center mb-2.5 transition">
                      <HiArrowUpTray className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-primary-600 group-hover:text-primary-700 mb-0.5">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Electricity Bill PDF/JPG (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-sky-200 bg-sky-50/50 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
                        <HiDocumentText className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[200px]">
                          {ebFile.name}
                        </p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(ebFile.size)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEbFile(null);
                        if (ebInputRef.current) ebInputRef.current.value = '';
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition"
                      title="Remove file"
                    >
                      <HiXMark className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Document 2: Property Tax Receipt */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-800">
              Property Tax Receipt
            </label>

            {profileData.property_tax_receipt ? (
              /* Already Uploaded Card */
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                      <HiDocumentText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Property Tax Document</h4>
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <HiCheckCircle className="w-3 h-3 text-emerald-600" /> Saved in Profile
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-emerald-100">
                  <a
                    href={resolveFileUrl(profileData.property_tax_receipt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-emerald-100/50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition shadow-xs"
                  >
                    <HiArrowTopRightOnSquare className="w-4 h-4" />
                    <span>View Proof Document</span>
                  </a>
                  <a
                    href={resolveFileUrl(profileData.property_tax_receipt)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-2 bg-white hover:bg-emerald-100/50 text-emerald-700 border border-emerald-200 rounded-xl transition shadow-xs"
                    title="Download File"
                  >
                    <HiArrowDownTray className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              /* Upload Dropzone (matching registration form screenshot) */
              <div>
                <input
                  type="file"
                  ref={taxInputRef}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('File exceeds 5MB limit');
                        return;
                      }
                      setTaxFile(file);
                    }
                  }}
                />

                {!taxFile ? (
                  <div
                    onClick={() => taxInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-200 hover:border-primary-400 bg-emerald-50/20 hover:bg-emerald-50/50 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] group"
                  >
                    <div className="w-11 h-11 rounded-full bg-emerald-100 group-hover:bg-primary-100 text-emerald-600 group-hover:text-primary-600 flex items-center justify-center mb-2.5 transition">
                      <HiArrowUpTray className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-primary-600 group-hover:text-primary-700 mb-0.5">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-[11px] text-gray-400">
                      Property Tax Receipt PDF/JPG (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                        <HiDocumentText className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[200px]">
                          {taxFile.name}
                        </p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(taxFile.size)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setTaxFile(null);
                        if (taxInputRef.current) taxInputRef.current.value = '';
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white transition"
                      title="Remove file"
                    >
                      <HiXMark className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save Documents Action Button if new files are selected */}
        {(ebFile || taxFile) && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-primary-50/60 p-4 rounded-2xl border border-primary-100">
            <div>
              <p className="text-xs font-bold text-primary-900">
                You have selected new verification documents
              </p>
              <p className="text-[11px] text-primary-700">
                Click save to upload and store these files directly in your profile.
              </p>
            </div>

            <button
              type="button"
              disabled={uploadingDocs}
              onClick={handleSaveDocuments}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 flex-shrink-0"
            >
              <HiArrowUpTray className="w-4 h-4" />
              <span>{uploadingDocs ? 'Saving Documents...' : 'Save Documents to Profile'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal: Edit Registration & Profile Details (ALL FIELDS & DOCUMENTS INCLUDED) */}
      <Modal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        title="Edit Registration & Profile Details"
        size="lg"
      >
        <form onSubmit={handleSaveProfile} className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
          {/* Association & Role Overview */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-bold">Association</span>
              <span className="font-bold text-gray-900">
                {profileData.association_name || 'Layout Resident Association'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg uppercase text-[10px]">
                {profileData.role === 'admin' ? 'Association Admin' : 'Resident Member'}
              </span>
              <span className="px-2.5 py-1 bg-primary-50 text-primary-700 border border-primary-200 font-mono font-bold rounded-lg text-[10px]">
                Code: {profileData.member_code || 'PENDING'}
              </span>
            </div>
          </div>

          {/* Section 1: Personal & Contact Information */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-800 flex items-center gap-1.5 pb-1 border-b border-gray-100">
              <HiEnvelope className="w-4 h-4 text-primary-600" />
              1. Personal & Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                  Language Preference
                </label>
                <select
                  value={editForm.language}
                  onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="en">English (Default)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Residence & Layout Address */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5 pb-1 border-b border-gray-100">
              <HiHome className="w-4 h-4 text-emerald-600" />
              2. Layout Residence Address
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Door / Plot Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. Plot 42 / Door 12B"
                  value={editForm.door_no}
                  onChange={(e) => setEditForm({ ...editForm, door_no: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Street / Cross
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2nd Main Road, 4th Cross"
                  value={editForm.street}
                  onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Layout / Colony Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sri Krishna Nagar Layout"
                  value={editForm.layout_name}
                  onChange={(e) => setEditForm({ ...editForm, layout_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Taluk
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tambaram"
                  value={editForm.taluk}
                  onChange={(e) => setEditForm({ ...editForm, taluk: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  District
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chengalpattu"
                  value={editForm.district}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Address Proof Documents Upload */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5 pb-1 border-b border-gray-100">
              <HiDocumentText className="w-4 h-4 text-indigo-600" />
              3. Address Proof Documents (Mandatory for Verification)
            </h4>
            <p className="text-[11px] text-gray-500">
              Upload or update your address verification documents. Supported formats: PDF, JPG, PNG (Max 5MB each).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* EB Bill Input in Modal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800">
                    Electricity (EB) Bill Proof
                  </label>
                  {profileData.eb_bill_proof && (
                    <a
                      href={resolveFileUrl(profileData.eb_bill_proof)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary-600 hover:text-primary-800 font-bold inline-flex items-center gap-1"
                    >
                      <HiArrowTopRightOnSquare className="w-3 h-3" />
                      View Current
                    </a>
                  )}
                </div>

                <input
                  type="file"
                  ref={modalEbInputRef}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('EB file exceeds 5MB limit');
                        return;
                      }
                      setModalEbFile(file);
                    }
                  }}
                />

                {!modalEbFile ? (
                  <div
                    onClick={() => modalEbInputRef.current?.click()}
                    className="border-2 border-dashed border-sky-200 hover:border-primary-400 bg-sky-50/20 hover:bg-sky-50/50 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[110px] group"
                  >
                    <HiArrowUpTray className="w-5 h-5 text-sky-500 group-hover:text-primary-600 mb-1" />
                    <p className="text-xs font-bold text-primary-600 group-hover:text-primary-700">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Electricity Bill PDF/JPG (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-sky-200 bg-sky-50/60 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HiDocumentText className="w-5 h-5 text-sky-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[140px]">
                          {modalEbFile.name}
                        </p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(modalEbFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModalEbFile(null);
                        if (modalEbInputRef.current) modalEbInputRef.current.value = '';
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Property Tax Input in Modal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800">
                    Property Tax Receipt
                  </label>
                  {profileData.property_tax_receipt && (
                    <a
                      href={resolveFileUrl(profileData.property_tax_receipt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold inline-flex items-center gap-1"
                    >
                      <HiArrowTopRightOnSquare className="w-3 h-3" />
                      View Current
                    </a>
                  )}
                </div>

                <input
                  type="file"
                  ref={modalTaxInputRef}
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error('Tax file exceeds 5MB limit');
                        return;
                      }
                      setModalTaxFile(file);
                    }
                  }}
                />

                {!modalTaxFile ? (
                  <div
                    onClick={() => modalTaxInputRef.current?.click()}
                    className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/20 hover:bg-emerald-50/50 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[110px] group"
                  >
                    <HiArrowUpTray className="w-5 h-5 text-emerald-500 group-hover:text-emerald-600 mb-1" />
                    <p className="text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                      Click to upload or drag & drop
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Property Tax Receipt PDF/JPG (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HiDocumentText className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[140px]">
                          {modalTaxFile.name}
                        </p>
                        <p className="text-[10px] text-gray-500">{formatFileSize(modalTaxFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModalTaxFile(null);
                        if (modalTaxInputRef.current) modalTaxInputRef.current.value = '';
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 rounded"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons in Modal */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsEditProfileOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-50 transition flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                'Save Profile Changes'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Change Password */}
      <Modal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        title="Change Account Password"
        size="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              New Password *
            </label>
            <input
              type="password"
              required
              placeholder="At least 6 characters"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              placeholder="Re-enter new password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsChangePasswordOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm disabled:opacity-50 transition"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
