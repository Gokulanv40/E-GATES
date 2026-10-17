import React from 'react';
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
  HiDocumentDuplicate,
  HiUserCircle,
  HiXMark,
  HiShieldExclamation,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const superAdminLinks = [
    { name: t('nav_dashboard'), path: '/super-admin/dashboard', icon: HiSquares2X2 },
    { name: t('nav_associations'), path: '/super-admin/associations', icon: HiBuildingOffice2 },
    { name: t('nav_approvals'), path: '/super-admin/approvals', icon: HiShieldExclamation },
    { name: t('nav_users'), path: '/super-admin/users', icon: HiUsers },
    { name: t('nav_voting'), path: '/super-admin/polls', icon: HiChartBarSquare },
    { name: t('nav_sos_reports'), path: '/super-admin/sos-reports', icon: HiExclamationCircle },
    { name: t('nav_audit_log'), path: '/super-admin/audit-log', icon: HiClipboardDocumentList },
  ];

  const adminLinks = [
    { name: t('nav_dashboard'), path: '/admin/dashboard', icon: HiSquares2X2 },
    { name: t('nav_members'), path: '/admin/members', icon: HiUserGroup },
    { name: t('nav_sos_contacts'), path: '/admin/sos-contacts', icon: HiPhoneArrowUpRight },
    { name: t('nav_sos_alerts'), path: '/admin/sos-alerts', icon: HiExclamationCircle },
    { name: t('nav_news'), path: '/admin/news', icon: HiMegaphone },
    { name: t('nav_voting'), path: '/admin/voting', icon: HiChartBarSquare },
    { name: t('nav_complaints'), path: '/admin/complaints', icon: HiChatBubbleLeftRight },
    { name: t('nav_events'), path: '/admin/events', icon: HiCalendarDays },
    { name: t('nav_profile'), path: '/admin/profile', icon: HiUserCircle },
  ];

  const memberLinks = [
    { name: t('nav_dashboard'), path: '/member/dashboard', icon: HiSquares2X2 },
    { name: t('nav_events'), path: '/member/events', icon: HiCalendarDays },
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
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
              LA
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Association MS</h2>
              <span className="text-[10px] text-slate-400 capitalize block -mt-0.5">
                {user?.role?.replace('_', ' ') || 'Community'}
              </span>
            </div>
          </div>

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
            <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-xs">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
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
    </>
  );
}
