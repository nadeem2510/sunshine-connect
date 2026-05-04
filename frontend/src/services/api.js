import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    if (err.response?.status !== 404) toast.error(msg);
    return Promise.reject(err);
  }
);

// Contacts
export const contactsApi = {
  list: (params) => api.get('/contacts', { params }),
  get: (id) => api.get(`/contacts/${id}`),
  create: (data) => api.post('/contacts', data),
  update: (id, data) => api.put(`/contacts/${id}`, data),
  delete: (id) => api.delete(`/contacts/${id}`),
  upload: (formData) => api.post('/contacts/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  optOut: (id) => api.post(`/contacts/${id}/opt-out`),
  optIn: (id) => api.post(`/contacts/${id}/opt-in`),
  messages: (id) => api.get(`/contacts/${id}/messages`),
};

// Groups
export const groupsApi = {
  list: () => api.get('/groups'),
  get: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  addContacts: (id, contact_ids) => api.post(`/groups/${id}/contacts`, { contact_ids }),
  removeContact: (groupId, contactId) => api.delete(`/groups/${groupId}/contacts/${contactId}`),
};

// Templates
export const templatesApi = {
  list: (params) => api.get('/templates', { params }),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  submitApproval: (id) => api.post(`/templates/${id}/submit-approval`),
  clone: (id) => api.post(`/templates/${id}/clone`),
  preview: (id, variables) => api.post(`/templates/${id}/preview`, { variables }),
};

// Campaigns
export const campaignsApi = {
  list: () => api.get('/campaigns'),
  get: (id) => api.get(`/campaigns/${id}`),
  create: (data) => api.post('/campaigns', data),
  update: (id, data) => api.put(`/campaigns/${id}`, data),
  delete: (id) => api.delete(`/campaigns/${id}`),
  activate: (id) => api.post(`/campaigns/${id}/activate`),
  pause: (id) => api.post(`/campaigns/${id}/pause`),
  resume: (id) => api.post(`/campaigns/${id}/resume`),
  queue: (id) => api.get(`/campaigns/${id}/queue`),
  sendNow: (data) => api.post('/campaigns/send-now', data),
};

// Messages
export const messagesApi = {
  send: (data) => api.post('/messages/send', data),
  logs: (params) => api.get('/messages/logs', { params }),
  stats: (params) => api.get('/messages/stats', { params }),
};

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
  queue: () => api.get('/dashboard/queue'),
  health: () => api.get('/dashboard/health'),
  chart: (params) => api.get('/dashboard/chart', { params }),
};

export default api;
