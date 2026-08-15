import { useEffect, useMemo, useState } from 'react';
import { staffAction, staffAudit, staffReports, staffRespond, staffRole, staffUsers } from './staffApi.js';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';

function dateValue(value) {
  if (!value) return '—';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return '—';
}

export default function StaffPanel({ role, onBack, onAbout, onFaq, onSupport, onAccount, onSignOut, onPickLegal }) {
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true); setError('');
    try {
      if (tab === 'reports') setReports((await staffReports()).reports || []);
      if (tab === 'users') setUsers((await staffUsers()).users || []);
      if (tab === 'audit') setAudit((await staffAudit()).audit || []);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [tab]);

  const filteredUsers = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => [u.email, u.displayName, u.uid, u.role].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [users, query]);

  const act = async (user, action) => {
    const reason = window.prompt('Reason for ' + action + ':');
    if (!reason) return;
    if (!window.confirm(action.toUpperCase() + ' ' + (user.email || user.uid) + '?')) return;
    try { await staffAction(user.uid, action, reason); await load(); } catch (e) { setError(e.message); }
  };
  const changeRole = async (user, nextRole, premium) => {
    if (!window.confirm('Update roles for ' + (user.email || user.uid) + '?')) return;
    try { await staffRole(user.uid, nextRole, premium); await load(); } catch (e) { setError(e.message); }
  };
  const respond = async (report) => {
    const response = window.prompt('Response to the reporting user:', report.staffResponse || '');
    if (!response) return;
    const status = window.prompt('Status: open, reviewing, responded, resolved, or closed', 'responded') || 'responded';
    try { await staffRespond(report.id, response, status); await load(); } catch (e) { setError(e.message); }
  };

  return <div className="staff-page">
    <SiteHeader
      onHome={onBack}
      onAbout={onAbout}
      onTopics={onBack}
      onFaq={onFaq}
      onSupport={onSupport}
      isSignedIn
      onSignOut={onSignOut}
      onProfile={onAccount}
      onPickLegal={onPickLegal}
    />
    <main className="staff-panel">
    <div className="staff-heading"><div><p>HOT TAKE STAFF</p><h1>Admin panel<span>.</span></h1><small>Signed in with {role} access</small></div><button onClick={onBack}>Back to site</button></div>
    <nav className="staff-tabs">
      <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>Reports</button>
      <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users</button>
      {(role === 'admin' || role === 'owner') && <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit log</button>}
    </nav>
    {error && <div className="staff-error">{error}</div>}
    {busy && <p className="staff-loading">Loading…</p>}
    {tab === 'reports' && !busy && <section className="staff-grid">{reports.map((r) => <article className="staff-card" key={r.id}>
      <header><strong>{String(r.status || 'open').toUpperCase()}</strong><span>{dateValue(r.createdAt)}</span></header>
      <h2>{r.category || 'Report'}</h2><p>{r.details}</p>
      <dl><dt>Report ID</dt><dd>{r.id}</dd><dt>Room</dt><dd>{r.roomId || '—'}</dd><dt>Reporter</dt><dd>{r.reporterUid}</dd><dt>Reported user</dt><dd>{r.peerUid || '—'}</dd></dl>
      {r.staffResponse && <blockquote><b>{r.respondedBy || 'Staff'}:</b> {r.staffResponse}</blockquote>}
      <button onClick={() => respond(r)}>Respond / update status</button>
    </article>)}</section>}
    {tab === 'users' && !busy && <section>
      <input className="staff-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, name, UID, or role…" />
      <div className="staff-table-wrap"><table><thead><tr><th>User</th><th>UID</th><th>Created / last login</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>{filteredUsers.map((u) => <tr key={u.uid}><td><b>{u.displayName || 'No display name'}</b><small>{u.email}</small></td><td className="staff-uid">{u.uid}</td><td><small>{dateValue(u.createdAt)}<br />{dateValue(u.lastSignInAt)}</small></td>
      <td>{role === 'owner' && u.role !== 'owner' ? <div className="staff-role"><select value={u.role} onChange={(e) => changeRole(u, e.target.value, u.premium)}><option value="user">User</option><option value="moderator">Staff</option><option value="admin">Admin</option></select><label><input type="checkbox" checked={u.premium} onChange={(e) => changeRole(u, u.role, e.target.checked)} /> Premium</label></div> : <b>{u.role}{u.premium ? ' + premium' : ''}</b>}</td>
      <td>{u.disabled ? <span className="staff-banned">BANNED</span> : 'Active'}</td><td className="staff-actions"><button onClick={() => act(u, 'warn')}>Warn</button><button onClick={() => act(u, u.disabled ? 'unban' : 'ban')}>{u.disabled ? 'Unban' : 'Ban'}</button><button onClick={() => act(u, 'revoke_sessions')}>Sign out</button>{role === 'owner' && <button className="danger" onClick={() => act(u, 'delete')}>Delete</button>}</td></tr>)}</tbody></table></div>
    </section>}
    {tab === 'audit' && !busy && <div className="staff-table-wrap"><table><thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id}><td>{dateValue(a.createdAt)}</td><td>{a.actorEmail}<small>{a.actorRole}</small></td><td>{a.action}</td><td className="staff-uid">{a.targetUid || '—'}</td><td><pre>{JSON.stringify(a.details || {}, null, 2)}</pre></td></tr>)}</tbody></table></div>}
    </main>
    <SiteFooter onHome={onBack} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />
  </div>;
}
