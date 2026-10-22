import React, { useState, useEffect } from 'react';
import {
  HiXMark,
  HiShieldCheck,
  HiMapPin,
  HiPhone,
  HiEnvelope,
  HiCalendar,
  HiHeart,
  HiIdentification,
} from 'react-icons/hi2';
import api from '../../services/api';

export default function DigitalIdCardModal({
  isOpen,
  onClose,
  user,
  associationName,
  canManageRoles = false,
  onChangeRole,
}) {
  const [fullUser, setFullUser] = useState(user || {});
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

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

  useEffect(() => {
    if (!user?.id || !isOpen) return;
    setFullUser(user);

    const fetchExtra = async () => {
      try {
        setLoadingExtra(true);
        const [userRes, familyRes] = await Promise.allSettled([
          api.get(`/users/${user.id}`),
          api.get(`/users/${user.id}/family-members?include_removed=false`),
        ]);

        if (userRes.status === 'fulfilled' && userRes.value?.data?.data) {
          setFullUser((prev) => ({ ...prev, ...userRes.value.data.data }));
        }
        if (familyRes.status === 'fulfilled' && familyRes.value?.data?.data) {
          const list = familyRes.value.data.data || [];
          setFamilyMembers(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        console.warn('Could not fetch extra user info:', err);
      } finally {
        setLoadingExtra(false);
      }
    };

    fetchExtra();
  }, [user?.id, isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const currentAssocName =
    fullUser.association_name ||
    associationName ||
    (fullUser.role === 'super_admin' ? 'Residents Welfare Association' : 'Residents Welfare Association');

  const isSuperAdmin = fullUser.role === 'super_admin';
  const isMainAdmin = fullUser.is_main_admin || fullUser.display_role === 'Main Association Admin';
  const isLayoutAdmin = fullUser.role === 'admin' && !isMainAdmin;

  const roleTitle = isSuperAdmin
    ? 'Super Administrator'
    : isMainAdmin
    ? 'Main Association Admin'
    : isLayoutAdmin
    ? 'Layout Admin'
    : 'Resident Member';

  const roleTheme = isSuperAdmin
    ? {
        badgeBg: 'bg-purple-900 text-purple-100 border-purple-400/40',
        cardHeader: 'from-purple-900 via-indigo-900 to-slate-900',
        accent: 'text-purple-600',
        ring: 'ring-purple-400',
        emoji: '👑',
      }
    : isMainAdmin
    ? {
        badgeBg: 'bg-indigo-900 text-indigo-100 border-indigo-400/40',
        cardHeader: 'from-indigo-900 via-blue-900 to-slate-900',
        accent: 'text-indigo-600',
        ring: 'ring-indigo-400',
        emoji: '🛡️',
      }
    : isLayoutAdmin
    ? {
        badgeBg: 'bg-blue-900 text-blue-100 border-blue-400/40',
        cardHeader: 'from-blue-900 via-sky-900 to-slate-900',
        accent: 'text-blue-600',
        ring: 'ring-blue-400',
        emoji: '🛡️',
      }
    : {
        badgeBg: 'bg-teal-900 text-teal-100 border-teal-400/40',
        cardHeader: 'from-teal-900 via-emerald-900 to-slate-900',
        accent: 'text-teal-600',
        ring: 'ring-teal-400',
        emoji: '👥',
      };

  const memberCode = fullUser.member_code || (isSuperAdmin ? '000001' : 'PENDING');

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-md bg-gray-900/90 rounded-3xl shadow-2xl border border-gray-700/60 overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* Top Floating Control Bar */}
        <div className="p-3.5 sm:px-6 bg-gray-900 border-b border-gray-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Digital Identity Pass
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="p-1.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl border border-gray-700 transition"
            >
              <HiXMark className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col items-center">
          {/* Lanyard Top Punch Hole & Clip Strap */}
          <div className="w-full flex flex-col items-center mb-1">
            <div className="w-16 h-3 bg-gray-800 rounded-full border border-gray-600 shadow-inner flex items-center justify-center">
              <div className="w-6 h-1 bg-black/70 rounded-full" />
            </div>
            <div className="w-10 h-3 bg-gradient-to-b from-gray-700 to-gray-900 border-x border-gray-600 shadow-md" />
          </div>

          {/* SINGLE FRONT-SIDE ID CARD CONTAINER */}
          <div className="w-full max-w-[370px] rounded-3xl overflow-hidden shadow-2xl border border-gray-200 bg-white text-gray-900 transition-all duration-300 relative">
            {/* Header Band */}
            <div
              className={`bg-gradient-to-r ${roleTheme.cardHeader} text-white p-4 pt-5 pb-4 relative overflow-hidden text-center`}
            >
              {/* Subtle Security Guilloche Pattern overlay */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

              {/* Association Name */}
              <div className="relative z-10 px-6">
                <p className="text-[10px] tracking-widest uppercase font-extrabold text-amber-400">
                  EGATES • RESIDENTS WELFARE ASSOCIATION
                </p>
                <h2 className="text-sm sm:text-base font-black tracking-tight mt-0.5 line-clamp-1 drop-shadow-sm">
                  {currentAssocName}
                </h2>
                <p className="text-[9px] uppercase tracking-wider text-gray-300 font-semibold mt-0.5">
                  OFFICIAL DIGITAL IDENTITY PASS
                </p>
              </div>

              {/* Hologram / Smart Chip Simulation */}
              <div className="absolute top-3 left-3 w-8 h-6 bg-gradient-to-tr from-amber-200 via-amber-400 to-yellow-500 rounded-md border border-amber-300 shadow-xs flex items-center justify-center opacity-85">
                <div className="w-4 h-3 border border-amber-800/40 rounded-xs flex flex-col justify-between p-0.5">
                  <div className="w-full h-0.5 bg-amber-800/40" />
                  <div className="w-full h-0.5 bg-amber-800/40" />
                </div>
              </div>

              <div className="absolute top-3 right-3 px-2 py-0.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-[9px] font-bold text-amber-300 flex items-center gap-1">
                <HiShieldCheck className="w-3 h-3 text-amber-300" />
                <span>VERIFIED</span>
              </div>
            </div>

            {/* Photo & Identity Section */}
            <div className="p-5 flex flex-col items-center text-center bg-gradient-to-b from-gray-50 via-white to-gray-50/50">
              <div className="relative mb-2.5">
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-lg border-2 border-white ring-4 ${roleTheme.ring} bg-gradient-to-tr from-gray-800 to-gray-700 flex items-center justify-center font-black text-3xl text-white`}
                >
                  {fullUser.profile_photo ? (
                    <img
                      src={resolveFileUrl(fullUser.profile_photo)}
                      alt={fullUser.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : fullUser.name ? (
                    fullUser.name.slice(0, 2).toUpperCase()
                  ) : (
                    'U'
                  )}
                </div>

                {/* Status Pill on Photo */}
                <span className="absolute -bottom-2 inset-x-0 mx-auto w-max px-2.5 py-0.5 bg-emerald-600 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-full shadow-md border border-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>{fullUser.status === 'approved' ? 'Active' : fullUser.status || 'Active'}</span>
                </span>
              </div>

              {/* Member Name */}
              <h3 className="text-base sm:text-lg font-black text-gray-900 tracking-tight mt-2 line-clamp-1">
                {fullUser.name}
              </h3>

              {/* Role Designation Badge */}
              <div
                className={`mt-1 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${roleTheme.badgeBg}`}
              >
                <span>{roleTheme.emoji}</span>
                <span>{roleTitle}</span>
              </div>

              {/* Member Code Monospace Pill */}
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  MEMBER ID:
                </span>
                <span className="font-mono text-xs font-black text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-lg border border-primary-200">
                  #{memberCode}
                </span>
              </div>

              {/* Front Identity Details Grid */}
              <div className="w-full grid grid-cols-2 gap-2 mt-4 text-left text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Door / Plot No
                  </span>
                  <span className="font-extrabold text-gray-900 truncate block">
                    {fullUser.door_no ? `Door #${fullUser.door_no}` : '—'}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Street / Cross
                  </span>
                  <span className="font-semibold text-gray-900 truncate block">
                    {fullUser.street || '—'}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Phone / Contact
                  </span>
                  <span className="font-mono font-semibold text-gray-900 truncate block">
                    {fullUser.phone || '—'}
                  </span>
                </div>

                <div className="p-2.5 bg-white rounded-xl border border-gray-100 shadow-xs">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">
                    Blood Group
                  </span>
                  <span className="font-bold text-rose-600 truncate block">
                    {familyMembers.find((f) => f.relation?.toLowerCase() === 'self')?.blood_group ||
                      fullUser.blood_group || (
                        <span className="text-gray-400 font-normal italic">Not specified</span>
                      )}
                  </span>
                </div>

                {(fullUser.layout_name || fullUser.district) && (
                  <div className="col-span-2 p-2.5 bg-white rounded-xl border border-gray-100 shadow-xs">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">
                      Layout / Location
                    </span>
                    <span className="font-semibold text-gray-800 truncate block">
                      {[fullUser.layout_name, fullUser.taluk ? `${fullUser.taluk} Taluk` : null, fullUser.district, fullUser.state]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="p-3.5 sm:px-6 bg-gray-900 border-t border-gray-800 flex items-center justify-between gap-2">
          <div>
            {canManageRoles && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onChangeRole) onChangeRole(fullUser);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                <HiShieldCheck className="w-4 h-4" />
                <span>Change Role</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-bold rounded-xl transition border border-gray-700 shadow-xs ml-auto"
          >
            <HiXMark className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
