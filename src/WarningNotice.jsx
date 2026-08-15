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
  const [ban, setBan] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const loadWarnings = useCallback(async () => {
    if (!auth?.currentUser) { setWarnings([]); return; }
    try {
      const [warningResult, banResult] = await Promise.all([
        warningRequest('/'),
        warningRequest('/ban'),
      ]);
      setWarnings(warningResult?.warnings || []);
      setBan(banResult?.active ? banResult : null);
      setNowMs(Date.now());
    } catch {
      // A warning fetch should never interrupt the rest of the site.
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (user) loadWarnings();
      else { setWarnings([]); setBan(null); }
    });
    const pollTimer = window.setInterval(loadWarnings, 10000);
    const minuteTimer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => { unsubscribe(); window.clearInterval(pollTimer); window.clearInterval(minuteTimer); };
  }, [loadWarnings]);

  const warning = warnings[0];
  const isReportResponse = warning?.type === 'report_response';
  const minutesRemaining = ban?.permanent ? null : Math.max(0, Math.ceil((Number(ban?.banUntilMs || 0) - nowMs) / 60_000));
  useEffect(() => {
    if (ban && !ban.permanent && minutesRemaining === 0) {
      loadWarnings().then(() => window.location.reload());
    }
  }, [ban, minutesRemaining, loadWarnings]);

  const acknowledge = async () => {
    setBusy(true);
    try {
      await warningRequest('/' + encodeURIComponent(warning.id) + '/acknowledge', { method: 'POST' });
      setWarnings((current) => current.filter((item) => item.id !== warning.id));
    } finally {
      setBusy(false);
    }
  };

  if (ban) return <div className="user-ban-screen" role="alert" aria-live="assertive">
    <section className="user-ban-card">
      <span className="user-ban-label">{ban.permanent ? 'PERMANENT BAN' : 'TEMPORARY BAN'}</span>
      <h1>Your account is banned.</h1>
      <p className="user-ban-reason">Reason: {ban.reason}</p>
      {!ban.permanent && <div className="user-ban-timer"><strong>{minutesRemaining}</strong><span>minute{minutesRemaining === 1 ? '' : 's'} remaining</span></div>}
      {ban.permanent && <div className="user-ban-timer permanent"><strong>Permanent</strong><span>This ban does not expire automatically.</span></div>}
      <p className="user-ban-issued">Banned by {roleName(ban.issuedByRole)}.</p>
      <small>The countdown updates every minute. Contact support if you believe this was a mistake.</small>
    </section>
  </div>;

  if (!warning) return null;

  return <aside className={'user-warning-notice' + (isReportResponse ? ' report-response' : '')} role="alert" aria-live="assertive">
    <div className="user-warning-icon">{isReportResponse ? '✓' : '!'}</div>
    <div className="user-warning-copy">
      <strong>{isReportResponse ? 'Thanks for your report!' : 'Account warning'}</strong>
      {isReportResponse
        ? <p>{roleName(warning.issuedByRole)} has responded to your report with: “{warning.message}”</p>
        : <><p>You have received a warning for {warning.reason || 'a violation of the community guidelines'}.</p><p>Warned by {roleName(warning.issuedByRole)}.</p></>}
      <button type="button" disabled={busy} onClick={acknowledge}>{busy ? 'Saving…' : isReportResponse ? 'Dismiss' : 'Acknowledged'}</button>
    </div>
  </aside>;
}
