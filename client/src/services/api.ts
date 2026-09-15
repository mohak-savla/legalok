import axios from 'axios';

export const TOKEN_KEY = 'legalok.at';
export const REFRESH_KEY = 'legalok.rt';
export const USER_KEY = 'legalok.user';

/** API base: same-origin '/api' in dev (vite proxy) or VITE_API_BASE_URL in production. */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config ?? {};
    const url: string = original.url ?? '';
    if (err.response?.status === 401 && !original._retry && !url.includes('/auth/')) {
      original._retry = true;
      refreshing = refreshing ?? (async () => {
        try {
          const rt = localStorage.getItem(REFRESH_KEY);
          if (!rt) return null;
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: rt });
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          localStorage.setItem(REFRESH_KEY, data.refreshToken);
          return data.accessToken as string;
        } catch {
          return null;
        } finally {
          setTimeout(() => { refreshing = null; }, 0);
        }
      })();
      const token = await refreshing;
      if (token) {
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api(original);
      }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export function getErrorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { error?: string; missing?: string[] } | undefined;
    if (data?.missing?.length) return `${data.error ?? 'Missing'}: ${data.missing.join(', ')}`;
    return data?.error ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

export const setSession = (access: string, refresh: string): void => {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
};
export const clearSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};
export const getAccess = (): string | null => localStorage.getItem(TOKEN_KEY);

/** Exchange a verified social sign-in (Supabase access token) for a Legalok session. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const oauthLogin = async (provider: 'google' | 'facebook', accessToken: string): Promise<any> => {
  const { data } = await api.post('/auth/oauth', { provider, accessToken });
  return data;
};

export default api;
