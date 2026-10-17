import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  HiEye,
  HiEyeSlash,
  HiLockClosed,
  HiUser,
  HiExclamationCircle,
  HiShieldCheck,
  HiBuildingOffice2,
  HiUserGroup,
  HiArrowRight,
  HiCheckCircle,
  HiSparkles,
} from 'react-icons/hi2';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import PoweredByLogo from '../../components/common/PoweredByLogo';

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // 3 Distinct Tabs: 'super_admin' | 'admin' | 'member'
  const [activeTab, setActiveTab] = useState('super_admin');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [roleMismatch, setRoleMismatch] = useState(null);

  // Tab metadata
  const tabs = [
    {
      id: 'super_admin',
      label: 'Super Admin',
      badge: 'Platform Control',
      icon: HiShieldCheck,
      color: 'from-amber-500 to-orange-600',
      activeBorder: 'border-amber-500 text-amber-600',
      activeBg: 'bg-amber-500 text-white',
      accentColor: 'text-amber-500',
      description: 'System-wide oversight across all layout associations',
      defaultEmail: 'superadmin@association.com',
      defaultPass: 'SuperAdmin@123',
    },
    {
      id: 'admin',
      label: 'Admin',
      badge: 'Association Office',
      icon: HiBuildingOffice2,
      color: 'from-blue-600 to-indigo-700',
      activeBorder: 'border-blue-600 text-blue-600',
      activeBg: 'bg-blue-600 text-white',
      accentColor: 'text-blue-600',
      description: 'Manage residents, complaints, news, and polls for assigned layout',
      defaultEmail: 'admin@greenfield.com',
      defaultPass: 'Admin@123',
    },
    {
      id: 'member',
      label: 'User / Member',
      badge: 'Resident Portal',
      icon: HiUserGroup,
      color: 'from-emerald-600 to-teal-700',
      activeBorder: 'border-emerald-600 text-emerald-600',
      activeBg: 'bg-emerald-600 text-white',
      accentColor: 'text-emerald-600',
      description: 'House owners & residents portal with emergency SOS and voting',
      defaultEmail: '',
      defaultPass: '',
    },
  ];

  const currentTabInfo = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setErrorMessage('');
    setRoleMismatch(null);
  };

  const handleQuickAutofill = (tab) => {
    if (tab.defaultEmail) {
      setIdentifier(tab.defaultEmail);
      setPassword(tab.defaultPass || '');
      setErrorMessage('');
      setRoleMismatch(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setRoleMismatch(null);

    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter your email or phone and password.');
      return;
    }

    try {
      setIsLoading(true);
      const isEmail = identifier.includes('@');
      const credentials = {
        [isEmail ? 'email' : 'phone']: identifier.trim(),
        password,
      };

      const result = await login(credentials);
      const user = result.user;

      // Handle pending or rejected accounts gracefully
      if (user.status === 'pending') {
        setErrorMessage('Your account registration is pending administrator approval.');
        setIsLoading(false);
        return;
      }

      if (user.status === 'rejected') {
        setErrorMessage(
          `Your registration was rejected${
            user.rejection_reason ? `: "${user.rejection_reason}"` : '.'
          }`
        );
        setIsLoading(false);
        return;
      }

      // Check for Role Tab Mismatch (e.g. resident trying to login on Super Admin tab)
      if (user.role !== activeTab) {
        const correctTab = tabs.find((t) => t.id === user.role);
        setRoleMismatch({
          userRole: user.role,
          correctTabLabel: correctTab ? correctTab.label : user.role,
          correctTabId: user.role,
          user,
        });
        setIsLoading(false);
        return;
      }

      // Check if there was an original redirect location
      const origin = location.state?.from?.pathname;
      if (origin && !origin.includes('/login')) {
        navigate(origin, { replace: true });
        return;
      }

      // Role-based dashboard redirect
      if (user.role === 'super_admin') {
        navigate('/super-admin/dashboard', { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/member/dashboard', { replace: true });
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Invalid login credentials. Please verify your details.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct switch to correct tab after mismatch
  const handleProceedWithRole = (targetRole) => {
    if (targetRole === 'super_admin') {
      navigate('/super-admin/dashboard', { replace: true });
    } else if (targetRole === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate('/member/dashboard', { replace: true });
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 flex flex-col justify-between p-4 sm:p-6 antialiased">
      <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />
      {/* Top Bar with Top Centre Powered by Logo */}
      <div className="relative z-10 w-full max-w-7xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5 text-white">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">
            LA
          </div>
          <div>
            <span className="font-bold text-base tracking-tight block leading-tight">
              Layout Association
            </span>
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Management Portal
            </span>
          </div>
        </div>

        {/* Top Centre Powered By Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
          <PoweredByLogo size="lg" />
        </div>

        <div className="md:hidden">
          <PoweredByLogo size="md" />
        </div>
      </div>

      {/* Main Login Experience */}
      <div className="relative z-10 w-full max-w-6xl mx-auto my-6 grid lg:grid-cols-[1.05fr_0.95fr] gap-8 items-center">
        <div className="hidden lg:block px-4 xl:px-12 text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-bold text-blue-200">
            <HiSparkles className="h-4 w-4" />
            Built for better communities
          </div>
          <h1 className="mt-6 max-w-xl text-5xl font-black leading-[1.05] tracking-tight">
            One calm place to run your association.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Keep residents informed, handle requests faster, and make every decision more transparent.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
            {[
              'Resident communication',
              'Secure role-based access',
              'Emergency SOS support',
              'Simple community voting',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <HiCheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header Banner */}
          <div className="px-8 pt-8 pb-4 text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              Sign In to Your Account
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
              Select your role below to access your dedicated management portal.
            </p>
          </div>

          {/* 3 DISTINCT ROLE TABS */}
          <div className="px-6 sm:px-8 pt-2">
            <div className="grid grid-cols-3 gap-2 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 py-3 px-2 sm:px-4 rounded-xl text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? `${tab.activeBg} shadow-md shadow-gray-400/20 scale-[1.02]`
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                    }`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-center">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Tab Subtitle Info Banner */}
            <div className="mt-3 py-2 px-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <span className="truncate pr-2">
                📌 <span className="font-semibold">{currentTabInfo.label}:</span>{' '}
                {currentTabInfo.description}
              </span>
              {currentTabInfo.defaultEmail && (
                <button
                  type="button"
                  onClick={() => handleQuickAutofill(currentTabInfo)}
                  className="text-[11px] font-bold text-primary-600 hover:text-primary-700 hover:underline flex-shrink-0"
                >
                  Autofill Demo
                </button>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-8 pt-4">
            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-xs sm:text-sm">
                <HiExclamationCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Role Mismatch Warning Alert */}
            {roleMismatch && (
              <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <HiExclamationCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>Role Mismatch Detected</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  Your credentials belong to a <strong>{roleMismatch.correctTabLabel}</strong>{' '}
                  account, but you are currently on the{' '}
                  <strong>{currentTabInfo.label}</strong> tab.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab(roleMismatch.correctTabId);
                      setRoleMismatch(null);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition"
                  >
                    Switch to {roleMismatch.correctTabLabel} Tab
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProceedWithRole(roleMismatch.userRole)}
                    className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-xs rounded-lg transition flex items-center gap-1"
                  >
                    <span>Proceed to Dashboard</span>
                    <HiArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Identifier Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  {activeTab === 'member'
                    ? 'Resident Email Address or Contact Number'
                    : `${currentTabInfo.label} Email or Phone`}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <HiUser className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      currentTabInfo.defaultEmail || 'e.g. member@layout.com or 9876543210'
                    }
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    {t('auth_password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline"
                  >
                    {t('auth_forgot_password')}
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <HiLockClosed className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    aria-label={showPassword ? t('auth_hide_password') : t('auth_show_password')}
                  >
                    {showPassword ? (
                      <HiEyeSlash className="w-5 h-5" />
                    ) : (
                      <HiEye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full mt-2 py-3.5 px-4 text-white font-bold text-sm rounded-xl shadow-lg transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'super_admin'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                    : activeTab === 'admin'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Signing in as {currentTabInfo.label}...</span>
                  </span>
                ) : (
                  `Sign In as ${currentTabInfo.label}`
                )}
              </button>
            </form>

            {/* Registration Callout for Resident Members */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              {activeTab === 'member' ? (
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-xs text-gray-600 mb-2">
                    Are you a new house owner or resident in this layout?
                  </p>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    <span>Register as New Member</span>
                    <HiArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Resident member?{' '}
                  <button
                    type="button"
                    onClick={() => handleTabChange('member')}
                    className="font-bold text-primary-600 hover:underline"
                  >
                    Switch to User / Member Tab
                  </button>{' '}
                  or{' '}
                  <Link
                    to="/register"
                    className="font-bold text-primary-600 hover:underline"
                  >
                    Register Here
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <footer className="text-center py-2 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Layout Association Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}
