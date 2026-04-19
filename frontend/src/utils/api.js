import axios from 'axios';

const buildBaseUrl = () => {
  const raw = (import.meta.env.VITE_API_URL || '').trim();
  if (!raw) return '/api';

  const normalized = raw.replace(/\/+$/, '');
  if (normalized.endsWith('/api')) return normalized;
  return `${normalized}/api`;
};

const BASE_URL = buildBaseUrl();

const api = axios.create({ baseURL: BASE_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pb_token');
      localStorage.removeItem('pb_user');
      window.location.assign('/#/login');
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  register: (d) => api.post('/auth/register', d),
  login:    (d) => api.post('/auth/login', d),
  getMe:    ()  => api.get('/auth/me'),
};

export const serverAPI = {
  list:         ()         => api.get('/servers'),
  get:          (id)       => api.get(`/servers/${id}`),
  create:       (data)     => api.post('/servers', data),
  update:       (id, data) => api.put(`/servers/${id}`, data),
  remove:       (id)       => api.delete(`/servers/${id}`),
  refresh:      (id)       => api.post(`/servers/${id}/refresh`),
  proStats:     (id)       => api.get(`/servers/${id}/pro-stats`),
  uptime:       (id)       => api.get(`/servers/${id}/uptime`),
  agentSetup:   (id)       => api.get(`/servers/${id}/agent-setup`),
  validateHetzner: (apiKey) => api.post('/servers/provider/hetzner/validate', { apiKey }),
};

export const paymentAPI = {
  checkout:       (plan)      => api.post('/payments/checkout', { plan }),
  portal:         ()          => api.post('/payments/portal'),
  confirmSession: (sessionId) => api.post('/payments/confirm-session', { sessionId }),
};

export const systemAPI = {
  health: (config = {}) => api.get('/health', config),
};

export default api;
