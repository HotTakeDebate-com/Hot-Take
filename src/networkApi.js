import { auth } from './firebase.js';

async function networkRequest(path, options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Sign-in required.');
  const response = await fetch('/api/network' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The debate network request failed.');
  return body;
}

export const networkMe = () => networkRequest('/me');
export const networkIdentity = (uid) => networkRequest('/identity/' + encodeURIComponent(uid));
export const networkFollowStatus = (uid) => networkRequest('/follow/' + encodeURIComponent(uid));
export const networkFollow = (uid) => networkRequest('/follow/' + encodeURIComponent(uid), { method: 'POST' });
export const networkUnfollow = (uid) => networkRequest('/follow/' + encodeURIComponent(uid), { method: 'DELETE' });
export const networkDirectMessages = (uid) => networkRequest('/messages/' + encodeURIComponent(uid));
export const networkSendDirectMessage = (uid, text) => networkRequest('/messages/' + encodeURIComponent(uid), { method: 'POST', body: JSON.stringify({ text }) });
export const networkNotifications = () => networkRequest('/notifications');
export const networkReadNotification = (id) => networkRequest('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' });
export const networkNotificationPreferences = (preferences) => networkRequest('/notification-preferences', { method: 'POST', body: JSON.stringify(preferences) });
export const networkApplyForVerification = (application) => networkRequest('/verification-applications', { method: 'POST', body: JSON.stringify(application) });

