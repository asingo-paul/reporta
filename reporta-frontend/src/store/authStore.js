import { create } from 'zustand';
import { authAPI, silentRefresh } from '../lib/api';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const response = await authAPI.login({ email, password });
    const data = response.data;
    
    // Handle both possible response formats
    const access_token = data.access_token;
    const user = data.user;
    
    localStorage.setItem('access_token', access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    
    set({ user, isAuthenticated: true });
    return user;
  },

  signup: async (email, password) => {
    // Extract name from email (before @) as default
    const name = email.split('@')[0];
    const response = await authAPI.signup({ email, password, name });
    const data = response.data;
    
    // Handle both possible response formats
    const access_token = data.access_token;
    const user = data.user;
    
    localStorage.setItem('access_token', access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    
    set({ user, isAuthenticated: true });
    return user;
  },

  logout: async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    let token = localStorage.getItem('access_token');

    // No (or cleared) access token? Try one silent cookie-based refresh
    // before declaring the session dead — this is what makes logins persist
    // for a long time instead of bouncing the user to /login.
    if (!token) {
      token = await silentRefresh();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
    }

    try {
      const response = await authAPI.getMe();
      const user = response.data.user || response.data;
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // The axios interceptor already attempted one refresh+retry; if we
      // still failed, try once more explicitly, then give up.
      const refreshed = await silentRefresh();
      if (refreshed) {
        try {
          const response = await authAPI.getMe();
          const user = response.data.user || response.data;
          set({ user, isAuthenticated: true, isLoading: false });
          return;
        } catch {
          // fall through to logged-out state
        }
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));
