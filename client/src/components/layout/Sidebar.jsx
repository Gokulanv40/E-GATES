import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HiSquares2X2,
  HiBuildingOffice2,
  HiUserGroup,
  HiUsers,
  HiExclamationCircle,
  HiClipboardDocumentList,
  HiPhoneArrowUpRight,
  HiMegaphone,
  HiChartBarSquare,
  HiChatBubbleLeftRight,
  HiCreditCard,
  HiCalendarDays,
  HiFilm,
  HiDocumentDuplicate,
  HiUserCircle,
  HiXMark,
  HiShieldExclamation,
  HiIdentification,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import DigitalIdCardModal from '../common/DigitalIdCardModal';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [showIdCard, setShowIdCard] = useState(false);

  const superAdminLinks = [
    { name: t('nav_dashboard'), path: '/super-admin/dashboard', icon: HiSquares2X2 },
    { name: t('nav_associations'), path: '/super-admin/associations', icon: HiBuildingOffice2 },
    { name: t('nav_approvals'), path: '/super-admin/approvals', icon: HiShieldExclamation },
    { name: t('nav_users'), path: '/super-admin/users', icon: HiUsers },
    { name: t('nav_events') || 'Community Events', path: '/super-admin/events', icon: HiCalendarDays },
    { name: t('nav_event_captures') || 'Event Captures', path: '/super-admin/event-captures', icon: HiFilm },
    { name: t('nav_voting'), path: '/super-admin/polls', icon: HiChartBarSquare },
    { name: t('nav_sos_reports'), path: '/super-admin/sos-reports', icon: HiExclamationCircle },
    { name: t('nav_audit_log'), path: '/super-admin/audit-log', icon: HiClipboardDocumentList },
    { name: t('nav_profile') || 'My Profile', path: '/super-admin/profile', icon: HiUserCircle },
  ];

  const adminLinks = [
    { name: t('nav_dashboard'), path: '/admin/dashboard', icon: HiSquares2X2 },
    ...(user?.is_main_admin
      ? [{ name: t('nav_approvals') || 'Pending Approvals', path: '/admin/approvals', icon: HiShieldExclamation }]
      : []),
    { name: 'Manage Users', path: '/admin/users', icon: HiUsers },
    { name: t('nav_sos_contacts'), path: '/admin/sos-contacts', icon: HiPhoneArrowUpRight },
    { name: t('nav_sos_alerts'), path: '/admin/sos-alerts', icon: HiExclamationCircle },
    { name: t('nav_news'), path: '/admin/news', icon: HiMegaphone },
    { name: t('nav_voting'), path: '/admin/voting', icon: HiChartBarSquare },
    { name: t('nav_complaints'), path: '/admin/complaints', icon: HiChatBubbleLeftRight },
    { name: t('nav_events'), path: '/admin/events', icon: HiCalendarDays },
    { name: t('nav_event_captures') || 'Event Captures', path: '/admin/event-captures', icon: HiFilm },
    { name: t('nav_profile'), path: '/admin/profile', icon: HiUserCircle },
  ];

  const memberLinks = [
    { name: t('nav_dashboard'), path: '/member/dashboard', icon: HiSquares2X2 },
    { name: t('nav_sos_contacts') || 'Emergency SOS', path: '/member/sos-contacts', icon: HiPhoneArrowUpRight },
    { name: t('nav_events'), path: '/member/events', icon: HiCalendarDays },
    { name: t('nav_event_captures') || 'Event Captures', path: '/member/event-captures', icon: HiFilm },
    { name: t('nav_news'), path: '/member/news', icon: HiMegaphone },
    { name: t('nav_voting'), path: '/member/voting', icon: HiChartBarSquare },
    { name: t('nav_complaints'), path: '/member/complaints', icon: HiChatBubbleLeftRight },
    { name: t('nav_profile'), path: '/member/profile', icon: HiUserCircle },
  ];

  const links =
    user?.role === 'super_admin'
      ? superAdminLinks
      : user?.role === 'admin'
      ? adminLinks
      : memberLinks;

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

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowIdCard(true)}
            title="Click to view Digital ID Card"
            className="flex items-center gap-3 text-left p-1.5 -ml-1.5 rounded-xl hover:bg-slate-800/80 transition focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-md group-hover:scale-105 group-hover:bg-primary-500 transition">
              LA
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white tracking-tight group-hover:text-primary-300 transition">
                  Association MS
                </h2>
              </div>
              <span className="text-[10px] text-slate-400 capitalize block -mt-0.5 group-hover:text-slate-300">
                {user?.is_main_admin
                  ? 'Main Association Admin'
                  : (user?.role === 'admin'
                    ? 'Layout Admin'
                    : (user?.role?.replace('_', ' ') || 'Community'))}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation Menu
          </div>
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-900/30 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Bottom User Info Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-primary-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user?.profile_photo ? (
                <img
                  src={resolveFileUrl(user.profile_photo)}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.email || user?.phone || 'Online'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Digital ID Card Modal */}
      {showIdCard && (
        <DigitalIdCardModal
          isOpen={showIdCard}
          onClose={() => setShowIdCard(false)}
          user={user}
          associationName={user?.association_name}
        />
      )}
    </>
  );
}
