import { TOPICS } from './topics.js';

function topicTitle(id) {
  if (id === 'custom') return 'Custom debate';
  return TOPICS.find((t) => t.id === id)?.label ?? id;
}

function sideLabel(side) {
  if (side === 'agree' || side === 'pro') return 'Agree';
  if (side === 'disagree' || side === 'con') return 'Disagree';
  return side ?? '—';
}

function formatStatementPreview(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

function formatDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return '—';
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function reasonLabel(r) {
  if (r === 'leave') return 'You left';
  if (r === 'peer_left') return 'Opponent left';
  return r ?? '—';
}

export default function DebateHistory({ rows, loading, error, onBack, onRefresh }) {
  return (
    <div className="panel history-panel">
      <h2>Past sessions</h2>
      <p className="history-lead">
        Stored under your account in Firestore (users → your email → debates).
      </p>

      <div className="history-toolbar">
        <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" className="back-btn" onClick={onBack} style={{ marginTop: 0 }}>
          Back
        </button>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="history-empty">No sessions yet. Finish a debate and it will show up here.</p>
      )}

      {rows.length > 0 && (
        <ul className="history-list">
          {rows.map((row) => (
            <li key={row.id} className="history-item">
              <div className="history-item-main">
                <strong>{topicTitle(row.topicId)}</strong>
                <span className="history-side">
                  You: {sideLabel(row.yourSide)}
                </span>
              </div>
              <div className="history-item-meta">
                <span>{row.endedAtMs ? new Date(row.endedAtMs).toLocaleString() : '—'}</span>
                <span className="history-dot">·</span>
                <span>{formatDuration(row.durationSec)}</span>
                <span className="history-dot">·</span>
                <span>{reasonLabel(row.reason)}</span>
                {row.matchMode && (
                  <>
                    <span className="history-dot">·</span>
                    <span>{row.matchMode === 'custom' ? 'Custom lobby' : 'Quick match'}</span>
                  </>
                )}
                {row.roomCode && (
                  <>
                    <span className="history-dot">·</span>
                    <span>Code {row.roomCode}</span>
                  </>
                )}
              </div>
              {formatStatementPreview(row.statement) && (
                <p className="history-item-statement">{formatStatementPreview(row.statement)}</p>
              )}
              {row.peerUid && (
                <p className="history-item-peer">Matched with another participant (session linked in our records).</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
