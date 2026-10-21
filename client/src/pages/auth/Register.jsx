import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  HiUser,
  HiEnvelope,
  HiPhone,
  HiLockClosed,
  HiBuildingOffice2,
  HiHome,
  HiMapPin,
  HiCheckCircle,
  HiExclamationCircle,
  HiShieldCheck,
  HiPhoto,
  HiCamera,
  HiArrowRight,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import FileUpload from '../../components/common/FileUpload';
import PoweredByLogo from '../../components/common/PoweredByLogo';
import Modal from '../../components/common/Modal';
import api from '../../services/api';

export default function Register() {
  const { register, registerAssociationAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active registration form mode: 'member' | 'admin' | 'assoc-admin'
  const initialType = searchParams.get('type') || 'member';
  const validModes = ['member', 'admin', 'assoc-admin', 'assoc_admin'];
  const normalizedInitial =
    initialType === 'assoc_admin' || initialType === 'assoc-admin'
      ? 'assoc-admin'
      : initialType === 'admin'
      ? 'admin'
      : 'member';

  const [activeForm, setActiveForm] = useState(normalizedInitial);
  const [associations, setAssociations] = useState([]);
  const [loadingAssocs, setLoadingAssocs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Member Form State
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    association_id: '',
    door_no: '',
    street: '',
    layout_name: '',
    taluk: '',
    district: '',
    state: 'Tamil Nadu',
    password: '',
    confirm_password: '',
  });
  const [memberEbProof, setMemberEbProof] = useState(null);
  const [memberTaxProof, setMemberTaxProof] = useState(null);
  const [memberProfilePhoto, setMemberProfilePhoto] = useState(null);
  const [memberPhotoPreview, setMemberPhotoPreview] = useState(null);
  const memberPhotoInputRef = useRef(null);
  const memberCameraInputRef = useRef(null);

  // 2. Admin Form State (for existing association)
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    association_id: '',
    door_no: '',
    street: '',
    layout_name: '',
    taluk: '',
    district: '',
    state: 'Tamil Nadu',
    password: '',
    confirm_password: '',
  });
  const [adminEbProof, setAdminEbProof] = useState(null);
  const [adminTaxProof, setAdminTaxProof] = useState(null);
  const [adminProfilePhoto, setAdminProfilePhoto] = useState(null);
  const [adminPhotoPreview, setAdminPhotoPreview] = useState(null);
  const adminPhotoInputRef = useRef(null);
  const adminCameraInputRef = useRef(null);

  // 3. Association + Admin Form State (Combined new association creation)
  const [assocAdminForm, setAssocAdminForm] = useState({
    association_name: '',
    association_city: '',
    association_address: '',
    name: '',
    email: '',
    phone: '',
    door_no: '',
    street: '',
    taluk: '',
    district: '',
    state: 'Tamil Nadu',
    password: '',
    confirm_password: '',
  });
  const [assocLogo, setAssocLogo] = useState(null);
  const [assocEbProof, setAssocEbProof] = useState(null);
  const [assocTaxProof, setAssocTaxProof] = useState(null);
  const [assocAdminProfilePhoto, setAssocAdminProfilePhoto] = useState(null);
  const [assocAdminPhotoPreview, setAssocAdminPhotoPreview] = useState(null);
  const assocAdminPhotoInputRef = useRef(null);
  const assocAdminCameraInputRef = useRef(null);

  // Camera Modal State & Handlers
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState('member'); // 'member' | 'admin' | 'assoc-admin'
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const videoRef = useRef(null);

  // Bind video element when stream is active
  useEffect(() => {
    if (cameraModalOpen && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch((err) => console.warn('Camera play warning:', err));
      };
      videoRef.current.play().catch(() => {});
    }
  }, [cameraModalOpen, cameraStream]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const openCameraModal = async (target) => {
    setCameraTarget(target);
    setCameraError('');
    setCapturedBlob(null);
    setCapturedPreview(null);
    setCameraModalOpen(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam is not directly accessible. Please use device camera.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera stream error:', err);
      setCameraError(
        'Unable to open webcam stream. You can still use your native device camera below.'
      );
    }
  };

  const closeCameraModal = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    setCameraModalOpen(false);
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    setCapturedPreview(null);
    if (videoRef.current) {
      if (cameraStream && videoRef.current.srcObject !== cameraStream) {
        videoRef.current.srcObject = cameraStream;
      }
      videoRef.current.play().catch(() => {});
    }
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 640;
    if (vw === 0 || vh === 0) return;
    const canvas = document.createElement('canvas');
    const size = Math.min(vw, vh);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Mirror snapshot to match live mirror view
    ctx.translate(size, 0);
    ctx.scale(-1, 1);

    // Center-crop to square portrait
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCapturedBlob(file);
          setCapturedPreview(canvas.toDataURL('image/jpeg', 0.92));
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleConfirmCapturedPhoto = () => {
    if (!capturedBlob || !capturedPreview) return;
    if (cameraTarget === 'member') {
      setMemberProfilePhoto(capturedBlob);
      setMemberPhotoPreview(capturedPreview);
    } else if (cameraTarget === 'admin') {
      setAdminProfilePhoto(capturedBlob);
      setAdminPhotoPreview(capturedPreview);
    } else if (cameraTarget === 'assoc-admin') {
      setAssocAdminProfilePhoto(capturedBlob);
      setAssocAdminPhotoPreview(capturedPreview);
    }
    closeCameraModal();
  };

  const triggerNativeCamera = () => {
    closeCameraModal();
    if (cameraTarget === 'member') {
      memberCameraInputRef.current?.click();
    } else if (cameraTarget === 'admin') {
      adminCameraInputRef.current?.click();
    } else if (cameraTarget === 'assoc-admin') {
      assocAdminCameraInputRef.current?.click();
    }
  };

  // Handle Photo Selection with live preview
  const handlePhotoSelect = (file, setPhoto, setPreview) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Profile photo size must be less than 5MB.');
      return;
    }
    setErrorMessage('');
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Sync with URL query parameter
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'assoc-admin' || type === 'assoc_admin') {
      setActiveForm('assoc-admin');
    } else if (type === 'admin') {
      setActiveForm('admin');
    } else if (type === 'member') {
      setActiveForm('member');
    }
  }, [searchParams]);

  const handleTabChange = (mode) => {
    setActiveForm(mode);
    setSearchParams({ type: mode });
    setErrorMessage('');
    setSuccessData(null);
  };

  // Fetch associations for dropdowns
  useEffect(() => {
    let isMounted = true;
    const fetchAssociations = async () => {
      try {
        setLoadingAssocs(true);
        const res = await api.get('/associations');
        const list = res.data?.data || res.data || [];
        if (isMounted) {
          setAssociations(list);
          if (list.length > 0) {
            setMemberForm((prev) => ({
              ...prev,
              association_id: prev.association_id || list[0].id,
            }));
            setAdminForm((prev) => ({
              ...prev,
              association_id: prev.association_id || list[0].id,
            }));
          }
        }
      } catch (err) {
        console.warn('Could not load associations list:', err.message);
      } finally {
        if (isMounted) setLoadingAssocs(false);
      }
    };

    fetchAssociations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Password strength helper
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: 'bg-gray-200' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 25, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 50, label: 'Fair', color: 'bg-yellow-500' };
    if (score === 3) return { score: 75, label: 'Good', color: 'bg-blue-500' };
    return { score: 100, label: 'Strong', color: 'bg-green-500' };
  };

  // 1. Submit Member Registration
  const handleSubmitMember = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessData(null);

    if (memberForm.password !== memberForm.confirm_password) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }
    if (memberForm.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (!memberForm.phone || memberForm.phone.length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile phone number.');
      return;
    }
    if (!memberForm.association_id) {
      setErrorMessage('Please select your layout association.');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = new FormData();
      Object.entries(memberForm).forEach(([key, val]) => {
        if (key !== 'confirm_password' && val !== null && val !== undefined) {
          data.append(key, val);
        }
      });
      data.append('role', 'member');
      if (memberEbProof instanceof File) {
        data.append('eb_bill_proof', memberEbProof);
      }
      if (memberTaxProof instanceof File) {
        data.append('property_tax_receipt', memberTaxProof);
      }
      if (memberProfilePhoto instanceof File) {
        data.append('profile_photo', memberProfilePhoto);
      }

      await register(data);
      setSuccessData({
        title: 'Member Registration Submitted!',
        message:
          'Your resident member registration has been submitted successfully. The Main Association Admin will review your address details and approve your account shortly.',
        type: 'member',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Member registration failed. Please check the fields and try again.';
      setErrorMessage(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Submit Admin Registration (Existing Association)
  const handleSubmitAdmin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessData(null);

    if (adminForm.password !== adminForm.confirm_password) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }
    if (adminForm.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (!adminForm.phone || adminForm.phone.length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile phone number.');
      return;
    }
    if (!adminForm.association_id) {
      setErrorMessage('Please select the layout association to administer.');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = new FormData();
      Object.entries(adminForm).forEach(([key, val]) => {
        if (key !== 'confirm_password' && val !== null && val !== undefined) {
          data.append(key, val);
        }
      });
      data.append('role', 'admin');
      if (adminEbProof instanceof File) {
        data.append('eb_bill_proof', adminEbProof);
      }
      if (adminTaxProof instanceof File) {
        data.append('property_tax_receipt', adminTaxProof);
      }
      if (adminProfilePhoto instanceof File) {
        data.append('profile_photo', adminProfilePhoto);
      }

      await register(data);
      setSuccessData({
        title: 'Admin Registration Submitted!',
        message:
          'Your administrator registration application has been submitted successfully. It will be reviewed and approved by the Main Association Admin.',
        type: 'admin',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Administrator registration failed. Please check the fields and try again.';
      setErrorMessage(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Submit Association + Admin Combined Registration
  const handleSubmitAssocAdmin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessData(null);

    if (!assocAdminForm.association_name.trim()) {
      setErrorMessage('Association name is required.');
      return;
    }
    if (!assocAdminForm.association_city.trim()) {
      setErrorMessage('City / District is required.');
      return;
    }
    if (!assocAdminForm.name.trim()) {
      setErrorMessage('Administrator name is required.');
      return;
    }
    if (!assocAdminForm.phone || assocAdminForm.phone.length < 10) {
      setErrorMessage('Please provide a valid 10-digit mobile phone number.');
      return;
    }
    if (assocAdminForm.password !== assocAdminForm.confirm_password) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }
    if (assocAdminForm.password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = new FormData();
      Object.entries(assocAdminForm).forEach(([key, val]) => {
        if (key !== 'confirm_password' && val !== null && val !== undefined) {
          data.append(key, val);
        }
      });

      if (assocLogo instanceof File) {
        data.append('logo', assocLogo);
      }
      if (assocEbProof instanceof File) {
        data.append('eb_bill_proof', assocEbProof);
      }
      if (assocTaxProof instanceof File) {
        data.append('property_tax_receipt', assocTaxProof);
      }
      if (assocAdminProfilePhoto instanceof File) {
        data.append('profile_photo', assocAdminProfilePhoto);
      }

      await registerAssociationAdmin(data);
      setSuccessData({
        title: 'Application Submitted for Super Admin Approval!',
        message: `Your registration request for new association "${assocAdminForm.association_name}" and Administrator account "${assocAdminForm.name}" has been submitted successfully! It is currently pending review in the Super Admin portal. Once the Super Administrator approves your application, you will be able to log in.`,
        type: 'assoc-admin',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Combined registration failed. Please check the fields and try again.';
      setErrorMessage(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const memberStrength = getPasswordStrength(memberForm.password);
  const adminStrength = getPasswordStrength(adminForm.password);
  const assocAdminStrength = getPasswordStrength(assocAdminForm.password);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Header */}
      <div className="relative w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <Link to="/" className="flex items-center gap-2 text-white">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center font-black text-lg shadow-lg">
            LA
          </div>
          <span className="font-bold text-base tracking-tight hidden sm:inline">
            Association Portal
          </span>
        </Link>

        {/* Top Centre with Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <PoweredByLogo size="lg" />
        </div>

        <div className="md:hidden">
          <PoweredByLogo size="md" />
        </div>
      </div>

      {/* Main Registration Container */}
      <div className="w-full max-w-4xl mx-auto my-6">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-5 sm:p-10">
          {/* Header Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Registration Portal
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
              Select your registration form type below to complete your registration
            </p>
          </div>

          {/* 3 Separate Form Selectors / Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            {/* 1. Admin + Association Registration */}
            <button
              type="button"
              onClick={() => handleTabChange('assoc-admin')}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                activeForm === 'assoc-admin'
                  ? 'bg-purple-50/80 border-purple-500 shadow-md ring-2 ring-purple-500/20'
                  : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">🏛️</span>
                {activeForm === 'assoc-admin' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-600 text-white px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Admin + Association
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Register new layout & Main Association Admin
                </p>
              </div>
            </button>

            {/* 2. Admin Registration */}
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                activeForm === 'admin'
                  ? 'bg-blue-50/80 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">🛡️</span>
                {activeForm === 'admin' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Admin Registration
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Register as administrator for an existing layout
                </p>
              </div>
            </button>

            {/* 3. Member Registration */}
            <button
              type="button"
              onClick={() => handleTabChange('member')}
              className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                activeForm === 'member'
                  ? 'bg-emerald-50/80 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl">👥</span>
                {activeForm === 'member' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Member Registration
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                  Register as resident member for an existing layout
                </p>
              </div>
            </button>
          </div>

          {/* Success Message Banner */}
          {successData ? (
            <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <h3 className="text-xl font-bold text-gray-900">{successData.title}</h3>
              <p className="text-sm text-gray-700 max-w-lg mx-auto leading-relaxed">
                {successData.message}
              </p>
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-md transition"
                >
                  Proceed to Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setSuccessData(null)}
                  className="w-full sm:w-auto px-5 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl transition"
                >
                  Submit Another Registration
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Error Message */}
              {errorMessage && (
                <div className="p-4 mb-6 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
                  <HiExclamationCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ============================================================== */}
              {/* FORM 1: ADMIN + ASSOCIATION REGISTRATION FORM */}
              {/* ============================================================== */}
              {activeForm === 'assoc-admin' && (
                <form onSubmit={handleSubmitAssocAdmin} className="space-y-8">
                  <div className="bg-purple-50/40 p-4 rounded-2xl border border-purple-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-purple-900 flex items-center gap-2">
                        <span>🏛️</span> Admin + Association Registration Form
                      </h2>
                      <p className="text-xs text-purple-700 mt-0.5">
                        Create a brand-new layout association and register its Main Association Admin
                      </p>
                    </div>
                  </div>

                  {/* Section 1: Association Info */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-2 border-b pb-2">
                      <HiBuildingOffice2 className="w-4 h-4 text-purple-600" />
                      1. New Association Details
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Association / Layout Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={assocAdminForm.association_name}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              association_name: e.target.value,
                            })
                          }
                          placeholder="e.g. Greenfield Residents Welfare Association"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          City / District *
                        </label>
                        <input
                          type="text"
                          required
                          value={assocAdminForm.association_city}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              association_city: e.target.value,
                            })
                          }
                          placeholder="e.g. Chennai"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Registered Layout Address / Office Location
                      </label>
                      <input
                        type="text"
                        value={assocAdminForm.association_address}
                        onChange={(e) =>
                          setAssocAdminForm({
                            ...assocAdminForm,
                            association_address: e.target.value,
                          })
                        }
                        placeholder="e.g. Community Hall, Plot 1, Greenfield Layout, Medavakkam"
                        className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <FileUpload
                        label="Association Official Logo (Optional)"
                        helperText="Upload association logo (JPG/PNG, Max 5MB)"
                        accept="image/png,image/jpeg,image/jpg"
                        value={assocLogo}
                        onChange={(file) => setAssocLogo(file)}
                      />
                    </div>
                  </div>

                  {/* Section 2: Main Association Admin Personal & Contact Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-2 border-b pb-2">
                      <HiShieldCheck className="w-4 h-4 text-purple-600" />
                      2. Main Association Admin Details
                    </h3>

                    {/* Profile Photo Upload */}
                    <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-18 h-18 rounded-2xl overflow-hidden bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xl ring-2 ring-purple-200 flex-shrink-0 shadow-xs">
                        {assocAdminPhotoPreview ? (
                          <img
                            src={assocAdminPhotoPreview}
                            alt="Profile Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <HiCamera className="w-8 h-8 text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <label className="block text-xs font-bold text-gray-800 mb-0.5">
                          Profile Photo (Optional)
                        </label>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Upload portrait profile photo for your Main Administrator account (PNG, JPG, Max 5MB).
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => assocAdminPhotoInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold rounded-xl transition shadow-xs"
                          >
                            <HiPhoto className="w-4 h-4 text-purple-600" />
                            <span>Choose from Files</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openCameraModal('assoc-admin')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
                          >
                            <HiCamera className="w-4 h-4" />
                            <span>Click Photo</span>
                          </button>

                          {assocAdminPhotoPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssocAdminProfilePhoto(null);
                                setAssocAdminPhotoPreview(null);
                                if (assocAdminPhotoInputRef.current) assocAdminPhotoInputRef.current.value = '';
                                if (assocAdminCameraInputRef.current) assocAdminCameraInputRef.current.value = '';
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                            >
                              Remove Photo
                            </button>
                          )}

                          <input
                            ref={assocAdminPhotoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={(e) =>
                              handlePhotoSelect(
                                e.target.files?.[0],
                                setAssocAdminProfilePhoto,
                                setAssocAdminPhotoPreview
                              )
                            }
                            className="hidden"
                          />
                          <input
                            ref={assocAdminCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="user"
                            onChange={(e) =>
                              handlePhotoSelect(
                                e.target.files?.[0],
                                setAssocAdminProfilePhoto,
                                setAssocAdminPhotoPreview
                              )
                            }
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Main Association Admin Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={assocAdminForm.name}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              name: e.target.value,
                            })
                          }
                          placeholder="e.g. S. Muralidharan"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Main Admin Mobile Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          pattern="[0-9]{10}"
                          value={assocAdminForm.phone}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              phone: e.target.value,
                            })
                          }
                          placeholder="10-digit mobile"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Main Admin Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={assocAdminForm.email}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              email: e.target.value,
                            })
                          }
                          placeholder="admin@association.com"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Main Admin Address */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-2 border-b pb-2">
                      <HiHome className="w-4 h-4 text-purple-600" />
                      3. Main Admin Address Details
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Door / Office No
                        </label>
                        <input
                          type="text"
                          value={assocAdminForm.door_no}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              door_no: e.target.value,
                            })
                          }
                          placeholder="e.g. Plot 1 / Office"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Street / Road
                        </label>
                        <input
                          type="text"
                          value={assocAdminForm.street}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              street: e.target.value,
                            })
                          }
                          placeholder="e.g. Main Avenue"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Taluk
                        </label>
                        <input
                          type="text"
                          value={assocAdminForm.taluk}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              taluk: e.target.value,
                            })
                          }
                          placeholder="e.g. Sholinganallur"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Admin Verification Documents */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-2 border-b pb-2">
                      <HiMapPin className="w-4 h-4 text-purple-600" />
                      4. Verification Proof Documents (Optional)
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FileUpload
                        label="Electricity (EB) Bill / ID Proof"
                        helperText="Upload PDF/JPG (Max 5MB)"
                        value={assocEbProof}
                        onChange={(file) => setAssocEbProof(file)}
                      />

                      <FileUpload
                        label="Property Tax Receipt / Appointment Letter"
                        helperText="Upload PDF/JPG (Max 5MB)"
                        value={assocTaxProof}
                        onChange={(file) => setAssocTaxProof(file)}
                      />
                    </div>
                  </div>

                  {/* Section 5: Password & Security */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-2 border-b pb-2">
                      <HiLockClosed className="w-4 h-4 text-purple-600" />
                      5. Main Association Admin Security Password
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={assocAdminForm.password}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              password: e.target.value,
                            })
                          }
                          placeholder="Min 6 characters"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                        {assocAdminForm.password && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-gray-500">Strength:</span>
                              <span className="font-semibold text-gray-700">
                                {assocAdminStrength.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${assocAdminStrength.color} transition-all duration-300`}
                                style={{ width: `${assocAdminStrength.score}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Confirm Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={assocAdminForm.confirm_password}
                          onChange={(e) =>
                            setAssocAdminForm({
                              ...assocAdminForm,
                              confirm_password: e.target.value,
                            })
                          }
                          placeholder="Re-type password"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>
                        {isSubmitting
                          ? 'Registering Association & Main Admin...'
                          : 'Register Association & Main Association Admin'}
                      </span>
                      <HiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ============================================================== */}
              {/* FORM 2: ADMIN REGISTRATION FORM (Existing Layout) */}
              {/* ============================================================== */}
              {activeForm === 'admin' && (
                <form onSubmit={handleSubmitAdmin} className="space-y-8">
                  <div className="bg-blue-50/40 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-blue-900 flex items-center gap-2">
                        <span>🛡️</span> Admin Registration Form
                      </h2>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Register as an administrator for an existing layout association
                      </p>
                    </div>
                  </div>

                  {/* 1. Layout Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-2 border-b pb-2">
                      <HiBuildingOffice2 className="w-4 h-4 text-blue-600" />
                      1. Select Layout Association
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Layout Association *
                      </label>
                      <select
                        name="association_id"
                        required
                        value={adminForm.association_id}
                        onChange={(e) =>
                          setAdminForm({
                            ...adminForm,
                            association_id: e.target.value,
                          })
                        }
                        className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">-- Choose Existing Association --</option>
                        {associations.map((assoc) => (
                          <option key={assoc.id} value={assoc.id}>
                            {assoc.name} {assoc.city ? `(${assoc.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. Administrator Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-2 border-b pb-2">
                      <HiUser className="w-4 h-4 text-blue-600" />
                      2. Administrator Personal Details
                    </h3>

                    {/* Profile Photo Upload */}
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-18 h-18 rounded-2xl overflow-hidden bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl ring-2 ring-blue-200 flex-shrink-0 shadow-xs">
                        {adminPhotoPreview ? (
                          <img
                            src={adminPhotoPreview}
                            alt="Profile Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <HiCamera className="w-8 h-8 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <label className="block text-xs font-bold text-gray-800 mb-0.5">
                          Profile Photo (Optional)
                        </label>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Upload portrait profile photo for your administrator account (PNG, JPG, Max 5MB).
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => adminPhotoInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold rounded-xl transition shadow-xs"
                          >
                            <HiPhoto className="w-4 h-4 text-blue-600" />
                            <span>Choose from Files</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openCameraModal('admin')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
                          >
                            <HiCamera className="w-4 h-4" />
                            <span>Click Photo</span>
                          </button>

                          {adminPhotoPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminProfilePhoto(null);
                                setAdminPhotoPreview(null);
                                if (adminPhotoInputRef.current) adminPhotoInputRef.current.value = '';
                                if (adminCameraInputRef.current) adminCameraInputRef.current.value = '';
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                            >
                              Remove Photo
                            </button>
                          )}

                          <input
                            ref={adminPhotoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={(e) =>
                              handlePhotoSelect(
                                e.target.files?.[0],
                                setAdminProfilePhoto,
                                setAdminPhotoPreview
                              )
                            }
                            className="hidden"
                          />
                          <input
                            ref={adminCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="user"
                            onChange={(e) =>
                              handlePhotoSelect(
                                e.target.files?.[0],
                                setAdminProfilePhoto,
                                setAdminPhotoPreview
                              )
                            }
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={adminForm.name}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, name: e.target.value })
                          }
                          placeholder="e.g. S. Muralidharan"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Mobile Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          pattern="[0-9]{10}"
                          value={adminForm.phone}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, phone: e.target.value })
                          }
                          placeholder="10-digit mobile"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={adminForm.email}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, email: e.target.value })
                          }
                          placeholder="admin@layout.com"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Address in Layout */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-2 border-b pb-2">
                      <HiHome className="w-4 h-4 text-blue-600" />
                      3. Layout Address
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Door / Plot No
                        </label>
                        <input
                          type="text"
                          value={adminForm.door_no}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, door_no: e.target.value })
                          }
                          placeholder="e.g. Plot 15 / 2A"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Street / Cross
                        </label>
                        <input
                          type="text"
                          value={adminForm.street}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, street: e.target.value })
                          }
                          placeholder="e.g. 1st Main Road"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Taluk / District
                        </label>
                        <input
                          type="text"
                          value={adminForm.district}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, district: e.target.value })
                          }
                          placeholder="e.g. Chengalpattu"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Verification Proofs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-2 border-b pb-2">
                      <HiMapPin className="w-4 h-4 text-blue-600" />
                      4. Verification Proofs
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FileUpload
                        label="Electricity Bill (EB) / Residence Proof"
                        helperText="Upload PDF/JPG (Max 5MB)"
                        value={adminEbProof}
                        onChange={(file) => setAdminEbProof(file)}
                      />

                      <FileUpload
                        label="Property Tax Receipt / Appointment Letter"
                        helperText="Upload PDF/JPG (Max 5MB)"
                        value={adminTaxProof}
                        onChange={(file) => setAdminTaxProof(file)}
                      />
                    </div>
                  </div>

                  {/* 5. Password */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-2 border-b pb-2">
                      <HiLockClosed className="w-4 h-4 text-blue-600" />
                      5. Administrator Security Password
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={adminForm.password}
                          onChange={(e) =>
                            setAdminForm({ ...adminForm, password: e.target.value })
                          }
                          placeholder="Min 6 characters"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        {adminForm.password && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-gray-500">Strength:</span>
                              <span className="font-semibold text-gray-700">
                                {adminStrength.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${adminStrength.color} transition-all duration-300`}
                                style={{ width: `${adminStrength.score}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Confirm Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={adminForm.confirm_password}
                          onChange={(e) =>
                            setAdminForm({
                              ...adminForm,
                              confirm_password: e.target.value,
                            })
                          }
                          placeholder="Re-type password"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>
                        {isSubmitting
                          ? 'Submitting Admin Registration...'
                          : 'Submit Admin Registration'}
                      </span>
                      <HiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* ============================================================== */}
              {/* FORM 3: MEMBER REGISTRATION FORM (Resident Member) */}
              {/* ============================================================== */}
              {activeForm === 'member' && (
                <form onSubmit={handleSubmitMember} className="space-y-8">
                  <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-emerald-900 flex items-center gap-2">
                        <span>👥</span> Member Registration Form
                      </h2>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Register as a resident homeowner or tenant for your layout association
                      </p>
                    </div>
                  </div>

                  {/* 1. Layout Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 border-b pb-2">
                      <HiBuildingOffice2 className="w-4 h-4 text-emerald-600" />
                      1. Select Layout Association
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Layout Association *
                      </label>
                      <select
                        name="association_id"
                        required
                        value={memberForm.association_id}
                        onChange={(e) =>
                          setMemberForm({
                            ...memberForm,
                            association_id: e.target.value,
                          })
                        }
                        className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">-- Choose Your Association --</option>
                        {associations.map((assoc) => (
                          <option key={assoc.id} value={assoc.id}>
                            {assoc.name} {assoc.city ? `(${assoc.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. Personal Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 border-b pb-2">
                      <HiUser className="w-4 h-4 text-emerald-600" />
                      2. Resident Personal Details
                    </h3>

                    {/* Profile Photo Upload */}
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col sm:flex-row items-center gap-4">
                      <div className="w-18 h-18 rounded-2xl overflow-hidden bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl ring-2 ring-emerald-200 flex-shrink-0 shadow-xs">
                        {memberPhotoPreview ? (
                          <img
                            src={memberPhotoPreview}
                            alt="Profile Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <HiCamera className="w-8 h-8 text-emerald-500" />
                        )}
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <label className="block text-xs font-bold text-gray-800 mb-0.5">
                          Profile Photo (Optional)
                        </label>
                        <p className="text-[11px] text-gray-500 mb-2">
                          Upload portrait profile photo for your resident member account (PNG, JPG, Max 5MB).
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => memberPhotoInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold rounded-xl transition shadow-xs"
                          >
                            <HiPhoto className="w-4 h-4 text-emerald-600" />
                            <span>Choose from Files</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openCameraModal('member')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-xs"
                          >
                            <HiCamera className="w-4 h-4" />
                            <span>Click Photo</span>
                          </button>

                          {memberPhotoPreview && (
                            <button
                              type="button"
                              onClick={() => {
                                setMemberProfilePhoto(null);
                                setMemberPhotoPreview(null);
                                if (memberPhotoInputRef.current) memberPhotoInputRef.current.value = '';
                                if (memberCameraInputRef.current) memberCameraInputRef.current.value = '';
                              }}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                            >
                              Remove Photo
                            </button>
                          )}

                          <input
                            ref={memberPhotoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={(e) =>
                              handlePhotoSelect(
                                e.target.files?.[0],
                                setMemberProfilePhoto,
                                setMemberPhotoPreview
                              )
                            }
                            className="hidden"
                          />
                          <input
                            ref={memberCameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="user"
                            onChange={(e) =>
                              handlePhotoSelect(
                                e.target.files?.[0],
                                setMemberProfilePhoto,
                                setMemberPhotoPreview
                              )
                            }
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={memberForm.name}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, name: e.target.value })
                          }
                          placeholder="e.g. S. Muralidharan"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Mobile Phone *
                        </label>
                        <input
                          type="tel"
                          required
                          pattern="[0-9]{10}"
                          value={memberForm.phone}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, phone: e.target.value })
                          }
                          placeholder="10-digit mobile"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={memberForm.email}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, email: e.target.value })
                          }
                          placeholder="name@example.com"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Address in Layout */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 border-b pb-2">
                      <HiHome className="w-4 h-4 text-emerald-600" />
                      3. Layout Residence Address
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Door / Plot No *
                        </label>
                        <input
                          type="text"
                          required
                          value={memberForm.door_no}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, door_no: e.target.value })
                          }
                          placeholder="e.g. 14A or Plot 21"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Street Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={memberForm.street}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, street: e.target.value })
                          }
                          placeholder="e.g. 2nd Cross Street"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Layout / Colony Name
                        </label>
                        <input
                          type="text"
                          value={memberForm.layout_name}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              layout_name: e.target.value,
                            })
                          }
                          placeholder="e.g. Green Valley"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Taluk
                        </label>
                        <input
                          type="text"
                          value={memberForm.taluk}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, taluk: e.target.value })
                          }
                          placeholder="e.g. Tambaram"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          District
                        </label>
                        <input
                          type="text"
                          value={memberForm.district}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              district: e.target.value,
                            })
                          }
                          placeholder="e.g. Chengalpattu"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={memberForm.state}
                          onChange={(e) =>
                            setMemberForm({ ...memberForm, state: e.target.value })
                          }
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Verification Proofs */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 border-b pb-2">
                      <HiMapPin className="w-4 h-4 text-emerald-600" />
                      4. Address Proof Documents
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FileUpload
                        label="Electricity Bill (EB) Proof"
                        helperText="Upload PDF/JPG (Max 5MB)"
                        value={memberEbProof}
                        onChange={(file) => setMemberEbProof(file)}
                      />

                      <FileUpload
                        label="Property Tax Receipt Proof"
                        helperText="Upload PDF/JPG (Max 5MB)"
                        value={memberTaxProof}
                        onChange={(file) => setMemberTaxProof(file)}
                      />
                    </div>
                  </div>

                  {/* 5. Password */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 border-b pb-2">
                      <HiLockClosed className="w-4 h-4 text-emerald-600" />
                      5. Security Password
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={memberForm.password}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              password: e.target.value,
                            })
                          }
                          placeholder="Min 6 characters"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        {memberForm.password && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-gray-500">Strength:</span>
                              <span className="font-semibold text-gray-700">
                                {memberStrength.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${memberStrength.color} transition-all duration-300`}
                                style={{ width: `${memberStrength.score}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Confirm Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={memberForm.confirm_password}
                          onChange={(e) =>
                            setMemberForm({
                              ...memberForm,
                              confirm_password: e.target.value,
                            })
                          }
                          placeholder="Re-type password"
                          className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span>
                        {isSubmitting
                          ? 'Submitting Member Registration...'
                          : 'Submit Member Registration'}
                      </span>
                      <HiArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* Back to Login Link */}
              <div className="text-center pt-6 border-t border-gray-100 mt-6">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-gray-500 hover:text-primary-600 hover:underline"
                >
                  Already have an account? Sign In here
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-slate-500">
        <p>
          &copy; {new Date().getFullYear()} Layout Association Management System. All
          rights reserved.
        </p>
      </footer>

      {/* CAMERA SNAPSHOT MODAL */}
      <Modal
        isOpen={cameraModalOpen}
        onClose={closeCameraModal}
        title="📸 Click Profile Photo"
        size="md"
      >
        <div className="space-y-4 text-center">
          {cameraError ? (
            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 space-y-3">
              <HiCamera className="w-10 h-10 mx-auto text-amber-600" />
              <p className="text-xs font-semibold">{cameraError}</p>
              <button
                type="button"
                onClick={triggerNativeCamera}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Use Device Camera / File Picker
              </button>
            </div>
          ) : (
            <div>
              {/* Snapshot Preview Mode */}
              {capturedPreview && (
                <div className="space-y-3">
                  <div className="w-64 h-64 mx-auto rounded-3xl overflow-hidden ring-4 ring-emerald-500 shadow-md">
                    <img
                      src={capturedPreview}
                      alt="Captured portrait"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs font-semibold text-gray-700">
                    Photo captured! Do you want to use this portrait photo?
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                    >
                      <span>🔄</span>
                      <span>Retake Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCapturedPhoto}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md"
                    >
                      ✓ Use This Photo
                    </button>
                  </div>
                </div>
              )}

              {/* Live Webcam Stream (Kept mounted to preserve stream and avoid black frames) */}
              <div className={capturedPreview ? 'hidden' : 'space-y-3'}>
                <div className="relative w-64 h-64 mx-auto rounded-3xl overflow-hidden bg-black ring-4 ring-gray-200 shadow-inner flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <div className="absolute inset-0 border-2 border-white/40 rounded-3xl pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border border-dashed border-white/60 rounded-full" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Center your face in the circular guide and click <strong>Capture Photo</strong>.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={triggerNativeCamera}
                    className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    Use Device Camera App
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2"
                  >
                    <HiCamera className="w-4 h-4" />
                    <span>Capture Photo</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
