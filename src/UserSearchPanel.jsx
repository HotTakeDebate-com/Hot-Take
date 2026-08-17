import { useEffect, useRef, useState } from 'react';
import { networkSearchMembers } from './networkApi.js';

export default function UserSearchPanel({ onBack, onOpenProfile }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const requestRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const requestId = ++requestRef.current;
    if (!q) {
      setError(null);
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setError(null);
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const rows = (await networkSearchMembers(q)).members || [];
        if (requestId !== requestRef.current) return;
        setResults(rows);
        if (rows.length === 0) setError('No members found with that display name.');
      } catch (err) {
        if (requestId === requestRef.current) {
          setError(err?.message ?? 'Search failed. If this keeps happening, the database may need a search index.');
          setResults([]);
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="panel user-search-panel">
      <h2>Search</h2>
      <p className="user-search-lead">
        Find people by display name. Open a profile to follow them or see their status.
      </p>

      <form className="user-search-form" onSubmit={(event) => event.preventDefault()}>
        <label className="auth-label" htmlFor="user-search-input">
          Display name
        </label>
        <input
          id="user-search-input"
          className="auth-input"
          type="search"
          autoComplete="off"
          placeholder="Search display names…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={40}
        />
        <button type="button" className="btn btn-primary user-search-submit" disabled>
          {loading ? 'Searching…' : 'Live search'}
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
              <li key={p.uid} className="user-search-card">
                <div className="user-search-card-main">
                  <span className="user-search-name">{p.displayName?.trim() || '(No display name)'}</span>
                  {bio ? (
                    <p className="user-search-bio-preview">
                      {bio.slice(0, 160)}
                      {bio.length > 160 ? '…' : ''}
                    </p>
                  ) : null}
                </div>
                <button type="button" className="btn btn-outline user-search-open" onClick={() => onOpenProfile(`uid:${p.uid}`)}>
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

