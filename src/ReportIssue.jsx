import { useState } from 'react';
import { submitReport } from './chitChatFirestore.js';

const CATEGORIES = [
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'spam', label: 'Spam or manipulation' },
  { id: 'other', label: 'Other' },
];

export default function ReportIssue({
  open,
  onClose,
  topicId,
  roomId,
  yourSide,
  peerUid,
  matchMode,
  onSubmitted,
}) {
  const [category, setCategory] = useState('other');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const reset = () => {
    setCategory('other');
    setDetails('');
    setError(null);
    setDone(false);
    setBusy(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const reportId = await submitReport({
        topicId,
        roomId,
        yourSide,
        category,
        details,
        peerUid: peerUid || null,
        matchMode: matchMode || null,
      });
      onSubmitted?.(reportId);
      setDone(true);
    } catch (err) {
      setError(err?.message ?? 'Could not send report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="report-modal panel">
        <h2 id="report-title" className="report-modal-title">
          {done ? 'Report sent' : 'Report an issue'}
        </h2>
        {!done && (
          <p className="report-modal-lead">
            Reports are reviewed by the platform. Include what happened and the topic you were on.
          </p>
        )}
        {done ? (
          <p className="report-modal-success" role="status">
            Thanks — your report was sent.
          </p>
        ) : (
          <form className="report-modal-form" onSubmit={onSubmit}>
            <label className="report-modal-label" htmlFor="report-category">
              Category
            </label>
            <select
              id="report-category"
              className="report-modal-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <label className="report-modal-label" htmlFor="report-details">
              Details
            </label>
            <textarea
              id="report-details"
              className="report-modal-textarea"
              rows={4}
              maxLength={2000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What should we know? (required)"
              required
            />
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <div className="report-modal-actions">
              <button type="button" className="btn" onClick={handleClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
        {done && (
          <div className="report-modal-actions">
            <button type="button" className="btn btn-primary" onClick={handleClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
