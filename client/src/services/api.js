import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor: Attach JWT Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('association_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If sending FormData, let the browser set Content-Type with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Auto refresh on 401
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If no response (network error / server down)
    if (!error.response) {
      return Promise.reject(
        new Error(error.message || 'Network error occurred. Please check your connection.')
      );
    }

    // Do not attempt refresh on auth endpoints themselves
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh-token');

    if (error.response.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('association_refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('association_token');
        localStorage.removeItem('association_refresh_token');
        localStorage.removeItem('association_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const data = response.data;
        const newToken = data.token || data.data?.token || data.data?.accessToken;

        if (newToken) {
          localStorage.setItem('association_token', newToken);
          if (data.refreshToken || data.data?.refreshToken) {
            localStorage.setItem('association_refresh_token', data.refreshToken || data.data?.refreshToken);
          }

          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(originalRequest);
        } else {
          throw new Error('No new token provided');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('association_token');
        localStorage.removeItem('association_refresh_token');
        localStorage.removeItem('association_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
