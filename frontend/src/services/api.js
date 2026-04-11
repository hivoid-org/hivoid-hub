import axios from 'axios';

// In dev: Vite proxies /api → http://127.0.0.1:8000  (configured in vite.config.js)
// In prod: Nginx serves the SPA and proxies /api → uvicorn (configured in install.sh)
// Override with VITE_API_URL env var if needed (e.g. external backend host)
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';


const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ─── Request Interceptor: attach JWT token ────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hivoid_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: auto-logout on 401 ─────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
       // Don't redirect if we are already attempting to login
       const isAuthRequest = error.config?.url?.includes('/auth/login') || 
                             error.config?.url?.includes('/auth/webauthn/login') ||
                             error.config?.url?.includes('/auth/login-telegram-only');
                             
       if (!isAuthRequest) {
          localStorage.removeItem('hivoid_token');
          localStorage.removeItem('hivoid_user');
          // Avoid loop if already at login
          if (!window.location.search.includes('no-redirect')) {
             window.location.href = '/login';
          }
       }
    }
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const API = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (username, password, otp_code = null) => {
    return apiClient.post('/auth/login', { username, password, otp_code });
  },
  loginTelegramOnly: (username) => {
    return apiClient.post('/auth/login-telegram-only', { username });
  },
  checkTelegramApproval: (tx_id) => apiClient.get(`/auth/telegram-approval/${tx_id}`),
  logout: () => apiClient.post('/auth/logout'),
  setupAdmin: (username, password) =>
    apiClient.post('/auth/setup', { username, password }),
  getLoginPath: () => apiClient.get('/auth/login-path'),
  getPublicInfo: () => apiClient.get('/auth/public-info'),
  getSessions: () => apiClient.get('/auth/sessions'),
  revokeSession: (sid) => apiClient.delete(`/auth/sessions/${sid}`),
  getAuditLogs: (limit = 100) => apiClient.get(`/auth/audit-logs?limit=${limit}`),
  getMe: () => apiClient.get('/auth/me'),
  unlock: (password) => apiClient.post('/auth/unlock', { password }),
  updateProfile: (new_username) => apiClient.put('/auth/profile', { new_username }),
  updatePassword: (current_password, new_password) =>
    apiClient.put('/auth/password', { current_password, new_password }),
  setup2FA: () => apiClient.get('/auth/2fa/setup'),
  enable2FA: (code, secret) => apiClient.post('/auth/2fa/enable', { code, secret }),
  disable2FA: () => apiClient.delete('/auth/2fa/disable'),
  getHubToken: () => apiClient.get('/auth/hub-token'),
  getHubConfig: () => apiClient.get('/auth/hub-config'),
  updateHubConfig: (config) => apiClient.put('/auth/hub-config', config),
  testTelegram: () => apiClient.post('/auth/test-telegram'),
  
  // ── WebAuthn (Passkeys) ───────────────────────────────────────────────────
  webauthnRegisterOptions: () => apiClient.post('/auth/webauthn/register/options'),
  webauthnRegisterVerify: (response) => apiClient.post('/auth/webauthn/register/verify', { response }),
  webauthnLoginOptions: (username) => apiClient.post('/auth/webauthn/login/options', { username }),
  webauthnLoginVerify: (username, response) => apiClient.post('/auth/webauthn/login/verify', { username, response }),
  deletePasskey: (cred_id) => apiClient.delete(`/auth/webauthn/credentials/${cred_id}`),

  // ── Users ─────────────────────────────────────────────────────────────────
  getUsers:   ()         => apiClient.get('/users/'),
  createUser: (userData) => apiClient.post('/users/', userData),
  updateUser: (uuid, userData) => apiClient.put(`/users/${uuid}`, userData),
  deleteUser: (uuid)     => apiClient.delete(`/users/${uuid}`),
  deleteUserPermanent: (uuid) => apiClient.delete(`/users/${uuid}/permanent`),
  revokeUser: (uuid)     => apiClient.post(`/users/${uuid}/revoke`),
  resetTraffic: (uuid)   => apiClient.post(`/users/${uuid}/reset-traffic`),

  // ── Nodes ─────────────────────────────────────────────────────────────────
  getActiveNodes: () => apiClient.get('/node/'),
  updateNode: (nodeId, nodeData) => apiClient.put(`/node/${nodeId}`, nodeData),
  installNodeTls: (nodeId, payload) => apiClient.post(`/node/${nodeId}/tls/install`, payload),
  syncNodeTlsPaths: (nodeId) => apiClient.post(`/node/${nodeId}/tls/sync-paths`),
  installNodeGeodata: (nodeId, payload) => apiClient.post(`/node/${nodeId}/geodata/install`, payload),
  deleteNode: (nodeId) => apiClient.delete(`/node/${nodeId}`),
  removeNode: (nodeId) => apiClient.delete(`/node/${nodeId}/remove`),
  shockAllNodes: () => apiClient.post('/node/shock'),
  forceSyncAll:  () => apiClient.post('/node/sync'),

  // ── Stats ─────────────────────────────────────────────────────────────────
  getGlobalStats: () => apiClient.get('/stats/global'),
  getDashboardInsights: () => apiClient.get('/stats/insights'),
  acknowledgeDashboardAlert: (alertId) => apiClient.post(`/stats/alerts/${alertId}/ack`),
  getConnectedUsers: () => apiClient.get('/sessions/connected-users'),

  // ── Public ────────────────────────────────────────────────────────────────
  getSubInfo: (uuid) => apiClient.get(`/sub/${uuid}`),

  // ── GeoIP ─────────────────────────────────────────────────────────────────
  getHubLocation: () => apiClient.get('/geoip/hub'),
  getIPLocation: (ip) => apiClient.get(`/geoip/lookup?ip=${ip}`),
  batchIPLocation: (ips) => apiClient.post('/geoip/batch-lookup', ips),
};

export default API;
