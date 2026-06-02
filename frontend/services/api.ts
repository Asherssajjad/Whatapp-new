import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export const api = axios.create({ baseURL: API_URL, withCredentials: true });

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const original = err.config as typeof err.config & { _retry?: boolean };
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const rt = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      if (rt) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: rt });
          localStorage.setItem('token', data.token as string);
          original.headers!['Authorization'] = `Bearer ${data.token as string}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

// Typed helpers
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),
};

export const contactsApi = {
  list: (params?: Record<string, unknown>) => api.get('/contacts', { params }),
  get: (phone: string) => api.get(`/contacts/${encodeURIComponent(phone)}`),
  update: (phone: string, data: Record<string, unknown>) => api.put(`/contacts/${encodeURIComponent(phone)}`, data),
  delete: (phone: string) => api.delete(`/contacts/${encodeURIComponent(phone)}`),
  messages: (phone: string, params?: Record<string, unknown>) =>
    api.get(`/contacts/${encodeURIComponent(phone)}/messages`, { params }),
  toggleAI: (phone: string) => api.post(`/contacts/${encodeURIComponent(phone)}/toggle-ai`),
};

export const messagesApi = {
  send: (phone: string, message: string) => api.post('/messages/send', { phone, message }),
};

export const analyticsApi = {
  get: () => api.get('/analytics'),
  handoffs: () => api.get('/handoffs'),
};

export const knowledgeApi = {
  list: (params?: Record<string, unknown>) => api.get('/knowledge', { params }),
  ingestUrl: (url: string, title?: string, category?: string, crawlSite?: boolean) =>
    api.post('/knowledge/url', { url, title, category, crawlSite }),
  ingestManual: (title: string, content: string, category?: string) =>
    api.post('/knowledge/manual', { title, content, category }),
  delete: (id: string) => api.delete(`/knowledge/${id}`),
  toggle: (id: string) => api.patch(`/knowledge/${id}/toggle`),
};

export const numbersApi = {
  list: () => api.get('/numbers'),
  add: (data: Record<string, unknown>) => api.post('/numbers', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/numbers/${id}`, data),
  setPrimary: (id: string) => api.patch(`/numbers/${id}/primary`),
  delete: (id: string) => api.delete(`/numbers/${id}`),
};

export const automationsApi = {
  list: () => api.get('/automations'),
  create: (data: Record<string, unknown>) => api.post('/automations', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/automations/${id}`, data),
  delete: (id: string) => api.delete(`/automations/${id}`),
};

export const campaignsApi = {
  list: () => api.get('/campaigns'),
  create: (data: Record<string, unknown>) => api.post('/campaigns', data),
  launch: (id: string) => api.post(`/campaigns/${id}/launch`),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
};

export const agentsApi = {
  list: () => api.get('/agents'),
  add: (name: string, phone: string) => api.post('/agents', { name, phone }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/agents/${id}`, data),
  delete: (id: string) => api.delete(`/agents/${id}`),
};
