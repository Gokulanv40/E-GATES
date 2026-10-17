import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiEnvelope, HiArrowLeft, HiExclamationCircle, HiCheckCircle } from 'react-icons/hi2';
import { useLanguage } from '../../context/LanguageContext';
import PoweredByLogo from '../../components/common/PoweredByLogo';
import api from '../../services/api';

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/auth/forgot-password', { email: email.trim() });
      setSuccessMessage(
        res.data?.message ||
          'If that email matches an account, we have sent a secure password reset link. Please check your inbox and spam folder.'
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Unable to send reset link. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 antialiased">
      {/* Top Bar with Top Centre Powered by Logo */}
      <div className="relative w-full max-w-7xl mx-auto flex items-center justify-between py-2">
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

      {/* Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 sm:p-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {t('auth_forgot_title')}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {t('auth_forgot_subtitle')}
            </p>
          </div>

          {successMessage ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <HiCheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="text-sm text-emerald-800 leading-relaxed font-medium">
                {successMessage}
              </p>
              <div className="pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-bold text-primary-600 hover:text-primary-700 hover:underline"
                >
                  <HiArrowLeft className="w-4 h-4" />
                  <span>{t('auth_back_to_login')}</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm">
                  <HiExclamationCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
                  {t('auth_email')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <HiEnvelope className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('common_loading') : t('auth_send_reset_link')}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-primary-600 transition"
                >
                  <HiArrowLeft className="w-4 h-4" />
                  <span>{t('auth_back_to_login')}</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-2 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Layout Association Management System. All rights reserved.</p>
      </footer>
    </div>
  );
}
