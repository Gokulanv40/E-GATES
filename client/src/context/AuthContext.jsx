import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('association_user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('association_token') || null;
  });

  const [loading, setLoading] = useState(true);

  // Validate session on mount via refresh-token
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('association_token');
      const refreshToken = localStorage.getItem('association_refresh_token');

      if (!storedToken || !refreshToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api.post('/auth/refresh-token', { refreshToken });
        const resData = response.data.data || response.data;
        const newToken = resData.token || resData.accessToken || storedToken;
        const newUser = resData.user || user;

        if (isMounted) {
          setToken(newToken);
          localStorage.setItem('association_token', newToken);

          if (resData.refreshToken) {
            localStorage.setItem('association_refresh_token', resData.refreshToken);
          }

          if (newUser) {
            setUser(newUser);
            localStorage.setItem('association_user', JSON.stringify(newUser));
          }
        }
      } catch (err) {
        console.warn('Initial session validation failed:', err?.message);
        if (isMounted) {
          localStorage.removeItem('association_token');
          localStorage.removeItem('association_refresh_token');
          localStorage.removeItem('association_user');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/login', credentials);
      const resData = response.data.data || response.data;

      const accessToken = resData.token || resData.accessToken;
      const refreshToken = resData.refreshToken;
      const loggedUser = resData.user;

      if (!accessToken || !loggedUser) {
        throw new Error(response.data.message || 'Login failed. Invalid response from server.');
      }

      setToken(accessToken);
      setUser(loggedUser);

      localStorage.setItem('association_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('association_refresh_token', refreshToken);
      }
      localStorage.setItem('association_user', JSON.stringify(loggedUser));

      toast.success(response.data.message || `Welcome back, ${loggedUser.name}!`);
      return { success: true, user: loggedUser, token: accessToken };
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Unable to log in. Please check your credentials.';
      toast.error(errMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    try {
      setLoading(true);
      // FormData handled by axios interceptor
      const response = await api.post('/auth/register', formData);
      const msg = response.data?.message || 'Registration submitted. Awaiting approval.';
      toast.success(msg);
      return response.data;
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Registration failed. Please check form fields.';
      toast.error(errMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const registerAssociationAdmin = async (formData) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/register-association-admin', formData);
      const msg = response.data?.message || 'Association and Administrator registered successfully!';
      toast.success(msg);
      return response.data;
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Association registration failed.';
      toast.error(errMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem('association_refresh_token');
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } catch (err) {
      console.warn('Logout endpoint error:', err);
    } finally {
      localStorage.removeItem('association_token');
      localStorage.removeItem('association_refresh_token');
      localStorage.removeItem('association_user');
      setUser(null);
      setToken(null);
      toast.success('Logged out successfully');
    }
  }, []);

  const updateUser = (data) => {
    setUser((prev) => {
      const updated = { ...prev, ...data };
      localStorage.setItem('association_user', JSON.stringify(updated));
      return updated;
    });
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    registerAssociationAdmin,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
