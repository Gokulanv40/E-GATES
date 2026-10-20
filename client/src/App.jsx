import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';

// Auth Pages (Eagerly or Lazily loaded)
const Login = lazy(() => import('./pages/auth/Login'));
const Register = lazy(() => import('./pages/auth/Register'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));

// Super Admin Pages
const Associations = lazy(() => import('./pages/super-admin/Associations'));
const PendingApprovals = lazy(() => import('./pages/super-admin/PendingApprovals'));
const ManageUsers = lazy(() => import('./pages/super-admin/ManageUsers'));
const PollResults = lazy(() => import('./pages/super-admin/PollResults'));
const SOSReports = lazy(() => import('./pages/super-admin/SOSReports'));
const AuditLog = lazy(() => import('./pages/super-admin/AuditLog'));

// Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminManageUsers = lazy(() => import('./pages/admin/ManageUsers'));
const Members = lazy(() => import('./pages/admin/Members'));
const SOSContacts = lazy(() => import('./pages/admin/SOSContacts'));
const SOSAlerts = lazy(() => import('./pages/admin/SOSAlerts'));
const NewsManage = lazy(() => import('./pages/admin/NewsManage'));
const VotingManage = lazy(() => import('./pages/admin/VotingManage'));
const AdminComplaints = lazy(() => import('./pages/admin/AdminComplaints'));
const AdminMaintenance = lazy(() => import('./pages/admin/AdminMaintenance'));
const Events = lazy(() => import('./pages/admin/Events'));
const Documents = lazy(() => import('./pages/admin/Documents'));

// Member Pages
const MemberDashboard = lazy(() => import('./pages/member/Dashboard'));
const NewsFeed = lazy(() => import('./pages/member/NewsFeed'));
const VotingPage = lazy(() => import('./pages/member/VotingPage'));
const MemberComplaints = lazy(() => import('./pages/member/Complaints'));
const Profile = lazy(() => import('./pages/member/Profile'));

// Home Redirect Component
function RootRedirect() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen message="Loading portal session..." />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'super_admin') {
    return <Navigate to="/super-admin/dashboard" replace />;
  } else if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else {
    return <Navigate to="/member/dashboard" replace />;
  }
}

// 404 Page Component
function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-between p-6">
      <div />
      <div className="text-center max-w-md">
        <h1 className="text-7xl font-black text-primary-500 mb-2">404</h1>
        <h2 className="text-2xl font-bold mb-3">Page Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">
          The requested page or resource could not be found. Please return to the homepage or login portal.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-xl transition shadow-lg"
        >
          Return to Dashboard
        </Link>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen message="Loading page..." />}>
      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Root Redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Super Admin Protected Routes */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <SocketProvider>
                <DashboardLayout />
              </SocketProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="associations" element={<Associations />} />
          <Route path="approvals" element={<PendingApprovals />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="events" element={<Events />} />
          <Route path="polls" element={<PollResults />} />
          <Route path="sos-reports" element={<SOSReports />} />
          <Route path="audit-log" element={<AuditLog />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SocketProvider>
                <DashboardLayout />
              </SocketProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="approvals" element={<PendingApprovals />} />
          <Route path="users" element={<AdminManageUsers />} />
          <Route path="members" element={<Members />} />
          <Route path="sos-contacts" element={<SOSContacts />} />
          <Route path="sos-alerts" element={<SOSAlerts />} />
          <Route path="news" element={<NewsManage />} />
          <Route path="voting" element={<VotingManage />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="maintenance" element={<AdminMaintenance />} />
          <Route path="events" element={<Events />} />
          <Route path="documents" element={<Documents />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Member Protected Routes */}
        <Route
          path="/member"
          element={
            <ProtectedRoute allowedRoles={['member']}>
              <SocketProvider>
                <DashboardLayout />
              </SocketProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MemberDashboard />} />
          <Route path="events" element={<Events />} />
          <Route path="news" element={<NewsFeed />} />
          <Route path="voting" element={<VotingPage />} />
          <Route path="complaints" element={<MemberComplaints />} />
          <Route path="profile" element={<Profile />} />
          <Route path="maintenance" element={<Navigate to="/member/dashboard" replace />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* 404 Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
