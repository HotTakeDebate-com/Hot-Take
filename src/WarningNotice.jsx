import { useCallback, useEffect, useState } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from './firebase.js';

async function warningRequest(path, options = {}) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) return null;
  const response = await fetch('/api/warnings' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not load warnings.');
  return body;
}

function roleName(role) {
  const value = String(role || 'moderator').toLowerCase();
  if (value === 'owner') return 'Owner';
  if (value === 'admin') return 'Admin';
  return 'Moderator';
}

export default function WarningNotice() {
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadWarnings = useCallback(async () => {
    if (!auth?.currentUser) { setWarnings([]); return; }
    try {
      const result = await warningRequest('/');
      setWarnings(result?.warnings || []);
    } catch {
      // A warning fetch should never interrupt the rest of the site.
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (user) loadWarnings();
      else setWarnings([]);
    });
    const timer = window.setInterval(loadWarnings, 10000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [loadWarnings]);

  const warning = warnings[0];
  if (!warning) return null;

  const acknowledge = async () => {
    setBusy(true);
    try {
      await warningRequest('/' + encodeURIComponent(warning.id) + '/acknowledge', { method: 'POST' });
      setWarnings((current) => current.filter((item) => item.id !== warning.id));
    } finally {
      setBusy(false);
    }
  };

  return <aside className="user-warning-notice" role="alert" aria-live="assertive">
    <div className="user-warning-icon">!</div>
    <div className="user-warning-copy">
      <strong>Account warning</strong>
      <p>You have received a warning for {warning.reason || 'a violation of the community guidelines'}.</p>
      <p>Warned by {roleName(warning.issuedByRole)}.</p>
      <button type="button" disabled={busy} onClick={acknowledge}>{busy ? 'Saving…' : 'Acknowledged'}</button>
    </div>
  </aside>;
}
