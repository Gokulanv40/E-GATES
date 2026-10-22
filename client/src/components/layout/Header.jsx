import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiBars3,
  HiBell,
  HiArrowRightOnRectangle,
  HiUser,
  HiChevronDown,
  HiCheckBadge,
  HiIdentification,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import ThemeToggle from '../common/ThemeToggle';
import PoweredByLogo from '../common/PoweredByLogo';
import DigitalIdCardModal from '../common/DigitalIdCardModal';
import api from '../../services/api';

export default function Header({ onMenuToggle, associationName }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [showIdCard, setShowIdCard] = useState(false);

  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch unread count & recent notifications
  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      try {
        const countRes = await api.get('/notifications/unread-count');
        if (isMounted) {
          setUnreadCount(countRes.data?.data?.count ?? countRes.data?.count ?? 0);
        }
      } catch (err) {
        // Silently catch in dev or if notifications route not yet ready
      }
    };

    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 45000);
      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [user]);

  const loadRecentNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data?.data?.slice(0, 5) || res.data?.slice(0, 5) || []);
    } catch (err) {
      // Ignored
    }
  };

  const toggleNotifDropdown = () => {
    if (!notifDropdownOpen) {
      loadRecentNotifications();
    }
    setNotifDropdownOpen(!notifDropdownOpen);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determine displayed association title
  const displayedTitle =
    associationName ||
    user?.association_name ||
    (user?.role === 'super_admin'
      ? 'EGATES Master Super Admin Portal'
      : 'EGATES Community');

  const resolveFileUrl = (filePath) => {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) return filePath;
    const base = (typeof window !== 'undefined' && window.location.origin)
      ? window.location.origin
      : (import.meta.env.VITE_API_URL || 'http://localhost:5002').replace(/\/api\/v1\/?$/, '');
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

  const getProfilePath = () => {
    if (user?.role === 'super_admin') return '/super-admin/profile';
    if (user?.role === 'admin') return '/admin/profile';
    return '/member/profile';
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm min-h-[3.75rem] sm:min-h-[5rem] py-1.5 sm:py-2 flex items-center justify-between px-2.5 sm:px-6 transition-colors duration-200">
      {/* Left: Mobile Hamburger & Logo Branding */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 sm:p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 focus:outline-none transition"
          aria-label="Open sidebar menu"
        >
          <HiBars3 className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <button
          type="button"
          onClick={() => setShowIdCard(true)}
          title="Click to view Digital ID Card"
          className="flex items-center hover:opacity-90 transition focus:outline-none cursor-pointer group py-0.5"
        >
          <img
            src="/egates-logo.png"
            alt="EGATES"
            className="h-9 sm:h-11 w-auto max-w-[160px] sm:max-w-[195px] object-contain rounded-xl bg-white/95 p-1 shadow-xs group-hover:scale-105 transition"
          />
        </button>
      </div>

      {/* Top Center: Powered by Logo & Association Name */}
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center px-1.5 sm:px-3 mx-auto">
        <PoweredByLogo size="md" className="hidden sm:inline-flex mb-1" />
        <h1
          className="text-xs sm:text-sm font-extrabold text-gray-800 dark:text-gray-100 truncate text-center max-w-full"
          title={displayedTitle}
        >
          {displayedTitle}
        </h1>
        {user?.door_no && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 hidden lg:block">
            Door #{user.door_no} • {user.layout_name || 'Resident'}
          </p>
        )}
      </div>

      {/* Right: Actions, Theme, Language, Notifications, User Menu */}
      <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
        {/* Dark / Light Theme Switcher */}
        <ThemeToggle />


        {/* Notification Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            type="button"
            onClick={toggleNotifDropdown}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition focus:outline-none"
            aria-label="View notifications"
          >
            <HiBell className="w-5 h-5 sm:w-6 sm:h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-800 py-2 z-50 overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('notifications_title')}</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-medium px-2 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">
                    {t('notifications_empty')}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 text-xs hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer ${
                        !notif.is_read ? 'bg-blue-50/40 dark:bg-blue-950/20 font-medium' : ''
                      }`}
                    >
                      <p className="text-gray-900 dark:text-gray-100 font-semibold">{notif.title}</p>
                      <p className="text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">{notif.message}</p>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar & Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs ring-2 ring-primary-500/20 flex-shrink-0">
              {user?.profile_photo ? (
                <img
                  src={resolveFileUrl(user.profile_photo)}
                  alt={user?.name || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'
              )}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight truncate max-w-[100px]">
                {user?.name || 'User'}
              </span>
              <span className="text-[10px] text-gray-400 capitalize">
                {user?.is_main_admin
                  ? 'Main Association Admin'
                  : (user?.role === 'admin'
                    ? 'Layout Admin'
                    : (user?.role?.replace('_', ' ') || 'Resident'))}
              </span>
            </div>
            <HiChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
          </button>

          {/* User Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-800 py-1.5 z-50">
              <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center font-bold text-xs ring-2 ring-primary-500/20 flex-shrink-0">
                    {user?.profile_photo ? (
                      <img
                        src={resolveFileUrl(user.profile_photo)}
                        alt={user?.name || 'User'}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user?.email || user?.phone}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <HiCheckBadge className="w-3.5 h-3.5" />
                  <span className="capitalize">
                    {user?.is_main_admin
                      ? 'Main Association Admin'
                      : (user?.role === 'admin'
                        ? 'Layout Admin'
                        : (user?.role?.replace('_', ' ')))}
                  </span>
                  {user?.member_code && (
                    <span className="text-gray-400 font-mono">#{user.member_code}</span>
                  )}
                </div>
              </div>

              <div className="py-1">
                <Link
                  to={getProfilePath()}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                >
                  <HiUser className="w-4 h-4 text-gray-400" />
                  <span>{t('nav_profile')}</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    setShowIdCard(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition text-left"
                >
                  <HiIdentification className="w-4 h-4 text-primary-500" />
                  <span>Digital ID Card</span>
                </button>
              </div>

              <div className="border-t border-gray-100 dark:border-slate-800 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition text-left"
                >
                  <HiArrowRightOnRectangle className="w-4 h-4 text-red-500" />
                  <span>{t('auth_logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Digital ID Card Modal */}
      {showIdCard && (
        <DigitalIdCardModal
          isOpen={showIdCard}
          onClose={() => setShowIdCard(false)}
          user={user}
          associationName={displayedTitle}
        />
      )}
    </header>
  );
}
