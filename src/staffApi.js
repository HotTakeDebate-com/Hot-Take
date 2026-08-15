import { auth } from './firebase.js';

async function request(path, options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Sign-in required.');
  const response = await fetch('/api/staff' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Staff request failed.');
  return body;
}
export const staffMe = () => request('/me');
export const staffUsers = () => request('/users?limit=500');
export const staffReports = () => request('/reports');
export const staffDeleteReport = (id) => request('/reports/' + encodeURIComponent(id), { method: 'DELETE' });
export const staffAudit = () => request('/audit');
export const staffPunishments = () => request('/punishments');
export const staffRespond = (id, response, status) => request('/reports/' + encodeURIComponent(id) + '/respond', { method: 'POST', body: JSON.stringify({ response, status }) });
export const staffAction = (uid, action, reason, durationMinutes = null) => request('/users/' + encodeURIComponent(uid) + '/action', { method: 'POST', body: JSON.stringify({ action, reason, durationMinutes }) });
export const staffRole = (uid, role, premium) => request('/users/' + encodeURIComponent(uid) + '/role', { method: 'POST', body: JSON.stringify({ role, premium }) });

export const staffPermissions = () => request('/permissions');
export const staffSetPermission = (role, permission, enabled) => request('/permissions', { method: 'POST', body: JSON.stringify({ role, permission, enabled }) });

export const staffUpdateUser = (uid, updates) => request('/users/' + encodeURIComponent(uid) + '/update', { method: 'POST', body: JSON.stringify(updates) });

export const staffSetPassword = (uid, password) => request('/users/' + encodeURIComponent(uid) + '/password', { method: 'POST', body: JSON.stringify({ password }) });

export const staffNews = () => request('/news');
export const staffSaveNews = (story) => story.id
  ? request('/news/' + encodeURIComponent(story.id), { method: 'POST', body: JSON.stringify(story) })
  : request('/news', { method: 'POST', body: JSON.stringify(story) });
