import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiHome, HiExclamationTriangle, HiArrowLeft } from 'react-icons/hi2';
import { useAuth } from '../hooks/useAuth';

import PoweredByLogo from '../components/common/PoweredByLogo';

export default function NotFound() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoHome = () => {
    if (!user) {
      navigate('/login');
    } else if (user.role === 'super_admin') {
      navigate('/super-admin/dashboard');
    } else if (user.role === 'admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/member/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between items-center p-6 text-center">
      <div className="pt-4">
        <PoweredByLogo size="lg" />
      </div>

      <div className="max-w-md w-full space-y-6">
        {/* Illustration */}
        <div className="relative mx-auto w-36 h-36 rounded-full bg-blue-50 border-4 border-blue-100 flex items-center justify-center text-primary-600 shadow-inner">
          <HiExclamationTriangle className="w-16 h-16 text-primary-500 animate-bounce" />
          <span className="absolute -bottom-2 bg-primary-600 text-white font-mono font-extrabold text-xs px-3 py-0.5 rounded-full shadow">
            ERROR 404
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            The page or resource you are looking for does not exist, has been relocated, or is temporarily unavailable.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl border border-gray-300 transition"
          >
            <HiArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <button
            onClick={handleGoHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl shadow-md transition"
          >
            <HiHome className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-xs text-gray-400 py-4">
        &copy; {new Date().getFullYear()} Layout Association Management System. All rights reserved.
      </footer>
    </div>
  );
}
