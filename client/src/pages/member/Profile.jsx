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
  HiCamera,
  HiPhoto,
  HiUserGroup,
  HiPlus,
  HiTrash,
  HiCalendar,
  HiHeart,
  HiExclamationTriangle,
  HiArrowUturnLeft,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Modal from '../../components/common/Modal';

export default function Profile() {
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(user || {});

  // Profile photo quick upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // Association details & edit modal
  const [assocDetails, setAssocDetails] = useState(null);
  const [isEditAssocOpen, setIsEditAssocOpen] = useState(false);
  const [submittingAssoc, setSubmittingAssoc] = useState(false);
  const [assocLogoFile, setAssocLogoFile] = useState(null);
  const [assocLogoPreview, setAssocLogoPreview] = useState(null);
  const assocLogoInputRef = useRef(null);
  const [assocForm, setAssocForm] = useState({
    name: '',
    city: '',
    address: '',
  });

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
  const [modalPhotoFile, setModalPhotoFile] = useState(null);
  const [modalPhotoPreview, setModalPhotoPreview] = useState(null);
  const modalPhotoInputRef = useRef(null);
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
    password: '',
    confirmPassword: '',
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

  // Family Members Management State
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [isAddFamilyOpen, setIsAddFamilyOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);
  const [submittingFamily, setSubmittingFamily] = useState(false);
  const [familyForm, setFamilyForm] = useState({
    name: '',
    relation: 'Spouse',
    custom_relation: '',
    dob: '',
    blood_group: '',
    phone: '',
  });

  // Family Removal State
  const [removingFamily, setRemovingFamily] = useState(null);
  const [removalReasonPreset, setRemovalReasonPreset] = useState('Relocated / Moved out');
  const [removalReasonCustom, setRemovalReasonCustom] = useState('');
  const [submittingRemoval, setSubmittingRemoval] = useState(false);
  const [showRemovedHistory, setShowRemovedHistory] = useState(false);

  const RELATION_PRESETS = [
    'Spouse',
    'Husband',
    'Wife',
    'Father',
    'Mother',
    'Son',
    'Daughter',
    'Brother',
    'Sister',
    'Father-in-law',
    'Mother-in-law',
    'Grandfather',
    'Grandmother',
    'Uncle',
    'Aunt',
    'Guardian',
    'Other',
  ];

  const BLOOD_GROUP_OPTIONS = [
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-',
    'Unknown',
  ];

  const REMOVAL_PRESETS = [
    'Relocated / Moved out',
    'Marriage',
    'Deceased',
    'Entered by mistake',
    'Created independent member account',
    'Other',
  ];

  const calculateAge = (dobString) => {
    if (!dobString) return null;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const formatDob = (dobString) => {
    if (!dobString) return null;
    try {
      const d = new Date(dobString);
      if (isNaN(d.getTime())) return dobString;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dobString;
    }
  };

  const fetchFamilyMembers = async () => {
    if (!user?.id) return;
    try {
      setLoadingFamily(true);
      const res = await api.get(`/users/${user.id}/family-members?include_removed=true`);
      const list = res.data?.data || res.data || [];
      setFamilyMembers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to load family members:', err);
    } finally {
      setLoadingFamily(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchFamilyMembers();
    }
  }, [user?.id]);

  const handleOpenAddFamily = () => {
    setEditingFamily(null);
    setFamilyForm({
      name: '',
      relation: 'Spouse',
      custom_relation: '',
      dob: '',
      blood_group: '',
      phone: '',
    });
    setIsAddFamilyOpen(true);
  };

  const handleOpenEditFamily = (member) => {
    setEditingFamily(member);
    const isStandard = RELATION_PRESETS.includes(member.relation);
    setFamilyForm({
      name: member.name || '',
      relation: isStandard ? member.relation : 'Other',
      custom_relation: isStandard ? '' : member.relation || '',
      dob: member.dob ? member.dob.substring(0, 10) : '',
      blood_group: member.blood_group || '',
      phone: member.phone || '',
    });
    setIsAddFamilyOpen(true);
  };

  const handleSaveFamily = async (e) => {
    e.preventDefault();
    if (!familyForm.name.trim()) {
      toast.error('Please enter the family member name');
      return;
    }
    const finalRelation =
      familyForm.relation === 'Other'
        ? familyForm.custom_relation.trim()
        : familyForm.relation.trim();

    if (!finalRelation) {
      toast.error('Please specify the relationship');
      return;
    }

    try {
      setSubmittingFamily(true);
      const payload = {
        name: familyForm.name.trim(),
        relation: finalRelation,
        dob: familyForm.dob || null,
        blood_group: familyForm.blood_group || null,
        phone: familyForm.phone.trim() || null,
      };

      if (editingFamily) {
        await api.put(`/users/${user.id}/family-members/${editingFamily.id}`, payload);
        toast.success('Family member updated successfully!');
      } else {
        await api.post(`/users/${user.id}/family-members`, payload);
        toast.success('Family member added successfully!');
      }

      setIsAddFamilyOpen(false);
      setEditingFamily(null);
      await fetchFamilyMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save family member');
    } finally {
      setSubmittingFamily(false);
    }
  };

  const handleOpenRemoveFamily = (member) => {
    setRemovingFamily(member);
    setRemovalReasonPreset('Relocated / Moved out');
    setRemovalReasonCustom('');
  };

  const handleConfirmRemoveFamily = async (e) => {
    e.preventDefault();
    if (!removingFamily) return;

    let finalReason = '';
    if (removalReasonPreset === 'Other') {
      finalReason = removalReasonCustom.trim();
    } else {
      finalReason = removalReasonCustom.trim()
        ? `${removalReasonPreset} - ${removalReasonCustom.trim()}`
        : removalReasonPreset;
    }

    if (!finalReason) {
      toast.error('Please provide a reason for removal');
      return;
    }

    try {
      setSubmittingRemoval(true);
      await api.delete(`/users/${user.id}/family-members/${removingFamily.id}`, {
        data: { removal_reason: finalReason },
      });
      toast.success(`${removingFamily.name} removed from active household directory.`);
      setRemovingFamily(null);
      await fetchFamilyMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove family member');
    } finally {
      setSubmittingRemoval(false);
    }
  };

  const handleRestoreFamily = async (member) => {
    try {
      await api.post(`/users/${user.id}/family-members/${member.id}/restore`);
      toast.success(`${member.name} restored to active family list!`);
      await fetchFamilyMembers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore family member');
    }
  };


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

  const fetchAssocDetails = async (assocId) => {
    if (!assocId) return;
    try {
      const res = await api.get(`/associations/${assocId}`);
      const data = res.data?.data || res.data;
      if (data) {
        setAssocDetails(data);
        setAssocForm({
          name: data.name || '',
          city: data.city || '',
          address: data.address || '',
        });
      }
    } catch (err) {
      console.warn('Could not fetch association details:', err);
    }
  };

  useEffect(() => {
    const assocId = profileData.association_id || user?.association_id;
    if (assocId) {
      fetchAssocDetails(assocId);
    }
  }, [profileData.association_id, user?.association_id]);

  // Handle direct profile photo upload from avatar
  const handleDirectPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, JPEG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile photo must be less than 5MB');
      return;
    }
    try {
      setUploadingPhoto(true);
      const formData = new FormData();
      formData.append('profile_photo', file);
      const res = await api.put(`/users/${user.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data?.data || res.data;
      if (updated) {
        setProfileData(updated);
        updateUser(updated);
        toast.success('Profile photo updated successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload profile photo');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Open Edit Association Modal
  const handleOpenEditAssocModal = () => {
    if (assocDetails) {
      setAssocForm({
        name: assocDetails.name || '',
        city: assocDetails.city || '',
        address: assocDetails.address || '',
      });
    }
    setAssocLogoFile(null);
    setAssocLogoPreview(null);
    setIsEditAssocOpen(true);
  };

  // Save Association Details & Logo
  const handleSaveAssociation = async (e) => {
    e.preventDefault();
    const assocId = profileData.association_id || user?.association_id;
    if (!assocId) return;
    try {
      setSubmittingAssoc(true);
      const formData = new FormData();
      formData.append('name', assocForm.name.trim());
      formData.append('city', assocForm.city.trim());
      formData.append('address', assocForm.address.trim());
      if (assocLogoFile) {
        formData.append('logo', assocLogoFile);
      }
      const res = await api.put(`/associations/${assocId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data?.data || res.data;
      if (updated) {
        setAssocDetails(updated);
        setProfileData((prev) => ({ ...prev, association_name: updated.name }));
        updateUser({ association_name: updated.name });
      }
      setAssocLogoFile(null);
      setAssocLogoPreview(null);
      setIsEditAssocOpen(false);
      toast.success('Association details & logo updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update association');
    } finally {
      setSubmittingAssoc(false);
    }
  };

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
      password: '',
      confirmPassword: '',
    });
    setModalEbFile(null);
    setModalTaxFile(null);
    setModalPhotoFile(null);
    setModalPhotoPreview(null);
    setIsEditProfileOpen(true);
  };

  // Handle Edit Profile Form Submission (all fields + documents included)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Full name is required');
      return;
    }

    if (editForm.password) {
      if (editForm.password.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      if (editForm.password !== editForm.confirmPassword) {
        toast.error('Password and confirm password do not match');
        return;
      }
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('name', editForm.name.trim());
      formData.append('phone', editForm.phone.trim());
      formData.append('email', editForm.email.trim());
      formData.append('language', editForm.language || 'en');
      formData.append('door_no', editForm.door_no.trim());
      formData.append('street', editForm.street.trim());
      formData.append('layout_name', editForm.layout_name.trim());
      formData.append('taluk', editForm.taluk.trim());
      formData.append('district', editForm.district.trim());
      formData.append('state', editForm.state.trim());

      if (editForm.password) {
        formData.append('password', editForm.password);
      }

      // If user selected new profile photo
      if (modalPhotoFile) {
        formData.append('profile_photo', modalPhotoFile);
      }

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

      setModalPhotoFile(null);
      setModalPhotoPreview(null);
      setModalEbFile(null);
      setModalTaxFile(null);
      toast.success('Registration details & documents updated successfully!');
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
  const isSuperAdmin = profileData.role === 'super_admin';
  const roleDisplay = profileData.is_main_admin
    ? 'Main Association Admin'
    : (profileData.role === 'admin'
      ? 'Layout Admin'
      : (profileData.role === 'super_admin' ? 'Super Admin' : 'Resident Member'));

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

        <div className="relative group flex-shrink-0">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center flex-shrink-0 shadow-lg ring-4 overflow-hidden relative ${
              isAdmin
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-700 ring-purple-100'
                : 'bg-gradient-to-tr from-primary-600 to-teal-600 ring-primary-100'
            }`}
          >
            {profileData.profile_photo ? (
              <img
                src={resolveFileUrl(profileData.profile_photo)}
                alt={profileData.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              initials
            )}

            {/* Upload Spinner Overlay */}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white">
                <HiArrowPath className="w-6 h-6 animate-spin" />
              </div>
            )}
          </div>

          {/* Camera Button for Quick Photo Upload */}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            title="Change Profile Photo"
            className="absolute -bottom-1 -right-1 p-2 bg-white text-gray-700 hover:text-primary-600 dark:bg-slate-800 dark:text-gray-200 rounded-full shadow-md border border-gray-200 dark:border-slate-700 transition transform hover:scale-110 active:scale-95 focus:outline-none"
          >
            <HiCamera className="w-4 h-4" />
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleDirectPhotoUpload}
          />
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2 w-full">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              {profileData.name}
            </h1>

            {/* Role Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider ${
                profileData.is_main_admin
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : (isAdmin
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200')
              }`}
            >
              <HiShieldCheck className="w-3.5 h-3.5" />
              {roleDisplay}
            </span>

            {/* Code Badge */}
            <span className="font-mono text-[11px] sm:text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
              {isSuperAdmin ? 'PLATFORM LEVEL' : `Code: ${profileData.member_code || 'PENDING'}`}
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
              <span className="break-words">
                {profileData.association_name || (isSuperAdmin ? 'Jishnu Infotech • Multi-Association Platform Level' : 'Layout Resident Association')}
              </span>
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
              <span>Edit Profile Details</span>
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

      {/* Registered Association Details Card (with Edit Association Option for Admins) */}
      {!isSuperAdmin && (profileData.association_id || profileData.association_name || assocDetails) && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <HiBuildingOffice2 className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                Registered Association Details
              </h2>
            </div>
            {isAdmin && (profileData.association_id || user?.association_id) && (
              <button
                type="button"
                onClick={handleOpenEditAssocModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition shadow-xs"
              >
                <HiPencilSquare className="w-4 h-4" />
                <span>Edit Association Details</span>
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/60">
            {/* Association Logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm p-1.5">
              {assocDetails?.logo ? (
                <img
                  src={resolveFileUrl(assocDetails.logo)}
                  alt={assocDetails.name || 'Association Logo'}
                  className="w-full h-full object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg">
                  {assocDetails?.name ? assocDetails.name.slice(0, 2).toUpperCase() : 'AS'}
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {assocDetails?.name || profileData.association_name || 'Layout Association'}
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {assocDetails?.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-600 flex items-center justify-center sm:justify-start gap-1">
                <HiMapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span>
                  {assocDetails?.city ? `${assocDetails.city}` : ''}
                  {assocDetails?.address ? ` • ${assocDetails.address}` : ''}
                  {!assocDetails?.city && !assocDetails?.address && 'Tamil Nadu, India'}
                </span>
              </p>
              {assocDetails?.main_admin_name && (
                <p className="text-[11px] text-gray-500">
                  Main Administrator: <strong className="text-gray-800">{assocDetails.main_admin_name}</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid: Personal Details & Layout Residence Address */}
      <div className={`grid grid-cols-1 ${isSuperAdmin ? '' : 'md:grid-cols-2'} gap-4 sm:gap-6`}>
        {/* Section 1: Personal & Contact Information */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h2 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <HiEnvelope className="w-5 h-5 text-primary-600" />
              Personal & Contact Information
            </h2>
            {!isSuperAdmin && (
              <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Step 2 of Reg
              </span>
            )}
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
                  {roleDisplay}
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

        {/* Section 2: Layout Residence Address - Excluded for Super Admin */}
        {!isSuperAdmin && (
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
        )}
      </div>

      {/* Section 3: Address Proof Documents (Step 4 of Reg) - Excluded for Super Admin */}
      {!isSuperAdmin && (
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
      )}

      {/* Section 4: Family Members & Household Directory - Excluded for Super Admin */}
      {!isSuperAdmin && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
              <HiUserGroup className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                  Family Members & Household Directory
                </h2>
                <span className="px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-bold rounded-full">
                  {familyMembers.filter((m) => m.is_active).length} Active
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Maintain household records, emergency contacts, relationships, and blood groups.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddFamily}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition flex-shrink-0"
          >
            <HiPlus className="w-4 h-4" />
            <span>Add Family Member</span>
          </button>
        </div>

        {/* Content */}
        {loadingFamily ? (
          <div className="py-8 flex items-center justify-center text-gray-400 gap-2">
            <HiArrowPath className="w-5 h-5 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading family records...</span>
          </div>
        ) : familyMembers.filter((m) => m.is_active).length === 0 ? (
          <div className="py-8 px-4 text-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3 shadow-xs">
              <HiUserGroup className="w-6 h-6" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-gray-800 mb-1">
              No family members added yet
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-500 max-w-md mb-4">
              Add your spouse, children, parents, or other household members to keep your community directory up-to-date and enable emergency contact coordination.
            </p>
            <button
              type="button"
              onClick={handleOpenAddFamily}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <HiPlus className="w-4 h-4" />
              <span>Add First Family Member</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {familyMembers
              .filter((m) => m.is_active)
              .map((member) => {
                const age = calculateAge(member.dob);
                return (
                  <div
                    key={member.id}
                    className="p-4 rounded-2xl border border-gray-200/80 bg-gradient-to-br from-white to-gray-50/60 hover:border-teal-200 transition shadow-xs flex flex-col justify-between space-y-3"
                  >
                    {/* Top Row: Name, Relation, Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 font-extrabold text-sm flex items-center justify-center flex-shrink-0 shadow-xs">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 truncate">
                            {member.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 mt-0.5 bg-teal-50 border border-teal-200/80 text-teal-700 font-bold text-[10px] rounded-md uppercase tracking-wider">
                            {member.relation}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditFamily(member)}
                          title="Edit Details"
                          className="p-1.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                        >
                          <HiPencilSquare className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRemoveFamily(member)}
                          title="Remove Member"
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                      {/* DOB / Age */}
                      <div className="p-2 bg-white rounded-xl border border-gray-100/90 flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                          <HiCalendar className="w-3.5 h-3.5 text-teal-500" />
                          <span>DOB & Age</span>
                        </span>
                        <span className="font-semibold text-gray-800 text-xs mt-0.5 truncate">
                          {member.dob ? (
                            <>
                              {formatDob(member.dob)}
                              {age !== null && (
                                <span className="text-gray-500 font-normal ml-1">
                                  ({age} yrs)
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 italic">Not set</span>
                          )}
                        </span>
                      </div>

                      {/* Blood Group */}
                      <div className="p-2 bg-white rounded-xl border border-gray-100/90 flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                          <HiHeart className="w-3.5 h-3.5 text-rose-500" />
                          <span>Blood Group</span>
                        </span>
                        <div className="mt-0.5">
                          {member.blood_group ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-xs rounded-md">
                              {member.blood_group}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Not specified</span>
                          )}
                        </div>
                      </div>

                      {/* Phone / Contact */}
                      <div className="p-2 bg-white rounded-xl border border-gray-100/90 col-span-2 flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                          <HiPhone className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Contact / Mobile</span>
                        </span>
                        <span className="font-semibold text-gray-800">
                          {member.phone || <span className="text-gray-400 italic">Not recorded</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Removed Records Accordion / Toggle */}
        {familyMembers.some((m) => !m.is_active) && (
          <div className="pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowRemovedHistory(!showRemovedHistory)}
              className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-900 transition"
            >
              <HiClock className="w-4 h-4 text-gray-400" />
              <span>
                {showRemovedHistory ? 'Hide' : 'View'} Removed Family Records (
                {familyMembers.filter((m) => !m.is_active).length})
              </span>
            </button>

            {showRemovedHistory && (
              <div className="mt-3 space-y-2">
                {familyMembers
                  .filter((m) => !m.is_active)
                  .map((removed) => (
                    <div
                      key={removed.id}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 line-through">
                            {removed.name}
                          </span>
                          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-700 font-semibold text-[10px] rounded">
                            {removed.relation}
                          </span>
                          {removed.blood_group && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold text-[10px] rounded">
                              {removed.blood_group}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Reason: {removed.removal_reason || 'Removed'}
                          </span>
                          {removed.removed_at && (
                            <span className="text-gray-400">
                              Removed on {formatDob(removed.removed_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreFamily(removed)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-teal-700 hover:text-teal-800 font-bold rounded-lg transition text-xs shadow-xs flex-shrink-0"
                        title="Restore this family member back to active list"
                      >
                        <HiArrowUturnLeft className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Modal: Edit Registration & Profile Details (MATCHING REGISTRATION LAYOUT) */}
      <Modal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        title="Edit Registration & Profile Details"
        size="xl"
      >
        <form onSubmit={handleSaveProfile} className="space-y-6 max-h-[82vh] overflow-y-auto px-1 pr-2">
          {/* Association & Role Overview Bar */}
          <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <HiBuildingOffice2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">
                  {isSuperAdmin ? 'Platform Provider' : 'Assigned Association'}
                </span>
                <span className="font-bold text-blue-900 text-sm">
                  {isSuperAdmin ? 'Jishnu Infotech (Platform Level)' : (profileData.association_name || 'Layout Resident Association')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white border border-blue-200 text-blue-800 font-bold rounded-xl uppercase text-[11px] shadow-sm">
                {roleDisplay}
              </span>
              <span className="px-3 py-1 bg-blue-600 text-white font-mono font-bold rounded-xl text-[11px] shadow-sm">
                Code: {profileData.member_code || (isSuperAdmin ? '#000001' : 'PENDING')}
              </span>
            </div>
          </div>

          {/* 1. PROFILE PHOTO */}
          <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xl ring-2 ring-primary-200 flex-shrink-0 shadow-sm">
              {modalPhotoPreview ? (
                <img src={modalPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : profileData.profile_photo ? (
                <img src={resolveFileUrl(profileData.profile_photo)} alt="Current" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <label className="block text-xs font-bold text-gray-800 mb-0.5">
                Profile Photo
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                Upload a portrait photo for your account (PNG, JPG, max 5MB).
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => modalPhotoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-xs"
                >
                  <HiCamera className="w-4 h-4 text-primary-600" />
                  <span>{modalPhotoPreview || profileData.profile_photo ? 'Change Photo' : 'Upload Photo'}</span>
                </button>
                {modalPhotoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalPhotoFile(null);
                      setModalPhotoPreview(null);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                  >
                    Clear Selection
                  </button>
                )}
                <input
                  ref={modalPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 5 * 1024 * 1024) {
                        toast.error('Profile photo must be less than 5MB');
                        return;
                      }
                      setModalPhotoFile(f);
                      setModalPhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2. PERSONAL DETAILS */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
              <HiUser className="w-5 h-5 text-blue-600" />
              <span>2. PERSONAL DETAILS</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Muralidharan"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Language Preference
                </label>
                <select
                  value={editForm.language || 'en'}
                  onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                >
                  <option value="en">English (en)</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. LAYOUT RESIDENCE ADDRESS & 4. ADDRESS PROOF DOCUMENTS - Excluded for Super Admin */}
          {!isSuperAdmin && (
            <>
              {/* 3. LAYOUT RESIDENCE ADDRESS */}
          <div className="space-y-3 pt-1">
            <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
              <HiHome className="w-5 h-5 text-blue-600" />
              <span>3. LAYOUT RESIDENCE ADDRESS</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Door / Plot No *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14A or Plot 21"
                  value={editForm.door_no}
                  onChange={(e) => setEditForm({ ...editForm, door_no: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Street / Cross *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2nd Cross Street"
                  value={editForm.street}
                  onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Layout / Colony Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Green Valley Gardens"
                  value={editForm.layout_name}
                  onChange={(e) => setEditForm({ ...editForm, layout_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Taluk
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tambaram"
                  value={editForm.taluk}
                  onChange={(e) => setEditForm({ ...editForm, taluk: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  District
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chengalpattu"
                  value={editForm.district}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  placeholder="Tamil Nadu"
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* 4. ADDRESS PROOF DOCUMENTS (MANDATORY FOR VERIFICATION) */}
          <div className="space-y-3 pt-1">
            <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
              <HiMapPin className="w-5 h-5 text-blue-600" />
              <span>4. ADDRESS PROOF DOCUMENTS (MANDATORY FOR VERIFICATION)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Electricity (EB) Bill Proof Dropzone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    Electricity (EB) Bill Proof
                  </label>
                  {profileData.eb_bill_proof && (
                    <a
                      href={resolveFileUrl(profileData.eb_bill_proof)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                    >
                      <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Current File</span>
                      <HiArrowTopRightOnSquare className="w-3 h-3" />
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
                        toast.error('EB Bill file exceeds 5MB limit');
                        return;
                      }
                      setModalEbFile(file);
                    }
                  }}
                />

                {!modalEbFile ? (
                  <div
                    onClick={() => modalEbInputRef.current?.click()}
                    className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/20 hover:bg-blue-50/50 rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[120px] group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100/70 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                      <HiArrowUpTray className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-blue-600 group-hover:text-blue-700">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Electricity Bill PDF/JPG (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-blue-200 bg-blue-50/50 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <HiDocumentText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[160px]">
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
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Property Tax Receipt Dropzone */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    Property Tax Receipt
                  </label>
                  {profileData.property_tax_receipt && (
                    <a
                      href={resolveFileUrl(profileData.property_tax_receipt)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                    >
                      <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Current File</span>
                      <HiArrowTopRightOnSquare className="w-3 h-3" />
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
                        toast.error('Tax Receipt file exceeds 5MB limit');
                        return;
                      }
                      setModalTaxFile(file);
                    }
                  }}
                />

                {!modalTaxFile ? (
                  <div
                    onClick={() => modalTaxInputRef.current?.click()}
                    className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/20 hover:bg-blue-50/50 rounded-2xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[120px] group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100/70 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                      <HiArrowUpTray className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-blue-600 group-hover:text-blue-700">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Property Tax Receipt PDF/JPG (Max 5MB)
                    </p>
                  </div>
                ) : (
                  <div className="border border-blue-200 bg-blue-50/50 rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <HiDocumentText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[160px]">
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
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition"
                    >
                      <HiXMark className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
          )}

          {/* 5. SECURITY PASSWORD */}
          <div className="space-y-3 pt-1">
            <h3 className="text-sm font-bold text-blue-600 flex items-center gap-2">
              <HiKey className="w-5 h-5 text-blue-600" />
              <span>5. SECURITY PASSWORD (OPTIONAL - LEAVE EMPTY TO KEEP CURRENT)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  minLength={6}
                  placeholder="Min 6 characters"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Re-type password"
                  value={editForm.confirmPassword}
                  onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Action buttons matching Registration Submit style */}
          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsEditProfileOpen(false)}
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-8 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                'Submit Registration Request Updates'
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

      {/* Modal: Edit Association Details & Logo */}
      <Modal
        isOpen={isEditAssocOpen}
        onClose={() => setIsEditAssocOpen(false)}
        title="Edit Association Details & Logo"
        size="lg"
      >
        <form onSubmit={handleSaveAssociation} className="space-y-5 p-1">
          {/* Association Logo Upload & Preview */}
          <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white border border-indigo-200 flex items-center justify-center p-2 flex-shrink-0 shadow-sm">
              {assocLogoPreview ? (
                <img src={assocLogoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
              ) : assocDetails?.logo ? (
                <img src={resolveFileUrl(assocDetails.logo)} alt="Current Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl">
                  {assocForm.name ? assocForm.name.slice(0, 2).toUpperCase() : 'AS'}
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Association Logo / Emblem
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                Upload your community or association logo image (PNG, JPG, SVG, max 5MB).
              </p>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => assocLogoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl transition shadow-xs"
                >
                  <HiPhoto className="w-4 h-4 text-indigo-600" />
                  <span>{assocLogoPreview || assocDetails?.logo ? 'Change Logo' : 'Upload Logo'}</span>
                </button>
                {assocLogoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssocLogoFile(null);
                      setAssocLogoPreview(null);
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                  >
                    Clear Selection
                  </button>
                )}
                <input
                  ref={assocLogoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      if (f.size > 5 * 1024 * 1024) {
                        toast.error('Logo file must be less than 5MB');
                        return;
                      }
                      setAssocLogoFile(f);
                      setAssocLogoPreview(URL.createObjectURL(f));
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Association Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Association Name *
            </label>
            <input
              type="text"
              required
              value={assocForm.name}
              onChange={(e) => setAssocForm({ ...assocForm, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              placeholder="e.g. Green Meadows Residents Welfare Association"
            />
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              City / Town *
            </label>
            <input
              type="text"
              required
              value={assocForm.city}
              onChange={(e) => setAssocForm({ ...assocForm, city: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              placeholder="e.g. Coimbatore"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Full Postal Address
            </label>
            <textarea
              rows={3}
              value={assocForm.address}
              onChange={(e) => setAssocForm({ ...assocForm, address: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
              placeholder="e.g. Main Avenue, Phase 1, Saravanampatti, Coimbatore 641035"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsEditAssocOpen(false)}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingAssoc}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {submittingAssoc ? 'Saving Changes...' : 'Save Association Details'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add or Edit Family Member */}
      <Modal
        isOpen={isAddFamilyOpen}
        onClose={() => {
          setIsAddFamilyOpen(false);
          setEditingFamily(null);
        }}
        title={editingFamily ? 'Edit Family Member Details' : 'Add Family Member'}
        size="md"
      >
        <form onSubmit={handleSaveFamily} className="space-y-4">
          <p className="text-xs text-gray-500">
            {editingFamily
              ? 'Update details for this household family member.'
              : 'Add a new family member residing at your plot/door number.'}
          </p>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={familyForm.name}
              onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })}
              placeholder="e.g. Priya Sundaram"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
            />
          </div>

          {/* Relationship */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Relationship to Member *
            </label>
            <select
              value={familyForm.relation}
              onChange={(e) => setFamilyForm({ ...familyForm, relation: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
            >
              {RELATION_PRESETS.map((rel) => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          {familyForm.relation === 'Other' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Specify Relationship *
              </label>
              <input
                type="text"
                required
                value={familyForm.custom_relation}
                onChange={(e) => setFamilyForm({ ...familyForm, custom_relation: e.target.value })}
                placeholder="e.g. Cousin, Nephew, Ward"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
              />
            </div>
          )}

          {/* Date of Birth & Blood Group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Date of Birth (DOB)
              </label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={familyForm.dob}
                onChange={(e) => setFamilyForm({ ...familyForm, dob: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Blood Group
              </label>
              <select
                value={familyForm.blood_group}
                onChange={(e) => setFamilyForm({ ...familyForm, blood_group: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
              >
                <option value="">Select Blood Group</option>
                {BLOOD_GROUP_OPTIONS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {familyForm.dob && calculateAge(familyForm.dob) !== null && (
            <div className="px-3 py-2 bg-teal-50 rounded-xl border border-teal-100 text-xs text-teal-800 font-medium flex items-center justify-between">
              <span>Calculated Age:</span>
              <span className="font-bold">{calculateAge(familyForm.dob)} Years old</span>
            </div>
          )}

          {/* Contact / Phone */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Contact / Mobile Number
            </label>
            <input
              type="tel"
              value={familyForm.phone}
              onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })}
              placeholder="e.g. 9876543210 (Optional)"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsAddFamilyOpen(false);
                setEditingFamily(null);
              }}
              className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingFamily}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
            >
              {submittingFamily
                ? 'Saving...'
                : editingFamily
                ? 'Update Details'
                : 'Add Family Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Remove Family Member with Reason */}
      <Modal
        isOpen={!!removingFamily}
        onClose={() => setRemovingFamily(null)}
        title="Remove Family Member"
        size="md"
      >
        {removingFamily && (
          <form onSubmit={handleConfirmRemoveFamily} className="space-y-4">
            <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200/80 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <HiExclamationTriangle className="w-5 h-5" />
              </div>
              <div className="text-xs text-rose-900">
                <p className="font-bold">
                  Are you sure you want to remove {removingFamily.name}?
                </p>
                <p className="mt-0.5 text-rose-700 leading-relaxed">
                  Relationship: <span className="font-semibold">{removingFamily.relation}</span>.
                  For auditing and association record keeping, a reason for removal is mandatory.
                </p>
              </div>
            </div>

            {/* Removal Reason Preset */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                Reason for Removal *
              </label>
              <select
                required
                value={removalReasonPreset}
                onChange={(e) => setRemovalReasonPreset(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-gray-900"
              >
                {REMOVAL_PRESETS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom or Additional Notes */}
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">
                {removalReasonPreset === 'Other'
                  ? 'Please Specify Reason *'
                  : 'Additional Notes / Explanation (Optional)'}
              </label>
              <textarea
                rows={3}
                required={removalReasonPreset === 'Other'}
                value={removalReasonCustom}
                onChange={(e) => setRemovalReasonCustom(e.target.value)}
                placeholder={
                  removalReasonPreset === 'Other'
                    ? 'Enter the reason for removing this family member...'
                    : 'Any additional notes for records...'
                }
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-gray-900"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setRemovingFamily(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingRemoval}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {submittingRemoval ? 'Removing...' : 'Confirm Removal'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
