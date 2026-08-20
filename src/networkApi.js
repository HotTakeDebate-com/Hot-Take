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
export const networkUpdatePresencePrivacy = (appearOffline) => networkRequest('/presence-privacy', { method: 'PUT', body: JSON.stringify({ appearOffline }) });
export const networkUpdateProfile = (profile) => networkRequest('/profile', { method: 'PUT', body: JSON.stringify(profile) });
export const networkSearchMembers = (query) => networkRequest('/members/search?q=' + encodeURIComponent(query));
export const networkUpdateDisplayName = (displayName) => networkRequest('/display-name', { method: 'PUT', body: JSON.stringify({ displayName }) });
export const networkIdentity = (uid) => networkRequest('/identity/' + encodeURIComponent(uid));
export const networkFollowStatus = (uid) => networkRequest('/follow/' + encodeURIComponent(uid));
export const networkFollowing = (uid = '') => networkRequest('/following' + (uid ? '/' + encodeURIComponent(uid) : ''));
export const networkFollowers = (uid = '') => networkRequest('/followers' + (uid ? '/' + encodeURIComponent(uid) : ''));
export const networkFollow = (uid) => networkRequest('/follow/' + encodeURIComponent(uid), { method: 'POST' });
export const networkUnfollow = (uid) => networkRequest('/follow/' + encodeURIComponent(uid), { method: 'DELETE' });
export const networkBlockStatus = (uid) => networkRequest('/block/' + encodeURIComponent(uid));
export const networkBlockedAccounts = () => networkRequest('/blocks');
export const networkBlock = (uid) => networkRequest('/block/' + encodeURIComponent(uid), { method: 'POST' });
export const networkUnblock = (uid) => networkRequest('/block/' + encodeURIComponent(uid), { method: 'DELETE' });
export const networkDirectMessages = (uid) => networkRequest('/messages/' + encodeURIComponent(uid));
export const networkDirectConversations = () => networkRequest('/messages');
export const networkSendDirectMessage = (uid, text) => networkRequest('/messages/' + encodeURIComponent(uid), { method: 'POST', body: JSON.stringify({ text }) });
export const networkDecideDirectMessage = (uid, decision) => networkRequest('/messages/' + encodeURIComponent(uid) + '/decision', { method: 'POST', body: JSON.stringify({ decision }) });
export const networkNotifications = () => networkRequest('/notifications');
export const networkReadNotification = (id) => networkRequest('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' });
export const networkNotificationPreferences = (preferences) => networkRequest('/notification-preferences', { method: 'POST', body: JSON.stringify(preferences) });
export const networkApplyForVerification = (application) => networkRequest('/verification-applications', { method: 'POST', body: JSON.stringify(application) });

