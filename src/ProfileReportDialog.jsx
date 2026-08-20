import { useState } from 'react';
import { submitReport } from './chitChatFirestore.js';

const PROFILE_REPORT_REASONS = [
  { id: 'profile_picture', label: 'Inappropriate profile picture', category: 'other' },
  { id: 'bio', label: 'Slurs or abusive content in bio', category: 'harassment' },
  { id: 'display_name', label: 'Inappropriate display name', category: 'harassment' },
  { id: 'impersonation', label: 'Impersonation or misleading identity', category: 'other' },
  { id: 'harassment', label: 'Harassment or targeted abuse', category: 'harassment' },
  { id: 'other', label: 'Other profile concern', category: 'other' },
];

export default function ProfileReportDialog({ open, onClose, profile }) {
  const [reasonId, setReasonId] = useState('profile_picture');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  if (!open) return null;

  const close = () => {
    if (busy) return;
    setReasonId('profile_picture');
    setDetails('');
    setError('');
    setDone(false);
    onClose();
  };

  const send = async (event) => {
    event.preventDefault();
    const reason = PROFILE_REPORT_REASONS.find((item) => item.id === reasonId) || PROFILE_REPORT_REASONS.at(-1);
    setBusy(true);
    setError('');
    try {
      await submitReport({
        topicId: 'profile',
        roomId: null,
        yourSide: 'agree',
        category: reason.category,
        details: `[Profile report: ${reason.label}]\n${details.trim()}`,
        peerUid: profile.uid,
        reportContext: 'profile',
        profileSnapshot: { displayName: profile.displayName, bio: profile.bio, avatarUrl: profile.avatarUrl },
      });
      setDone(true);
    } catch (submitError) {
      setError(submitError?.message || 'Could not send this profile report.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="report-modal-overlay profile-report-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="report-modal panel profile-report-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-report-title">
      <button type="button" className="profile-report-close" onClick={close} disabled={busy} aria-label="Close report form">×</button>
      <p className="profile-report-eyebrow">Community safety</p>
      <h2 id="profile-report-title" className="report-modal-title">{done ? 'Report sent' : `Report ${profile.displayName || 'this profile'}`}</h2>
      {done ? <><p className="report-modal-success" role="status">Thanks. The moderation team will review this profile.</p><div className="report-modal-actions"><button type="button" className="btn btn-primary" onClick={close}>Close</button></div></> : <>
        <p className="report-modal-lead">Tell the moderation team what part of this profile violates the Community Guidelines.</p>
        <form className="report-modal-form" onSubmit={send}>
          <label className="report-modal-label" htmlFor="profile-report-reason">What are you reporting?</label>
          <select id="profile-report-reason" className="report-modal-select" value={reasonId} onChange={(event) => setReasonId(event.target.value)}>{PROFILE_REPORT_REASONS.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</select>
          <label className="report-modal-label" htmlFor="profile-report-details">Additional details</label>
          <textarea id="profile-report-details" className="report-modal-textarea" rows="4" maxLength="1800" value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what staff should review…" required />
          {error && <div className="error-banner" role="alert">{error}</div>}
          <div className="report-modal-actions"><button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button></div>
        </form>
      </>}
    </section>
  </div>;
}
