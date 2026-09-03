import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export { API_BASE_URL };

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Send/accept cookies on cross-origin API calls so the backend's HttpOnly
  // refresh cookie (the primary session mechanism) is stored and returned.
  withCredentials: true,
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

// Response interceptor: transparently renew an expired access token.
//
// The refresh token normally lives in an HttpOnly cookie (never exposed to
// JS); a localStorage copy is kept purely as a fallback for environments
// where cookies are unavailable. On a 401 we hit /auth/refresh once, store
// the new access token and replay the original request. We intentionally do
// NOT hard-redirect to /login any more: a failed refresh only clears the
// stored token and lets ProtectedRoute handle navigation, so users aren't
// yanked out of the app on a transient failure.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      const newToken = await silentRefresh();
      if (newToken) {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
      // Session is really gone (explicit logout or 30 days of inactivity).
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }

    return Promise.reject(error);
  }
);

/**
 * Renew the access token using the HttpOnly refresh cookie, falling back to
 * the stored refresh token for cookie-less environments. Resolves with the
 * new access token, or null when the session is really gone.
 */
export async function silentRefresh() {
  try {
    const stored = localStorage.getItem('refresh_token');
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      stored ? { refresh_token: stored } : {},
      { withCredentials: true }
    );
    const { access_token, refresh_token } = response.data;
    if (access_token) localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    return access_token || null;
  } catch {
    return null;
  }
}

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
  delete: (reportId) => api.delete(`/reports/${reportId}`),
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
          credentials: 'include',
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
  // Actively pulls the account's subscription from Stripe so a finished
  // payment is reflected immediately — no waiting on the async webhook.
  syncSubscription: () => api.post('/billing/sync'),
};

// Audit trail APIs — the confirmation log of every recorded create/update/
// delete/send action, newest first (see Settings → Activity).
export const auditAPI = {
  list: (params) => api.get('/audit-logs', { params }),
};

export default api;
