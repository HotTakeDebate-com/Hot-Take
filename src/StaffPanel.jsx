import { Fragment, useEffect, useMemo, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase.js';
import { prepareProfileImage, profileInitial } from './profileImage.js';
import { staffAction, staffAudit, staffDeleteReport, staffPermissions, staffReports, staffRespond, staffRole, staffSetPassword, staffSetPermission, staffUpdateUser, staffUsers } from './staffApi.js';

function dateValue(value) {
  if (!value) return '—';
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).toLocaleString();
  if (value._seconds) return new Date(value._seconds * 1000).toLocaleString();
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  return '—';
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value._seconds) return value._seconds * 1000;
  if (value.seconds) return value.seconds * 1000;
  return 0;
}

function countSince(items, field, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return items.filter((item) => timestampValue(item[field]) >= cutoff).length;
}


function dailySeries(items, field, days = 30) {
  const result = [];
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - offset);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const value = items.filter((item) => {
      const timestamp = timestampValue(item[field]);
      return timestamp >= day.getTime() && timestamp < next.getTime();
    }).length;
    result.push({
      key: day.toISOString().slice(0, 10),
      label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value,
    });
  }
  return result;
}

function ActivityGraph({ users, reports }) {
  const registrations = dailySeries(users, 'createdAt');
  const submittedReports = dailySeries(reports, 'createdAt');
  const maxValue = Math.max(4, ...registrations.map((item) => item.value), ...submittedReports.map((item) => item.value));
  const width = 960;
  const height = 300;
  const left = 52;
  const right = 18;
  const top = 24;
  const bottom = 45;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index) => left + (index * plotWidth) / Math.max(1, registrations.length - 1);
  const y = (value) => top + plotHeight - (value / maxValue) * plotHeight;
  const points = (series) => series.map((item, index) => `${x(index)},${y(item.value)}`).join(' ');
  const gridValues = Array.from({ length: 5 }, (_, index) => Math.round((maxValue * index) / 4));
  const labelIndexes = [0, 7, 14, 21, 29];

  return (
    <section className="admin-dashboard-section admin-chart-section">
      <header><div><p>STATISTICS</p><h2>30-day platform activity</h2></div><span>Daily registrations and submitted reports</span></header>
      <div className="admin-chart-wrap">
        <svg className="admin-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily user registrations and submitted reports during the last 30 days">
          {gridValues.map((value) => <g key={value}>
            <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="admin-chart-grid" />
            <text x={left - 12} y={y(value) + 4} textAnchor="end" className="admin-chart-axis">{value}</text>
          </g>)}
          {labelIndexes.map((index) => <text key={registrations[index].key} x={x(index)} y={height - 13} textAnchor={index === 0 ? 'start' : index === 29 ? 'end' : 'middle'} className="admin-chart-axis">{registrations[index].label}</text>)}
          <polyline points={points(registrations)} className="admin-chart-line registrations" />
          <polyline points={points(submittedReports)} className="admin-chart-line reports" />
          {registrations.map((item, index) => <circle key={'users-' + item.key} cx={x(index)} cy={y(item.value)} r="3" className="admin-chart-point registrations"><title>{item.label}: {item.value} registrations</title></circle>)}
          {submittedReports.map((item, index) => <circle key={'reports-' + item.key} cx={x(index)} cy={y(item.value)} r="3" className="admin-chart-point reports"><title>{item.label}: {item.value} reports</title></circle>)}
        </svg>
        <div className="admin-chart-legend"><span><i className="registrations"/>User registrations</span><span><i className="reports"/>Reports submitted</span></div>
      </div>
    </section>
  );
}

const ROLE_RANK = { user: 0, moderator: 1, admin: 2, owner: 3 };

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
    { key: 'deleteReports', name: 'Delete junk or invalid reports', values: [false, true, true, true] },
    { key: 'viewUsers', name: 'View member emails and Firebase UIDs', values: [false, true, true, true] },
    { key: 'warnUsers', name: 'Issue user warnings', values: [false, true, true, true] },
    { key: 'banUsers', name: 'Ban user accounts', values: [false, true, true, true] },
    { key: 'revokeSessions', name: 'Revoke active sign-in sessions', values: [false, true, true, true] },
    { key: 'unbanUsers', name: 'Unban user accounts', values: [false, false, true, true] },
  ]},
  { group: 'Administration', permissions: [
    { key: 'viewAudit', name: 'View staff audit logs', values: [false, false, true, true] },
    { key: 'editUsers', name: 'Edit user profile details', values: [false, false, true, true] },
    { key: 'editAvatars', name: 'Edit profile pictures for lower roles', values: [false, true, true, true] },
    { key: 'manageCredentials', name: 'Change emails, verification, and passwords', values: [false, false, true, true] },
    { key: 'manageRoles', name: 'Assign User, Moderator, and Admin roles', values: [false, false, true, true] },
    { key: 'managePremium', name: 'Assign or remove Premium membership', values: [false, false, true, true] },
    { key: 'deleteUsers', name: 'Delete eligible user accounts', values: [false, false, true, true] },
    { name: 'Manage the protected Owner account', values: [false, false, false, true] },
  ]},
];

function permissionLabel(value) {
  return value ? 'Yes' : 'No';
}

export default function StaffPanel({ role, onBack, onAbout, onFaq, onSupport, onAccount, onSignOut, onPickLegal }) {
  const [tab, setTab] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [capabilities, setCapabilities] = useState({});
  const [savingPermission, setSavingPermission] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [userDraft, setUserDraft] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [editorTab, setEditorTab] = useState('details');
  const [editorMessage, setEditorMessage] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [passwordMode, setPasswordMode] = useState('none');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true); setError('');
    try {
      if (tab === 'dashboard') {
        const requests = [staffReports(), staffUsers()];
        if (role === 'admin' || role === 'owner') requests.push(staffAudit());
        const [reportData, userData, auditData] = await Promise.all(requests);
        setReports(reportData.reports || []);
        setUsers(userData.users || []);
        setAudit(auditData?.audit || []);
        setCapabilities(userData.capabilities || {});
      }
      if (tab === 'reports') {
        const reportData = await staffReports();
        setReports(reportData.reports || []);
        setCapabilities(reportData.capabilities || {});
      }
      if (tab === 'users') { const userData = await staffUsers(); setUsers(userData.users || []); setCapabilities(userData.capabilities || {}); }
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
    let durationMinutes = null;
    if (action === 'ban') {
      const rawDuration = window.prompt('Ban length in minutes. Enter 0 for a permanent ban:', '60');
      if (rawDuration === null) return;
      durationMinutes = Number(rawDuration);
      if (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 525600) {
        setError('Enter 0 for permanent, or a whole number of minutes up to 525600.');
        return;
      }
    }
    const reason = window.prompt('Reason for ' + action + ':');
    if (!reason) return;
    const durationLabel = action === 'ban'
      ? (durationMinutes === 0 ? ' permanently' : ` for ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`)
      : '';
    if (!window.confirm(action.toUpperCase() + ' ' + (user.email || user.uid) + durationLabel + '?')) return;
    try {
      await staffAction(user.uid, action, reason, durationMinutes);
      const data = await staffUsers();
      const nextUsers = data.users || [];
      setUsers(nextUsers);
      setCapabilities(data.capabilities || {});
      setEditingUser((current) => current?.uid === user.uid ? (nextUsers.find((item) => item.uid === user.uid) || null) : current);
    } catch (e) { setError(e.message); }
  };
  const changeRole = async (user, nextRole, premium) => {
    if (!window.confirm('Update roles for ' + (user.email || user.uid) + '?')) return;
    try { await staffRole(user.uid, nextRole, premium); await load(); } catch (e) { setError(e.message); }
  };
  const openUserEditor = (user) => {
    setEditingUser(user);
    setUserDraft({ displayName: user.displayName || '', email: user.email || '', role: user.role || 'user', premium: user.premium === true, emailVerified: user.emailVerified === true, avatarUrl: user.avatarUrl || '' });
    setPasswordMode('none');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setEditorTab('details');
    setEditorMessage('');
    setError('');
  };

  const onStaffAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true); setEditorMessage(''); setError('');
    try {
      const avatarUrl = await prepareProfileImage(file);
      setUserDraft((draft) => ({ ...draft, avatarUrl }));
      setEditorMessage('Profile picture ready. Save the account to publish it.');
    } catch (avatarError) {
      setError(avatarError?.message || 'Could not prepare that image.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveUser = async () => {
    if (!editingUser || !userDraft) return;
    setSavingUser(true); setError('');
    try {
      if (passwordMode === 'set') {
        if (newPassword.length < 8) throw new Error('The new password must be at least 8 characters.');
        if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.');
      }
      await staffUpdateUser(editingUser.uid, { displayName: userDraft.displayName, email: userDraft.email, emailVerified: userDraft.emailVerified, avatarUrl: userDraft.avatarUrl || '' });
      if (userDraft.role !== editingUser.role || userDraft.premium !== editingUser.premium) {
        await staffRole(editingUser.uid, userDraft.role, userDraft.role === 'user' && userDraft.premium);
      }
      if (passwordMode === 'reset') {
        setSendingReset(true);
        await sendPasswordResetEmail(auth, userDraft.email);
      } else if (passwordMode === 'set') {
        await staffSetPassword(editingUser.uid, newPassword);
      }
      const data = await staffUsers();
      const nextUsers = data.users || [];
      const updated = nextUsers.find((user) => user.uid === editingUser.uid);
      setUsers(nextUsers);
      setCapabilities(data.capabilities || {});
      setEditingUser(updated || null);
      if (updated) setUserDraft({ displayName: updated.displayName || '', email: updated.email || '', role: updated.role || 'user', premium: updated.premium === true, emailVerified: updated.emailVerified === true });
      setPasswordMode('none'); setNewPassword(''); setConfirmPassword('');
      setEditorMessage(passwordMode === 'reset' ? 'Account saved and password reset email sent.' : passwordMode === 'set' ? 'Account saved and a new password was set. All existing sessions were signed out.' : 'Account changes saved.');
    } catch (e) { setError(e.message); } finally { setSavingUser(false); setSendingReset(false); }
  };

  const sendReset = async () => {
    if (!editingUser?.email) return;
    if (!window.confirm('Send a password reset email to ' + editingUser.email + '?')) return;
    setSendingReset(true); setEditorMessage(''); setError('');
    try {
      await sendPasswordResetEmail(auth, editingUser.email);
      setEditorMessage('Password reset email sent to ' + editingUser.email + '.');
    } catch (e) { setError(e.message); } finally { setSendingReset(false); }
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

  const deleteReport = async (report) => {
    const reporter = report.reporterEmail || report.reporterUid || 'an unknown user';
    if (!window.confirm(`Permanently delete this ${report.category || 'report'} from ${reporter}? This cannot be undone.`)) return;
    setError('');
    try {
      await staffDeleteReport(report.id);
      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch (e) { setError(e.message); }
  };

  const openReports = reports.filter((r) => !['resolved', 'closed'].includes(r.status)).length;
  const bannedUsers = users.filter((u) => u.disabled).length;
  const staffUsersCount = users.filter((u) => ['moderator', 'admin', 'owner'].includes(u.role)).length;
  const recentStaff = users
    .filter((u) => ['moderator', 'admin', 'owner'].includes(u.role))
    .sort((a, b) => timestampValue(b.lastSignInAt) - timestampValue(a.lastSignInAt))
    .slice(0, 6);
  const activityRows = [
    { label: 'Moderation actions', source: audit, field: 'createdAt' },
    { label: 'Reports submitted', source: reports, field: 'createdAt' },
    { label: 'User registrations', source: users, field: 'createdAt' },
  ];
  const editingProtected = Boolean(editingUser && ROLE_RANK[editingUser.role] >= ROLE_RANK[role]);

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

          <ActivityGraph users={users} reports={reports} />

          <section className="admin-dashboard-section">
            <header><div><p>PLATFORM ANALYTICS</p><h2>Logged activity</h2></div><span>Rolling activity recorded by Hot Take</span></header>
            <div className="admin-activity-table">
              <div className="admin-activity-row heading"><b>Type</b><b>Last day</b><b>Last week</b><b>Last month</b></div>
              {activityRows.map((item) => <div className="admin-activity-row" key={item.label}><span>{item.label}</span><strong>{countSince(item.source, item.field, 1)}</strong><strong>{countSince(item.source, item.field, 7)}</strong><strong>{countSince(item.source, item.field, 30)}</strong></div>)}
            </div>
          </section>

          <section className="admin-lower-grid">
            <article className="admin-dashboard-section">
              <header><div><p>STAFF</p><h2>Recent staff activity</h2></div></header>
              <div className="admin-staff-list">
                {recentStaff.length ? recentStaff.map((member) => <button key={member.uid} onClick={() => { setTab('users'); setQuery(member.email || member.uid); }}><span className="admin-staff-avatar">{(member.displayName || member.email || '?')[0].toUpperCase()}</span><span><b>{member.displayName || member.email || 'Staff member'}</b><small>{member.role} · Last sign-in {dateValue(member.lastSignInAt)}</small></span><i className={member.disabled ? 'offline' : 'ok'} /></button>) : <p>No staff accounts were returned.</p>}
              </div>
            </article>
            <article className="admin-dashboard-section">
              <header><div><p>HEALTH</p><h2>System checks</h2></div><span>Checked when this dashboard loaded</span></header>
              <div className="admin-health-list">
                <p><i className="ok"/><span><b>Firebase Admin</b><small>User directory available</small></span><strong>Healthy</strong></p>
                <p><i className="ok"/><span><b>Moderation API</b><small>Reports and actions available</small></span><strong>Healthy</strong></p>
                <p><i className="ok"/><span><b>Authorization</b><small>Role permissions enforced server-side</small></span><strong>Healthy</strong></p>
                <p><i className={role === 'admin' || role === 'owner' ? 'ok' : 'limited'}/><span><b>Audit trail</b><small>{role === 'admin' || role === 'owner' ? 'Administrative log available' : 'Restricted for this role'}</small></span><strong>{role === 'admin' || role === 'owner' ? 'Healthy' : 'Restricted'}</strong></p>
              </div>
            </article>
          </section>
        </>}

        {tab === 'reports' && !busy && <section className="staff-report-list">
          {reports.length ? reports.map((r) => <details className="staff-report-row" key={r.id}>
            <summary>
              <strong className={'staff-report-status status-' + String(r.status || 'open').toLowerCase()}>{r.status === 'reviewing' ? 'IN PROGRESS' : String(r.status || 'open').toUpperCase()}</strong>
              <span className="staff-report-category">{r.category || 'Report'}</span>
              <span className="staff-report-users"><b>{r.reporterEmail || 'Unknown reporter'}</b><i>→</i><b>{r.reportedEmail || 'Unknown user'}</b></span>
              <span className="staff-report-preview">{r.details || 'No details supplied.'}</span>
              <time>{dateValue(r.createdAt)}</time>
              <span className="staff-report-toggle" aria-hidden="true">⌄</span>
            </summary>
            <div className="staff-report-expanded">
              <div className="staff-report-description"><span>Report details</span><p>{r.details || 'No details supplied.'}</p></div>
              <dl>
                <div><dt>Report ID</dt><dd>{r.id}</dd></div>
                <div><dt>Room</dt><dd>{r.roomId || '—'}</dd></div>
                <div><dt>Reporting user</dt><dd><b>{r.reporterEmail || 'Email unavailable'}</b><small>{r.reporterUid || '—'}</small></dd></div>
                <div><dt>Reported user</dt><dd><b>{r.reportedEmail || 'Email unavailable'}</b><small>{r.peerUid || '—'}</small></dd></div>
              </dl>
              {r.staffResponse && <blockquote><b>{r.respondedBy || 'Staff'}:</b> {r.staffResponse}</blockquote>}
              <div className="staff-report-actions">
                <button onClick={() => respond(r)}>Respond / update status</button>
                {capabilities.deleteReports && <button className="danger" onClick={() => deleteReport(r)}>Delete junk report</button>}
              </div>
            </div>
          </details>) : <div className="admin-notice">No reports found.</div>}
        </section>}

        {tab === 'users' && !busy && <section>
          <input className="staff-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, name, UID, or role…" />
          <div className="staff-table-wrap"><table><thead><tr><th>User</th><th>UID</th><th>Created / last login</th><th>Role</th><th>Membership</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filteredUsers.map((u) => <tr className="staff-user-row" key={u.uid} onClick={() => openUserEditor(u)} tabIndex="0" onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && openUserEditor(u)}>
              <td><b>{u.displayName || 'No display name'}</b><small>{u.email}</small></td>
              <td className="staff-uid">{u.uid}</td>
              <td><small>{dateValue(u.createdAt)}<br />{dateValue(u.lastSignInAt)}</small></td>
              <td><b>{u.role === 'moderator' ? 'Moderator' : u.role}</b></td>
              <td>{u.role === 'user' && u.premium ? <span className="staff-premium">Premium</span> : <span className="staff-not-applicable">Standard</span>}</td>
              <td>{u.disabled ? <span className="staff-banned">{u.banPermanent ? 'PERMANENTLY BANNED' : `BANNED · ${Math.max(1, Math.ceil((u.banUntilMs - Date.now()) / 60000))}m left`}</span> : 'Active'}</td>
              <td className="staff-actions">
                {capabilities.warnUsers && ROLE_RANK[u.role] < ROLE_RANK[role] && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'warn'); }}>Warn</button>}
                {!u.disabled && capabilities.banUsers && ROLE_RANK[u.role] < ROLE_RANK[role] && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'ban'); }}>Ban</button>}
                {u.disabled && capabilities.unbanUsers && ROLE_RANK[u.role] < ROLE_RANK[role] && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'unban'); }}>Unban</button>}
                {capabilities.revokeSessions && ROLE_RANK[u.role] < ROLE_RANK[role] && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'revoke_sessions'); }}>Sign out</button>}
              </td>
            </tr>)}</tbody>
          </table></div>
        </section>}
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
        {editingUser && userDraft && <div className="user-editor-backdrop" onMouseDown={() => setEditingUser(null)}>
          <section className="user-editor" role="dialog" aria-modal="true" aria-label={'Manage ' + (editingUser.email || editingUser.uid)} onMouseDown={(event) => event.stopPropagation()}>
            <header className="user-editor-header">
              <div className={'user-editor-avatar' + (userDraft.avatarUrl ? ' has-image' : '')}>{userDraft.avatarUrl ? <img src={userDraft.avatarUrl} alt="" /> : profileInitial(editingUser.displayName, editingUser.email)}</div>
              <div><p>HOT TAKE ACCOUNT MANAGEMENT</p><h2>{editingUser.displayName || 'No display name'}</h2><span>{editingUser.email}</span></div>
              <button type="button" onClick={() => setEditingUser(null)} aria-label="Close user editor">×</button>
            </header>
            <nav className="user-editor-tabs" aria-label="Account management sections">
              <button className={editorTab === 'details' ? 'active' : ''} onClick={() => setEditorTab('details')}>User details</button>
              <button className={editorTab === 'security' ? 'active' : ''} onClick={() => setEditorTab('security')}>Security</button>
              <button className={editorTab === 'moderation' ? 'active' : ''} onClick={() => setEditorTab('moderation')}>Moderation</button>
            </nav>
            {editingProtected && <div className="user-editor-message protected">This account has an equal or higher role and is view-only.</div>}
            {editorMessage && <div className="user-editor-message">✓ {editorMessage}</div>}
            <div className={'user-editor-content editor-' + editorTab}>
              {editorTab === 'details' && <>
                <section className="user-editor-section"><h3>Identity</h3>
                  <div className="staff-avatar-editor">
                    <div className={'user-editor-avatar staff-avatar-preview' + (userDraft.avatarUrl ? ' has-image' : '')}>{userDraft.avatarUrl ? <img src={userDraft.avatarUrl} alt="Profile preview" /> : profileInitial(userDraft.displayName, userDraft.email)}</div>
                    <div><strong>Profile picture</strong><small>Moderators and administrators can update pictures only for accounts below their role.</small>
                      <div className="staff-avatar-actions">
                        <label className={'admin-small-button' + ((!capabilities.editAvatars || editingProtected || avatarBusy) ? ' disabled' : '')}>{avatarBusy ? 'Preparing…' : 'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!capabilities.editAvatars || editingProtected || avatarBusy} onChange={onStaffAvatarSelected} /></label>
                        <button type="button" className="admin-small-button" disabled={!capabilities.editAvatars || editingProtected || avatarBusy || !userDraft.avatarUrl} onClick={() => setUserDraft((draft) => ({ ...draft, avatarUrl: '' }))}>Remove image</button>
                      </div>
                    </div>
                  </div>
                  <label><span>Display name</span><input value={userDraft.displayName} disabled={!capabilities.editUsers || editingProtected} onChange={(event) => setUserDraft((draft) => ({ ...draft, displayName: event.target.value }))} /></label>
                  <label><span>Email address</span><input type="email" value={userDraft.email} disabled={!capabilities.manageCredentials || editingProtected} onChange={(event) => setUserDraft((draft) => ({ ...draft, email: event.target.value, emailVerified: event.target.value.trim().toLowerCase() === editingUser.email?.toLowerCase() ? editingUser.emailVerified : false }))} /><small>Changing the email signs the user out and marks the new address unverified.</small></label>
                  <label><span>Firebase UID</span><input value={editingUser.uid} readOnly /></label>
                </section>
                <section className="user-editor-section"><h3>Role & membership</h3>
                  <label><span>Primary role</span><select value={userDraft.role} disabled={!capabilities.manageRoles || editingProtected} onChange={(event) => setUserDraft((draft) => ({ ...draft, role: event.target.value, premium: event.target.value === 'user' ? draft.premium : false }))}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select></label>
                  <label className="user-editor-check"><span>Premium</span><input type="checkbox" checked={userDraft.role === 'user' && userDraft.premium} disabled={!capabilities.managePremium || editingProtected || userDraft.role !== 'user' || editingUser.role === 'owner'} onChange={(event) => setUserDraft((draft) => ({ ...draft, premium: event.target.checked }))} /><b>Premium member</b></label>
                </section>
              </>}
              {editorTab === 'security' && <>
                <section className="user-editor-section"><h3>Sign-in security</h3>
                  <label className="user-editor-check"><span>Email verification</span><input type="checkbox" checked={userDraft.emailVerified} disabled={!capabilities.manageCredentials || editingProtected} onChange={(event) => setUserDraft((draft) => ({ ...draft, emailVerified: event.target.checked }))} /><b>{userDraft.emailVerified ? 'Email is verified' : 'Email is not verified'}</b><small>Use this override only after independently confirming the address belongs to the user.</small></label>
                  <div className="password-security-note"><strong>Current password unavailable</strong><span>Firebase securely hashes passwords, so the existing password cannot be viewed. You can replace it below.</span></div>
                  {capabilities.manageCredentials && !editingProtected ? <div className="user-password-options">
                    <label className={passwordMode === 'none' ? 'selected' : ''}><input type="radio" name="passwordMode" checked={passwordMode === 'none'} onChange={() => setPasswordMode('none')} /><span><strong>Do not change</strong><small>Leave the current password untouched.</small></span></label>
                    <label className={passwordMode === 'reset' ? 'selected' : ''}><input type="radio" name="passwordMode" checked={passwordMode === 'reset'} onChange={() => setPasswordMode('reset')} /><span><strong>Send password reset</strong><small>Firebase emails a secure reset link when you save.</small></span></label>
                    <label className={passwordMode === 'set' ? 'selected' : ''}><input type="radio" name="passwordMode" checked={passwordMode === 'set'} onChange={() => setPasswordMode('set')} /><span><strong>Set a new password</strong><small>Set a temporary password and sign the user out everywhere.</small></span></label>
                    {passwordMode === 'set' && <><div className="user-password-fields"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (8+ characters)" /><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" /></div><label className="show-new-password"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} /> Show the new password while typing</label></>}
                  </div> : <div className="user-editor-readonly"><strong>Password protected</strong><span>Your role can view account information but cannot reset or replace user passwords.</span></div>}
                  <div className="user-editor-action-card"><div><strong>Active sessions</strong><span>Force every device to authenticate again.</span></div><button type="button" disabled={!capabilities.revokeSessions || ROLE_RANK[editingUser.role] >= ROLE_RANK[role]} onClick={() => act(editingUser, 'revoke_sessions')}>Sign out all sessions</button></div>
                </section>
                <section className="user-editor-section"><h3>Account metadata</h3>
                  <div className="user-editor-meta"><div><span>Account created</span><b>{dateValue(editingUser.createdAt)}</b></div><div><span>Last sign-in</span><b>{dateValue(editingUser.lastSignInAt)}</b></div><div><span>Account status</span><b className={editingUser.disabled ? 'status-danger' : 'status-good'}>{editingUser.disabled ? (editingUser.banPermanent ? 'Permanently banned' : `Banned · ${Math.max(1, Math.ceil((editingUser.banUntilMs - Date.now()) / 60000))} minutes left`) : 'Active'}</b></div><div><span>Sign-in methods</span><b>{editingUser.providers?.join(', ') || 'Email/password'}</b></div></div>
                </section>
              </>}
              {editorTab === 'moderation' && <>
                <section className="user-editor-section danger-zone"><h3>Moderation actions</h3><p>Every action requires a reason and is recorded in the staff audit log.</p>
                  <div className="user-editor-actions">
                    {capabilities.warnUsers && ROLE_RANK[editingUser.role] < ROLE_RANK[role] && <button type="button" onClick={() => act(editingUser, 'warn')}>Issue warning</button>}
                    {((editingUser.disabled && capabilities.unbanUsers) || (!editingUser.disabled && capabilities.banUsers)) && ROLE_RANK[editingUser.role] < ROLE_RANK[role] && <button type="button" onClick={() => act(editingUser, editingUser.disabled ? 'unban' : 'ban')}>{editingUser.disabled ? 'Unban account' : 'Ban account'}</button>}
                    {capabilities.revokeSessions && ROLE_RANK[editingUser.role] < ROLE_RANK[role] && <button type="button" onClick={() => act(editingUser, 'revoke_sessions')}>Revoke sessions</button>}
                    {capabilities.deleteUsers && ROLE_RANK[editingUser.role] < ROLE_RANK[role] && editingUser.role !== 'owner' && <button type="button" className="danger" onClick={() => act(editingUser, 'delete')}>Delete account</button>}
                    {ROLE_RANK[editingUser.role] >= ROLE_RANK[role] && <span className="user-editor-protected">Equal and higher roles are protected from moderation actions.</span>}
                  </div>
                </section>
                <section className="user-editor-section"><h3>Moderation summary</h3>
                  <div className="user-editor-meta"><div><span>Current status</span><b>{editingUser.disabled ? 'Banned' : 'Active'}</b></div><div><span>Assigned access</span><b>{editingUser.role}{editingUser.premium ? ' + Premium' : ''}</b></div></div>
                  <p className="user-editor-help">Warnings issued here are delivered to the user and remain available in the staff audit log.</p>
                </section>
              </>}
            </div>
            <footer className="user-editor-footer"><button type="button" onClick={() => setEditingUser(null)}>Cancel</button><button type="button" className="primary" disabled={savingUser || editingProtected || !(capabilities.editUsers || capabilities.manageCredentials || capabilities.manageRoles || capabilities.managePremium || capabilities.editAvatars)} onClick={saveUser}>{savingUser ? 'Saving…' : 'Save changes'}</button></footer>
          </section>
        </div>}
        {tab === 'audit' && !busy && <div className="staff-table-wrap"><table><thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{audit.map((a) => <tr key={a.id}><td>{dateValue(a.createdAt)}</td><td>{a.actorEmail}<small>{a.actorRole}</small></td><td>{a.action}</td><td className="staff-uid">{a.targetUid || '—'}</td><td><pre>{JSON.stringify(a.details || {}, null, 2)}</pre></td></tr>)}</tbody></table></div>}
      </main>
    </div>
  </div>;
}
