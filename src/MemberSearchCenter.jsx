import { useEffect, useRef, useState } from 'react';
import { networkSearchMembers } from './networkApi.js';
import IdentityBadges from './IdentityBadges.jsx';

export default function MemberSearchCenter() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const value = query.trim();
    const requestId = ++requestRef.current;
    if (!value) {
      setResults([]);
      setError('');
      setBusy(false);
      return undefined;
    }

    setBusy(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const response = await networkSearchMembers(value);
        if (requestId !== requestRef.current) return;
        const members = response.members || [];
        setResults(members);
        setError(members.length ? '' : 'No matching display names.');
      } catch (searchError) {
        if (requestId === requestRef.current) {
          setResults([]);
          setError(searchError?.message || 'Search failed.');
        }
      } finally {
        if (requestId === requestRef.current) setBusy(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [open, query]);

  return <div className="member-search-center" ref={rootRef}>
    <button type="button" className="member-search-trigger" aria-label="Search members" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
    </button>
    {open && <section className="member-search-popover" aria-label="Search members">
      <h2>Find a member</h2>
      <form onSubmit={(event) => event.preventDefault()}><input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by display name…" maxLength={40}/><button type="button" disabled aria-label={busy ? 'Searching' : 'Live search'}>{busy ? '…' : 'Live'}</button></form>
      {error && <p className="member-search-error">{error}</p>}
      {!!results.length && <ul>{results.map((member) => <li key={member.uid}>
        <button type="button" onClick={() => { window.__hotTakeOpenMemberProfile?.(member.uid); setOpen(false); }}>
          <span className="member-search-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt=""/> : member.displayName.slice(0, 1).toUpperCase()}</span>
          <span><strong>{member.displayName}</strong><IdentityBadges premium={member.premium} verified={member.verifiedDebater} role={member.role}/><small>View profile</small></span>
        </button>
      </li>)}</ul>}
    </section>}
  </div>;
}

