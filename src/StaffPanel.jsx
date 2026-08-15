import { Fragment, useEffect, useMemo, useState } from 'react';
import { staffAction, staffAudit, staffPermissions, staffReports, staffRespond, staffRole, staffSetPermission, staffUsers } from './staffApi.js';

function dateValue(value) {
  if (!value) return '—';
  if (typeof value === 'string') return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  return '—';
}

const SITE_ROLES = [
  { id: 'user', name: 'User', description: 'Standard member access for debating and community features.' },
  { id: 'moderator', name: 'Moderator', description: 'Reviews reports and takes day-to-day safety actions.' },
  { id: 'admin', name: 'Admin', description: 'Full platform administration except the protected Owner account.' },
  { id: 'owner', name: 'Owner', description: 'Protected highest-level access reserved for the site owner.' },
];

const ROLE_PERMISSIONS = [
  { group: 'Debates & account', permissions: [
    { name: 'Join quick-match debates', values: [true, true, true, true] },
    { name: 'Create and join custom debates', values: [true, true, true, true] },
    { name: 'Use debate text chat', values: [true, true, true, true] },
    { name: 'Edit own display name and bio', values: [true, true, true, true] },
    { name: 'Report a debate or user', values: [true, true, true, true] },
  ]},
  { group: 'Moderation', permissions: [
    { key: 'viewReports', name: 'View submitted reports', values: [false, true, true, true] },
    { key: 'respondReports', name: 'Respond to reports and update status', values: [false, true, true, true] },
    { key: 'viewUsers', name: 'View member emails and Firebase UIDs', values: [false, true, true, true] },
    { key: 'warnUsers', name: 'Issue user warnings', values: [false, true, true, true] },
    { key: 'banUsers', name: 'Ban user accounts', values: [false, true, true, true] },
    { key: 'revokeSessions', name: 'Revoke active sign-in sessions', values: [false, true, true, true] },
    { key: 'unbanUsers', name: 'Unban user accounts', values: [false, false, true, true] },
  ]},
  { group: 'Administration', permissions: [
    { key: 'viewAudit', name: 'View staff audit logs', values: [false, false, true, true] },
    { key: 'manageRoles', name: 'Assign User, Moderator, and Admin roles', values: [false, false, true, true] },
    { key: 'managePremium', name: 'Assign or remove Premium membership', values: [false, false, true, true] },
    { key: 'deleteUsers', name: 'Delete eligible user accounts', values: [false, false, true, true] },
    { name: 'Manage the protected Owner account', values: [false, false, false, true] },
  ]},
];

export default function StaffPanel({ role, onBack, onAbout, onFaq, onSupport, onAccount, onSignOut, onPickLegal }) {
  const [tab, setTab] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [savingPermission, setSavingPermission] = useState('');
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
      if (tab === 'users') setUsers((await staffUsers()).users || []);
      if (tab === 'roles') setPermissions((await staffPermissions()).permissions || {});
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
  const togglePermission = async (targetRole, permission, enabled) => {
    const id = targetRole + ':' + permission;
    setSavingPermission(id); setError('');
    try {
      const result = await staffSetPermission(targetRole, permission, enabled);
      setPermissions(result.permissions || {});
    } catch (e) { setError(e.message); } finally { setSavingPermission(''); }
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
        {(role === 'admin' || role === 'owner') && <button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}><b>♟</b>Roles & permissions</button>}
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

        {tab === 'reports' && !busy && <section className="staff-grid">{reports.map((r) => <article className="staff-card" key={r.id}><header><strong className={'staff-report-status status-' + String(r.status || 'open').toLowerCase()}>{r.status === 'reviewing' ? 'IN PROGRESS' : String(r.status || 'open').toUpperCase()}</strong><span>{dateValue(r.createdAt)}</span></header><h2>{r.category || 'Report'}</h2><p>{r.details}</p><dl><dt>Report ID</dt><dd>{r.id}</dd><dt>Room</dt><dd>{r.roomId || '—'}</dd><dt>Reporting user</dt><dd><b>{r.reporterEmail || 'Email unavailable'}</b><small>{r.reporterUid || '—'}</small></dd><dt>Reported user</dt><dd><b>{r.reportedEmail || 'Email unavailable'}</b><small>{r.peerUid || '—'}</small></dd></dl>{r.staffResponse && <blockquote><b>{r.respondedBy || 'Staff'}:</b> {r.staffResponse}</blockquote>}<button onClick={() => respond(r)}>Respond / update status</button></article>)}</section>}

        {tab === 'users' && !busy && <section><input className="staff-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, name, UID, or role…" /><div className="staff-table-wrap"><table><thead><tr><th>User</th><th>UID</th><th>Created / last login</th><th>Role</th><th>Membership</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map((u) => <tr key={u.uid}><td><b>{u.displayName || 'No display name'}</b><small>{u.email}</small></td><td className="staff-uid">{u.uid}</td><td><small>{dateValue(u.createdAt)}<br />{dateValue(u.lastSignInAt)}</small></td><td>{(role === 'admin' || role === 'owner') && u.role !== 'owner' ? <div className="staff-role"><select value={u.role} onChange={(e) => changeRole(u, e.target.value, e.target.value === 'user' ? u.premium : false)}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></div> : <b>{u.role === 'moderator' ? 'Moderator' : u.role}</b>}</td><td>{u.role === 'user' ? <label className="staff-premium"><input type="checkbox" checked={u.premium} disabled={role !== 'admin' && role !== 'owner'} onChange={(e) => changeRole(u, 'user', e.target.checked)} /> Premium</label> : <span className="staff-not-applicable">Not applicable</span>}</td><td>{u.disabled ? <span className="staff-banned">BANNED</span> : 'Active'}</td><td className="staff-actions"><button onClick={() => act(u, 'warn')}>Warn</button><button onClick={() => act(u, u.disabled ? 'unban' : 'ban')}>{u.disabled ? 'Unban' : 'Ban'}</button><button onClick={() => act(u, 'revoke_sessions')}>Sign out</button>{(role === 'admin' || role === 'owner') && u.role !== 'owner' && <button className="danger" onClick={() => act(u, 'delete')}>Delete</button>}</td></tr>)}</tbody></table></div></section>}
        {tab === 'roles' && !busy && <section className="role-permissions">
          <div className="role-permissions-intro">
            <div><p>Select Yes or No to give or remove a permission. Changes apply to every account with that role. Premium remains a membership and is not a role.</p></div>
            <span>Saved in Firebase</span>
          </div>
          <div className="role-card-grid">
            {SITE_ROLES.map((siteRole) => <article key={siteRole.id} className={role === siteRole.id ? 'current' : ''}>
              <div className={'role-card-icon role-' + siteRole.id}>{siteRole.name.charAt(0)}</div>
              <div><h2>{siteRole.name}</h2><p>{siteRole.description}</p>{role === siteRole.id && <small>Your current role</small>}</div>
            </article>)}
          </div>
          <div className="permission-table-wrap">
            <table className="permission-table">
              <thead><tr><th>Permission</th>{SITE_ROLES.map((siteRole) => <th key={siteRole.id}>{siteRole.name}</th>)}</tr></thead>
              <tbody>{ROLE_PERMISSIONS.map((section) => <Fragment key={section.group}>
                <tr className="permission-group"><th colSpan="5">{section.group}</th></tr>
                {section.permissions.map((permission) => <tr key={permission.name}><td>{permission.name}{!permission.key && <small>Standard platform access</small>}</td>{SITE_ROLES.map((siteRole, index) => {
                  const value = permission.key ? (permissions[siteRole.id]?.[permission.key] ?? permission.values[index]) : permission.values[index];
                  const editable = Boolean(permission.key) && (siteRole.id === 'moderator' || siteRole.id === 'admin');
                  const id = siteRole.id + ':' + permission.key;
                  return <td key={siteRole.id}><button type="button" disabled={!editable || savingPermission === id} onClick={() => editable && togglePermission(siteRole.id, permission.key, !value)} className={'permission-value ' + (value ? 'allowed' : 'denied') + (editable ? ' editable' : '')}>{savingPermission === id ? '…' : value ? '✓' : '—'} {permissionLabel(value)}</button></td>;
                })}</tr>)}
              </Fragment>)}</tbody>
            </table>
          </div>
          <p className="permission-footnote">Owner access and standard debate rights are protected. All other buttons can be changed by Admins and the Owner, and changes are enforced by the staff API.</p>
        </section>}
        {tab === 'audit' && !busy && <div className="staff-table-wrap"><table><thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id}><td>{dateValue(a.createdAt)}</td><td>{a.actorEmail}<small>{a.actorRole}</small></td><td>{a.action}</td><td className="staff-uid">{a.targetUid || '—'}</td><td><pre>{JSON.stringify(a.details || {}, null, 2)}</pre></td></tr>)}</tbody></table></div>}
      </main>
    </div>
  </div>;
}
