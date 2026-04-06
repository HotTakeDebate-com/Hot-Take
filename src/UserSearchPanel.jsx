import { useState } from 'react';
import { fetchPublicProfile, searchPublicProfilesByDisplayPrefix } from './chitChatFirestore.js';

function looksLikeEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

export default function UserSearchPanel({ onBack, onOpenProfile }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);

  const runSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    setError(null);
    setResults([]);
    if (q.length < 2) {
      setError('Enter at least 2 characters, or a full email address.');
      return;
    }
    setLoading(true);
    try {
      if (looksLikeEmail(q)) {
        const email = q.toLowerCase();
        const prof = await fetchPublicProfile(email);
        if (prof) {
          setResults([prof]);
        } else {
          setResults([]);
          setError('That doesn’t look like a valid email address.');
        }
      } else {
        const rows = await searchPublicProfilesByDisplayPrefix(q, 30);
        setResults(rows);
        if (rows.length === 0) {
          setError('No matches. Try a different spelling or search by email.');
        }
      }
    } catch (err) {
      setError(err?.message ?? 'Search failed. If this keeps happening, the database may need a search index.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel user-search-panel">
      <h2>Search</h2>
      <p className="user-search-lead">
        Find people by display name or email. Open a profile to follow them or see their bio.
      </p>

      <form className="user-search-form" onSubmit={runSearch}>
        <label className="auth-label" htmlFor="user-search-input">
          Name or email
        </label>
        <input
          id="user-search-input"
          className="auth-input"
          type="search"
          autoComplete="off"
          placeholder="e.g. Alex or alex@example.com"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={320}
        />
        <button type="submit" className="btn btn-primary user-search-submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <ul className="user-search-results" aria-label="Search results">
          {results.map((p) => {
            const bio = (p.bio ?? '').trim();
            return (
              <li key={p.email} className="user-search-card">
                <div className="user-search-card-main">
                  <span className="user-search-name">{p.displayName?.trim() || '(No display name)'}</span>
                  <span className="user-search-email">{p.email}</span>
                  {bio ? (
                    <p className="user-search-bio-preview">
                      {bio.slice(0, 160)}
                      {bio.length > 160 ? '…' : ''}
                    </p>
                  ) : null}
                </div>
                <button type="button" className="btn btn-outline user-search-open" onClick={() => onOpenProfile(p.email)}>
                  Profile
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
