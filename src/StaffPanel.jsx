import { useEffect, useMemo, useState } from 'react';
import { staffAction, staffAudit, staffReports, staffRespond, staffRole, staffUsers } from './staffApi.js';

function dateValue(value) {
  if (!value) return '—';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return '—';
}

export default function StaffPanel({ role, onBack, onAbout, onFaq, onSupport, onAccount, onSignOut, onPickLegal }) {
  const [tab, setTab] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true); setError('');
    try {
      if (tab === 'dashboard') {
        const [reportData, userData] = await Promise.all([staffReports(), staffUsers()]);
        setReports(reportData.reports || []);
        setUsers(userData.users || []);
      }
      if (tab === 'reports') setReports((await staffReports()).reports || []);
      if (tab === 'users' || tab === 'roles') setUsers((await staffUsers()).users || []);
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

  const openReports = reports.filter((r) => !['resolved', 'closed'].includes(r.status)).length;
  const bannedUsers = users.filter((u) => u.disabled).length;
  const staffUsersCount = users.filter((u) => ['moderator', 'admin', 'owner'].includes(u.role)).length;

  return <div className="admin-console">
    <header className="admin-console-topbar">
      <button className="admin-console-home" onClick={onBack} aria-label="Back to Hot Take">⌂</button>
      <img src="/hottake-logo-horizontal.png" alt="Hot Take" />
      <strong>Admin control panel</strong>
      <div><span>{role}</span><button onClick={onAccount}>Account</button><button onClick={onSignOut}>Sign out</button></div>
    </header>
    <div className="admin-console-body">
      <aside className="admin-console-sidebar">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><b>⌂</b>Dashboard</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}><b>⚑</b>Reports <i>{openReports}</i></button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><b>♙</b>Users</button>
        {role === 'owner' && <button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}><b>♟</b>Roles & permissions</button>}
        {(role === 'admin' || role === 'owner') && <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><b>↶</b>Audit logs</button>}
        <span />
        <button onClick={onAbout}><b>ⓘ</b>About Hot Take</button>
        <button onClick={onSupport}><b>?</b>Support</button>
        <button onClick={onBack}><b>←</b>Return to website</button>
      </aside>
      <main className="admin-console-main">
        <div className="admin-console-title"><div><p>HOT TAKE ADMINISTRATION</p><h1>{tab === 'dashboard' ? 'Control panel' : tab === 'roles' ? 'Roles & permissions' : tab[0].toUpperCase() + tab.slice(1)}</h1></div><button onClick={load}>↻ Refresh</button></div>
        {error && <div className="admin-notice error"><b>×</b>{error}</div>}
        {busy && <div className="admin-notice"><b>…</b>Loading administrative data…</div>}

        {tab === 'dashboard' && !busy && <>
          <div className="admin-notice warning"><b>!</b><span><strong>{openReports} reports require attention.</strong> Review reports and document every moderation action.</span></div>
          {bannedUsers > 0 && <div className="admin-notice danger"><b>×</b><span><strong>{bannedUsers} user accounts are currently banned.</strong></span></div>}
          <section className="admin-search-box"><label>Search for users:</label><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Username, email, UID…" /><button onClick={() => setTab('users')}>⌕ Search</button></section>
          <section className="admin-stat-grid">
            <article><h2>Total users</h2><strong>{users.length}</strong><span>Loaded Firebase accounts</span></article>
            <article><h2>Open reports</h2><strong>{openReports}</strong><span>Awaiting staff review</span></article>
            <article><h2>Staff accounts</h2><strong>{staffUsersCount}</strong><span>Moderators, admins, owners</span></article>
            <article><h2>Banned users</h2><strong>{bannedUsers}</strong><span>Disabled accounts</span></article>
          </section>
          <section className="admin-dashboard-panels"><article><h2>Recent reports</h2>{reports.slice(0,5).map((r)=><button key={r.id} onClick={()=>setTab('reports')}><span>{r.category || 'Report'}</span><small>{r.status || 'open'} · {r.roomId || r.id}</small></button>)}</article><article><h2>System status</h2><p><i className="ok"/>Firebase Admin connected</p><p><i className="ok"/>Staff authorization enforced</p><p><i className="ok"/>Audit logging enabled</p></article></section>
        </>}

        {tab === 'reports' && !busy && <section className="staff-grid">{reports.map((r) => <article className="staff-card" key={r.id}><header><strong>{String(r.status || 'open').toUpperCase()}</strong><span>{dateValue(r.createdAt)}</span></header><h2>{r.category || 'Report'}</h2><p>{r.details}</p><dl><dt>Report ID</dt><dd>{r.id}</dd><dt>Room</dt><dd>{r.roomId || '—'}</dd><dt>Reporter</dt><dd>{r.reporterUid}</dd><dt>Reported user</dt><dd>{r.peerUid || '—'}</dd></dl>{r.staffResponse && <blockquote><b>{r.respondedBy || 'Staff'}:</b> {r.staffResponse}</blockquote>}<button onClick={() => respond(r)}>Respond / update status</button></article>)}</section>}

        {(tab === 'users' || tab === 'roles') && !busy && <section><input className="staff-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, name, UID, or role…" /><div className="staff-table-wrap"><table><thead><tr><th>User</th><th>UID</th><th>Created / last login</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map((u) => <tr key={u.uid}><td><b>{u.displayName || 'No display name'}</b><small>{u.email}</small></td><td className="staff-uid">{u.uid}</td><td><small>{dateValue(u.createdAt)}<br />{dateValue(u.lastSignInAt)}</small></td><td>{role === 'owner' && u.role !== 'owner' ? <div className="staff-role"><select value={u.role} onChange={(e) => changeRole(u, e.target.value, u.premium)}><option value="user">User</option><option value="moderator">Staff</option><option value="admin">Admin</option></select><label><input type="checkbox" checked={u.premium} onChange={(e) => changeRole(u, u.role, e.target.checked)} /> Premium</label></div> : <b>{u.role}{u.premium ? ' + premium' : ''}</b>}</td><td>{u.disabled ? <span className="staff-banned">BANNED</span> : 'Active'}</td><td className="staff-actions"><button onClick={() => act(u, 'warn')}>Warn</button><button onClick={() => act(u, u.disabled ? 'unban' : 'ban')}>{u.disabled ? 'Unban' : 'Ban'}</button><button onClick={() => act(u, 'revoke_sessions')}>Sign out</button>{role === 'owner' && <button className="danger" onClick={() => act(u, 'delete')}>Delete</button>}</td></tr>)}</tbody></table></div></section>}
        {tab === 'audit' && !busy && <div className="staff-table-wrap"><table><thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id}><td>{dateValue(a.createdAt)}</td><td>{a.actorEmail}<small>{a.actorRole}</small></td><td>{a.action}</td><td className="staff-uid">{a.targetUid || '—'}</td><td><pre>{JSON.stringify(a.details || {}, null, 2)}</pre></td></tr>)}</tbody></table></div>}
      </main>
    </div>
  </div>;
}
