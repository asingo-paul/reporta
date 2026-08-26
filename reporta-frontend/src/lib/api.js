import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
};

// Clients APIs
export const clientsAPI = {
  list: () => api.get('/clients'),
  get: (clientId) => api.get(`/clients/${clientId}`),
  create: (data) => api.post('/clients', data),
  update: (clientId, data) => api.put(`/clients/${clientId}`, data),
  delete: (clientId) => api.delete(`/clients/${clientId}`),
  listConnections: (clientId) => api.get(`/clients/${clientId}/connections`),
  revokeConnection: (clientId, connectionId) => api.delete(`/clients/${clientId}/connections/${connectionId}`),
};

// Reports APIs
export const reportsAPI = {
  list: (clientId) => api.get(`/clients/${clientId}/reports`),
  get: (reportId) => api.get(`/reports/${reportId}`),
  generate: (clientId, data) => api.post(`/clients/${clientId}/reports`, data),
  updateSummary: (reportId, data) => api.patch(`/reports/${reportId}`, data),
  downloadPDF: (reportId) => api.get(`/reports/${reportId}/pdf`, { responseType: 'blob' }),
  send: (reportId, data) => api.post(`/reports/${reportId}/send`, data),
  /**
   * Live Server-Sent Events status stream for a report. The backend emits a
   * JSON payload `{ status, progress_message, error? }` roughly every 1.5s
   * (and once on terminal), so we can show *real* progress rather than a fake
   * timer. Calls `onEvent(payload)` per event and returns a cancel function.
   *
   * Uses `fetch` + manual reader because the endpoint requires an
   * `Authorization` header, which the native `EventSource` API cannot send.
   */
  streamStatus(reportId, { onEvent, onError } = {}) {
    const token = localStorage.getItem('access_token');
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/reports/${reportId}/events`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`status stream returned ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by a blank line; each is a `data: <json>`.
          let sep;
          while ((sep = buffer.indexOf('\n\n')) !== -1) {
            const chunk = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const dataLine = chunk
              .split('\n')
              .find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(5).trim());
              if (payload && typeof payload === 'object') onEvent?.(payload);
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') onError?.(err);
      }
    })();

    return () => controller.abort();
  },
};

// Template APIs
export const templateAPI = {
  get: () => api.get('/template'),
  update: (data) => api.put('/template', data),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('logo', file);
    return api.post('/template/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  // Fetches the agency's uploaded logo as a blob so it can be displayed via
  // URL.createObjectURL. The file lives under the backend's UPLOAD_DIR and is
  // only accessible to the owning user.
  getLogo: (filename) =>
    api.get(`/uploads/${filename}`, { responseType: 'blob' }),
};

// Integrations APIs
export const integrationsAPI = {
  authorize: (provider, clientId) => api.get(`/integrations/${provider}/authorize`, { params: { client_id: clientId } }),
  // Callback is handled by backend redirect
};

// Billing APIs
export const billingAPI = {
  createCheckoutSession: () => api.post('/billing/checkout-session'),
  createPortalSession: () => api.post('/billing/portal'),
  getSubscription: () => api.get('/billing/subscription'),
};

export default api;
