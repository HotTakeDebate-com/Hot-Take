import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase.js';
import { prepareProfileImage } from './profileImage.js';
import GenericAvatar from './GenericAvatar.jsx';
import { staffAccess, staffAction, staffAudit, staffDashboardActivity, staffDebateDetails, staffDebates, staffDeleteReport, staffEndDebate, staffPermissions, staffPunishments, staffQuickMatchStats, staffReports, staffRespond, staffRole, staffSetPassword, staffSetPermission, staffUpdateUser, staffUsers, staffNews, staffSaveNews, staffVerificationApplications, staffReviewVerification, staffDailyTake, staffSaveDailyTake } from './staffApi.js';
import IdentityBadges from './IdentityBadges.jsx';
import './DebateNetwork.css';
import './WhatsHotAdmin.css';
import './AdminIcons.css';

function AdminIcon({ type }) {
  const paths = {
    home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    reports: <><path d="M5 21V4" /><path d="M5 5h11l-1.5 3L17 12H5" /></>,
    debates: <><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
    statistics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20V7" /><path d="M2 20h22" /></>,
    users: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 21c.4-4.7 2.4-7 6-7s5.6 2.3 6 7M15 15c3.5.1 5.5 2.1 6 6" /></>,
    roles: <><path d="M12 3 5 6v5c0 4.5 2.7 8 7 10 4.3-2 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    audit: <><path d="M4 5v5h5" /><path d="M5.5 9A8 8 0 1 1 4 14" /><path d="M12 8v5l3 2" /></>,
    news: <><path d="M13 2 5 14h7l-1 8 8-12h-7l1-8Z" /></>,
    verification: <><path d="M12 3 5 6v6c0 4.2 2.6 7.3 7 9 4.4-1.7 7-4.8 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></>,
    punishments: <><path d="M12 3v18M6 6h12M4 9l-3 6h6L4 9ZM20 9l-3 6h6l-3-6ZM7 21h10" /></>,
    back: <><path d="m10 5-7 7 7 7" /><path d="M3 12h18" /></>,
    refresh: <><path d="M20 11a8 8 0 1 1-2.35-5.65L20 8" /><path d="M20 3v5h-5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
    alert: <><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 9v5M12 17.5h.01" /></>,
    close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
    member: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.8-5 3.3-7.5 7.5-7.5s6.7 2.5 7.5 7.5" /></>,
    moderator: <><path d="M12 3 5 6v6c0 4.2 2.6 7.3 7 9 4.4-1.7 7-4.8 7-9V6l-7-3Z" /><path d="M9 12h6M12 9v6" /></>,
    admin: <><path d="m4 8 4 3 4-6 4 6 4-3-2 11H6L4 8Z" /><path d="M6 19h12" /></>,
    super_admin: <><path d="m4 8 4 3 4-6 4 6 4-3-2 11H6L4 8Z" /><path d="M6 19h12M9 15h6" /></>,
    owner: <><path d="m12 3 2.3 4.7 5.2.8-3.8 3.7.9 5.3-4.6-2.5-4.6 2.5.9-5.3-3.8-3.7 5.2-.8L12 3Z" /></>,
  };
  return <svg className="admin-ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

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

function formatDuration(milliseconds) {
  if (milliseconds == null || !Number.isFinite(milliseconds) || milliseconds < 0) return 'Collecting data';
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatBanRemaining(milliseconds) {
  const totalMinutes = Math.max(0, Math.ceil(Number(milliseconds || 0) / 60_000));
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ');
}

const PAGE_SIZE = 20;
function Pagination({ page, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return <nav className="admin-pagination" aria-label="Pagination"><button disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page} of {pages} · {total} items</span><button disabled={page === pages} onClick={() => onChange(page + 1)}>Next</button></nav>;
}
function SpectatorVideo({ stream, label }) {
  return <div className="admin-spectator-feed"><video ref={(element) => { if (element && element.srcObject !== stream) { element.srcObject = stream; void element.play().catch(() => {}); } }} autoPlay playsInline /><span>{label}</span></div>;
}
function chatIdentityClass(authorUid, participants) {
  const index = participants.findIndex((participant) => participant.uid === authorUid);
  return index === 1 ? 'chat-user-two' : 'chat-user-one';
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

function ActivityGraph({ users, reports, debates, punishments }) {
  const registrations = dailySeries(users, 'createdAt');
  const submittedReports = dailySeries(reports, 'createdAt');
  const startedDebates = dailySeries(debates, 'startedAtMs');
  const bans = dailySeries(punishments.filter((item) => item.type === 'ban'), 'issuedAt');
  const maxValue = Math.max(4, ...registrations.map((item) => item.value), ...submittedReports.map((item) => item.value), ...startedDebates.map((item) => item.value), ...bans.map((item) => item.value));
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
      <header><div><p>STATISTICS</p><h2>30-day platform activity</h2></div><span>Registrations, reports, debates, and bans by day</span></header>
      <div className="admin-chart-wrap">
        <svg className="admin-activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily user registrations and submitted reports during the last 30 days">
          {gridValues.map((value) => <g key={value}>
            <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="admin-chart-grid" />
            <text x={left - 12} y={y(value) + 4} textAnchor="end" className="admin-chart-axis">{value}</text>
          </g>)}
          {labelIndexes.map((index) => <text key={registrations[index].key} x={x(index)} y={height - 13} textAnchor={index === 0 ? 'start' : index === 29 ? 'end' : 'middle'} className="admin-chart-axis">{registrations[index].label}</text>)}
          <polyline points={points(registrations)} className="admin-chart-line registrations" />
          <polyline points={points(submittedReports)} className="admin-chart-line reports" />
          <polyline points={points(startedDebates)} className="admin-chart-line debates" />
          <polyline points={points(bans)} className="admin-chart-line bans" />
          {registrations.map((item, index) => <circle key={'users-' + item.key} cx={x(index)} cy={y(item.value)} r="3" className="admin-chart-point registrations"><title>{item.label}: {item.value} registrations</title></circle>)}
          {submittedReports.map((item, index) => <circle key={'reports-' + item.key} cx={x(index)} cy={y(item.value)} r="3" className="admin-chart-point reports"><title>{item.label}: {item.value} reports</title></circle>)}
          {startedDebates.map((item, index) => <circle key={'debates-' + item.key} cx={x(index)} cy={y(item.value)} r="3" className="admin-chart-point debates"><title>{item.label}: {item.value} debates</title></circle>)}
          {bans.map((item, index) => <circle key={'bans-' + item.key} cx={x(index)} cy={y(item.value)} r="3" className="admin-chart-point bans"><title>{item.label}: {item.value} bans</title></circle>)}
        </svg>
        <div className="admin-chart-legend"><span><i className="registrations"/>User registrations</span><span><i className="reports"/>Reports submitted</span><span><i className="debates"/>Debates started</span><span><i className="bans"/>Bans issued</span></div>
      </div>
    </section>
  );
}

const ROLE_RANK = { user: 0, moderator: 1, admin: 2, super_admin: 3, owner: 4 };

const SITE_ROLES = [
  { id: 'user', name: 'User', description: 'Standard member access for debating and community features.' },
  { id: 'moderator', name: 'Moderator', description: 'Reviews reports and takes day-to-day safety actions.' },
  { id: 'admin', name: 'Admin', description: 'Full platform administration except the protected Owner account.' },
  { id: 'super_admin', name: 'Super Admin', description: 'Senior administration that can manage Admins but cannot alter the protected Owner.' },
  { id: 'owner', name: 'Owner', description: 'Protected highest-level access reserved for the site owner.' },
];

const ROLE_PERMISSIONS = [
  { group: 'Debates & account', permissions: [
    { name: 'Join quick-match debates', values: [true, true, true, true, true] },
    { name: 'Create and join custom debates', values: [true, true, true, true, true] },
    { name: 'Use debate text chat', values: [true, true, true, true, true] },
    { name: 'Edit own display name and bio', values: [true, true, true, true, true] },
    { name: 'Report a debate or user', values: [true, true, true, true, true] },
  ]},
  { group: 'Moderation', permissions: [
    { key: 'viewReports', name: 'View submitted reports', values: [false, true, true, true, true] },
    { key: 'respondReports', name: 'Respond to reports and update status', values: [false, true, true, true, true] },
    { key: 'deleteReports', name: 'Delete junk or invalid reports', values: [false, true, true, true, true] },
    { key: 'viewUsers', name: 'View member emails and Firebase UIDs', values: [false, true, true, true, true] },
    { key: 'warnUsers', name: 'Issue user warnings', values: [false, true, true, true, true] },
    { key: 'banUsers', name: 'Ban user accounts', values: [false, true, true, true, true] },
    { key: 'revokeSessions', name: 'Revoke active sign-in sessions', values: [false, true, true, true, true] },
    { key: 'unbanUsers', name: 'Unban user accounts', values: [false, false, true, true, true] },
  ]},
  { group: 'Administration', permissions: [
    { key: 'viewVerification', name: 'View verified-debater applications', values: [false, true, true, true, true] },
    { key: 'manageVerification', name: 'Approve, deny, and revoke verified status', values: [false, false, true, true, true] },
    { key: 'viewAudit', name: 'View staff audit logs', values: [false, false, true, true, true] },
    { key: 'viewPunishments', name: 'View the punishment log', values: [false, true, true, true, true] },
    { key: 'editUsers', name: 'Edit user profile details', values: [false, false, true, true, true] },
    { key: 'editAvatars', name: 'Edit profile pictures for lower roles', values: [false, true, true, true, true] },
    { key: 'manageCredentials', name: 'Change emails, verification, and passwords', values: [false, false, true, true, true] },
    { key: 'manageRoles', name: 'Assign User, Moderator, Admin, and Super Admin roles', values: [false, false, true, true, true] },
    { key: 'manageAdmins', name: 'Manage Admin accounts', values: [false, false, false, true, true] },
    { key: 'managePremium', name: 'Assign or remove Premium membership', values: [false, false, true, true, true] },
    { key: 'manageNews', name: 'Create and publish What’s Hot stories', values: [false, false, true, true, true] },
    { key: 'deleteUsers', name: 'Delete eligible user accounts', values: [false, false, true, true, true] },
    { name: 'Manage the protected Owner account', values: [false, false, false, false, true] },
  ]},
];

function permissionLabel(value) {
  return value ? 'Yes' : 'No';
}

const EMPTY_NEWS_STORY = {
  id: '',
  title: '',
  category: 'Featured debate',
  summary: '',
  body: '',
  videoUrl: '',
  eventDate: new Date().toISOString().slice(0, 10),
  status: 'draft',
  featured: false,
};

function NewsManager({ stories, onReload }) {
  const [draft, setDraft] = useState(EMPTY_NEWS_STORY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const edit = (story) => {
    setDraft({
      id: story.id || '',
      title: story.title || '',
      category: story.category || 'Debate',
      summary: story.summary || '',
      body: story.body || '',
      videoUrl: story.videoUrl || '',
      eventDate: story.eventDate || '',
      status: story.status || 'draft',
      featured: story.featured === true,
    });
    setMessage('');
  };

  const reset = () => {
    setDraft({ ...EMPTY_NEWS_STORY, eventDate: new Date().toISOString().slice(0, 10) });
    setMessage('');
  };

  const save = async (nextStatus = draft.status) => {
    setSaving(true);
    setMessage('');
    try {
      await staffSaveNews({ ...draft, status: nextStatus, featured: nextStatus === 'published' && draft.featured });
      setMessage(nextStatus === 'published' ? 'Story published successfully.' : nextStatus === 'archived' ? 'Story archived.' : 'Draft saved.');
      await onReload();
      if (!draft.id) reset();
      else setDraft((current) => ({ ...current, status: nextStatus }));
    } catch (error) {
      setMessage(error.message || 'Could not save the story.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-news-layout">
      <section className="admin-news-library">
        <div className="admin-news-section-head">
          <div><p>EDITORIAL LIBRARY</p><h2>What&apos;s Hot stories</h2></div>
          <button type="button" onClick={reset}>+ New story</button>
        </div>
        <div className="admin-news-list">
          {stories.map((story) => (
            <button type="button" key={story.id} className={draft.id === story.id ? 'active' : ''} onClick={() => edit(story)}>
              <span className={`admin-news-status ${story.status || 'draft'}`}>{story.status || 'draft'}</span>
              <strong>{story.title}</strong>
              <small>{story.category || 'Debate'} · {story.eventDate || 'No date'}{story.featured ? ' · Featured' : ''}</small>
            </button>
          ))}
          {!stories.length && <p className="admin-news-empty">No stories yet. Create the first one.</p>}
        </div>
      </section>

      <section className="admin-news-editor">
        <div className="admin-news-section-head">
          <div><p>{draft.id ? 'EDIT STORY' : 'NEW STORY'}</p><h2>{draft.id ? draft.title || 'Untitled story' : 'Create a debate story'}</h2></div>
          <span className={`admin-news-status ${draft.status}`}>{draft.status}</span>
        </div>

        <div className="admin-news-form">
          <label className="wide">Headline<input value={draft.title} maxLength="180" onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Who debated whom?" /></label>
          <label>Category<input value={draft.category} maxLength="80" onChange={(event) => setDraft({ ...draft, category: event.target.value })} placeholder="Latest debate" /></label>
          <label>Debate date<input type="date" value={draft.eventDate} onChange={(event) => setDraft({ ...draft, eventDate: event.target.value })} /></label>
          <label className="wide">Short summary<textarea rows="3" value={draft.summary} maxLength="800" onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="A neutral summary shown prominently on the page." /></label>
          <label className="wide">Additional context<textarea rows="4" value={draft.body} maxLength="3000" onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Optional context. Avoid declaring a winner." /></label>
          <label className="wide">YouTube URL<input type="url" value={draft.videoUrl} onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=…" /></label>
          <label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
          <label className="admin-news-check"><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /><span><strong>Feature this story</strong><small>It becomes the large lead story. Only one published story can be featured.</small></span></label>
        </div>

        {message && <p className="admin-news-message">{message}</p>}
        <div className="admin-news-actions">
          <button type="button" disabled={saving} onClick={() => save('draft')}>Save draft</button>
          {draft.id && draft.status !== 'archived' && <button type="button" disabled={saving} onClick={() => save('archived')}>Archive</button>}
          <button type="button" className="primary" disabled={saving} onClick={() => save('published')}>{saving ? 'Saving…' : 'Publish story'}</button>
        </div>
      </section>
    </div>
  );
}

function DailyTakeManager({ data, onReload }) {
  const [statement, setStatement] = useState(data?.take?.statement || '');
  const [topicId, setTopicId] = useState(data?.take?.topicId || data?.topics?.[0]?.id || '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setStatement(data?.take?.statement || ''); setTopicId(data?.take?.topicId || data?.topics?.[0]?.id || ''); }, [data]);
  const save = async () => {
    setSaving(true); setMessage('');
    try { await staffSaveDailyTake({ statement, topicId }); setMessage('The new Hot Take of the Day is live. Vote totals were reset for the new question.'); await onReload(); }
    catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  return <section className="admin-daily-take-editor">
    <header><div><p>HOMEPAGE FEATURE</p><h2>Hot Take of the Day</h2></div><span>{Number(data?.take?.agreeVotes || 0) + Number(data?.take?.disagreeVotes || 0)} current votes</span></header>
    <label>Daily statement<textarea rows="4" maxLength="280" value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
    <label>Quick Match topic<select value={topicId} onChange={(event) => setTopicId(event.target.value)}>{(data?.topics || []).map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select><small>The debate button sends voters into this existing Quick Match queue.</small></label>
    <div className="admin-daily-preview"><span>Homepage preview</span><blockquote>{statement || 'Enter a statement above.'}</blockquote><p><b>{data?.take?.agreeVotes || 0}</b> agree · <b>{data?.take?.disagreeVotes || 0}</b> disagree</p></div>
    {message && <p className="admin-daily-message">{message}</p>}
    <button className="admin-daily-publish" type="button" disabled={saving || statement.trim().length < 10 || !topicId} onClick={save}>{saving ? 'Publishing…' : 'Publish as today’s take'}</button>
  </section>;
}

export default function StaffPanel({ role, socket, rtcConfig, onBack, onAbout, onFaq, onSupport, onAccount, onSignOut, onPickLegal }) {
  const [tab, setTab] = useState('dashboard');
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [punishments, setPunishments] = useState([]);
  const [activeBans, setActiveBans] = useState([]);
  const [punishmentView, setPunishmentView] = useState('history');
  const [debates, setDebates] = useState([]);
  const [debateLog, setDebateLog] = useState([]);
  const [quickMatchStats, setQuickMatchStats] = useState([]);
  const [watchingDebate, setWatchingDebate] = useState(null);
  const [spectatorStreams, setSpectatorStreams] = useState({});
  const [spectatorError, setSpectatorError] = useState('');
  const [debateDetails, setDebateDetails] = useState({ participants: [], messages: [] });
  const [endingDebate, setEndingDebate] = useState(false);
  const spectatorConnectionsRef = useRef(new Map());
  const [page, setPage] = useState(1);
  const [newsStories, setNewsStories] = useState([]);
  const [dailyTake, setDailyTake] = useState({ take: null, topics: [] });
  const [verificationApplications, setVerificationApplications] = useState([]);
  const [punishmentNow, setPunishmentNow] = useState(Date.now());
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
        await staffAccess();
        const auditRequest = ['admin', 'super_admin', 'owner'].includes(role) ? staffAudit() : Promise.resolve({ audit: [] });
        const [reportData, userData, punishmentData, activityData, auditData] = await Promise.all([staffReports(), staffUsers(), staffPunishments(), staffDashboardActivity(), auditRequest]);
        setReports(reportData.reports || []);
        setUsers(userData.users || []);
        setPunishments(punishmentData.punishments || []);
        setActiveBans(punishmentData.activeBans || []);
        setDebates(activityData.debates || []);
        setAudit(auditData?.audit || []);
        setCapabilities(userData.capabilities || {});
      }
      if (tab === 'reports') {
        const reportData = await staffReports();
        setReports(reportData.reports || []);
        setCapabilities(reportData.capabilities || {});
      }
      if (tab === 'users' || tab === 'staff') { const userData = await staffUsers(); setUsers(userData.users || []); setCapabilities(userData.capabilities || {}); }
      if (tab === 'debates') setDebateLog((await staffDebates()).debates || []);
      if (tab === 'quickMatch') setQuickMatchStats((await staffQuickMatchStats()).topics || []);
      if (tab === 'roles') setPermissions((await staffPermissions()).permissions || {});
      if (tab === 'audit') setAudit((await staffAudit()).audit || []);
      if (tab === 'news') setNewsStories((await staffNews()).stories || []);
      if (tab === 'dailyTake') setDailyTake(await staffDailyTake());
      if (tab === 'verification') {
        const data = await staffVerificationApplications();
        setVerificationApplications(data.applications || []);
        setCapabilities(data.capabilities || {});
      }
      if (tab === 'punishments') {
        const punishmentData = await staffPunishments();
        setPunishments(punishmentData.punishments || []);
        setActiveBans(punishmentData.activeBans || []);
        setCapabilities(punishmentData.capabilities || {});
        setPunishmentNow(Date.now());
      }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, [tab]);
  useEffect(() => { setPage(1); }, [tab, query, punishmentView]);
  useEffect(() => {
    if (tab !== 'debates') return undefined;
    const timer = window.setInterval(() => { staffDebates().then((data) => setDebateLog(data.debates || [])).catch(() => {}); }, 10_000);
    return () => window.clearInterval(timer);
  }, [tab]);
  useEffect(() => {
    if (tab !== 'quickMatch') return undefined;
    const timer = window.setInterval(() => { staffQuickMatchStats().then((data) => setQuickMatchStats(data.topics || [])).catch(() => {}); }, 15_000);
    return () => window.clearInterval(timer);
  }, [tab]);
  useEffect(() => {
    if (tab !== 'punishments') return undefined;
    const timer = window.setInterval(() => setPunishmentNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [tab]);
  useEffect(() => {
    if (!socket) return undefined;
    const onSignal = async ({ participantId, roomId, type, payload }) => {
      let pc = spectatorConnectionsRef.current.get(participantId);
      if (!pc && type === 'offer') {
        pc = new RTCPeerConnection(rtcConfig);
        spectatorConnectionsRef.current.set(participantId, pc);
        const stream = new MediaStream();
        pc.ontrack = (event) => {
          const incoming = event.streams?.[0];
          if (incoming) setSpectatorStreams((current) => ({ ...current, [participantId]: incoming }));
          else { stream.addTrack(event.track); setSpectatorStreams((current) => ({ ...current, [participantId]: stream })); }
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) socket.emit('staff-spectator-return-signal', { participantId, roomId, type: 'ice', payload: event.candidate.toJSON() });
        };
      }
      if (!pc) return;
      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('staff-spectator-return-signal', { participantId, roomId, type: 'answer', payload: answer });
      } else if (type === 'ice' && payload) await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
    };
    const onError = ({ message }) => setSpectatorError(message || 'The debate could not be monitored.');
    socket.on('staff-spectator-signal', onSignal);
    socket.on('staff-spectator-error', onError);
    return () => { socket.off('staff-spectator-signal', onSignal); socket.off('staff-spectator-error', onError); };
  }, [socket, rtcConfig]);
  useEffect(() => {
    if (!watchingDebate) return undefined;
    let active = true;
    const refresh = () => staffDebateDetails(watchingDebate.roomId)
      .then((details) => { if (active) setDebateDetails(details); })
      .catch((error) => { if (active) setSpectatorError(error.message); });
    refresh();
    const timer = window.setInterval(refresh, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [watchingDebate]);

  const enterDebate = (debate) => {
    spectatorConnectionsRef.current.forEach((pc) => pc.close());
    spectatorConnectionsRef.current.clear();
    setSpectatorStreams({}); setSpectatorError(''); setDebateDetails({ participants: [], messages: [] }); setWatchingDebate(debate);
    window.setTimeout(() => socket?.emit('staff-watch-debate', { roomId: debate.roomId }), 0);
  };
  const exitDebate = () => {
    socket?.emit('staff-leave-debate');
    spectatorConnectionsRef.current.forEach((pc) => pc.close());
    spectatorConnectionsRef.current.clear();
    setSpectatorStreams({}); setWatchingDebate(null);
  };
  const endWatchedDebate = async () => {
    if (!watchingDebate || !window.confirm('End this debate for both participants? This action is recorded in the audit log.')) return;
    setEndingDebate(true); setSpectatorError('');
    try {
      await staffEndDebate(watchingDebate.roomId);
      exitDebate();
      setDebateLog((current) => current.map((item) => item.roomId === watchingDebate.roomId ? { ...item, active: false } : item));
    } catch (error) { setSpectatorError(error.message); }
    finally { setEndingDebate(false); }
  };

  const filteredUsers = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) => [u.email, u.displayName, u.uid, u.role].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [users, query]);
  const staffMembers = useMemo(() => users
    .filter((user) => ['moderator', 'admin', 'super_admin', 'owner'].includes(user.role))
    .sort((a, b) => (ROLE_RANK[b.role] - ROLE_RANK[a.role]) || String(a.displayName || a.email).localeCompare(String(b.displayName || b.email))), [users]);

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
    setUserDraft({ displayName: user.displayName || '', email: user.email || '', role: user.role || 'user', premium: user.premium === true, verifiedDebater: user.verifiedDebater === true, emailVerified: user.emailVerified === true, avatarUrl: user.avatarUrl || '' });
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
      await staffUpdateUser(editingUser.uid, { displayName: userDraft.displayName, email: userDraft.email, emailVerified: userDraft.emailVerified, verifiedDebater: userDraft.verifiedDebater, avatarUrl: userDraft.avatarUrl || '' });
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
      if (updated) setUserDraft({ displayName: updated.displayName || '', email: updated.email || '', role: updated.role || 'user', premium: updated.premium === true, verifiedDebater: updated.verifiedDebater === true, emailVerified: updated.emailVerified === true, avatarUrl: updated.avatarUrl || '' });
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

  const reviewVerification = async (application, action) => {
    const labels = { approve: 'approve', deny: 'deny', request_info: 'request more information from', revoke: 'revoke verification for' };
    if (!window.confirm(`Are you sure you want to ${labels[action]} ${application.email || application.uid}?`)) return;
    const note = action === 'approve' ? '' : (window.prompt('Staff note (shown in the application record):', application.staffNote || '') || '');
    setError('');
    try {
      await staffReviewVerification(application.uid, action, note);
      const data = await staffVerificationApplications();
      setVerificationApplications(data.applications || []);
    } catch (e) { setError(e.message); }
  };

  const openReports = reports.filter((r) => !['resolved', 'closed'].includes(r.status)).length;
  const bannedUsers = users.filter((u) => u.disabled).length;
  const staffUsersCount = users.filter((u) => ['moderator', 'admin', 'super_admin', 'owner'].includes(u.role)).length;
  const recentStaff = users
    .filter((u) => ['moderator', 'admin', 'super_admin', 'owner'].includes(u.role))
    .sort((a, b) => timestampValue(b.lastAdminAccessAt) - timestampValue(a.lastAdminAccessAt))
    .slice(0, 6);
  const onlineStaff = users.filter((user) => ['moderator', 'admin', 'super_admin', 'owner'].includes(user.role) && user.online);
  const quickMatchTotals = quickMatchStats.reduce((totals, topic) => ({
    queueJoins: totals.queueJoins + topic.queueJoins,
    matches: totals.matches + topic.matches,
    completedMatches: totals.completedMatches + topic.completedMatches,
    durationMs: totals.durationMs + (topic.averageDurationMs || 0) * topic.completedMatches,
    liveQueue: totals.liveQueue + topic.liveQueue.agree + topic.liveQueue.disagree,
  }), { queueJoins: 0, matches: 0, completedMatches: 0, durationMs: 0, liveQueue: 0 });
  const rankedQuickMatchStats = [...quickMatchStats].sort((a, b) => b.queueJoins - a.queueJoins);
  const largestQuickMatchCount = rankedQuickMatchStats[0]?.queueJoins || 0;
  const activeTemporaryBans = activeBans.filter((item) => !item.permanent && Number(item.expiresAtMs) > punishmentNow);
  const permanentBans = activeBans.filter((item) => item.permanent);
  const visiblePunishments = punishmentView === 'active' ? activeTemporaryBans : punishmentView === 'permanent' ? permanentBans : punishments;
  const pageSlice = (items) => items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activityRows = [
    { label: 'Moderation actions', source: audit, field: 'createdAt' },
    { label: 'Reports submitted', source: reports, field: 'createdAt' },
    { label: 'User registrations', source: users, field: 'createdAt' },
  ];
  const canManageAccount = (account) => Boolean(account)
    && ROLE_RANK[account.role] < ROLE_RANK[role]
    && (account.role !== 'admin' || capabilities.manageAdmins === true);
  const editingProtected = Boolean(editingUser && !canManageAccount(editingUser));

  return <div className="admin-console">
    <header className="admin-console-topbar">
      <button className="admin-console-home" onClick={onBack} aria-label="Back to Hot Take"><AdminIcon type="home" /></button>
      <img src="/hottake-logo-horizontal.png" alt="Hot Take" />
      <strong>Admin control panel</strong>
      <div><span>{role}</span><button onClick={onAccount}>Account</button><button onClick={onSignOut}>Sign out</button></div>
    </header>
    <div className="admin-console-body">
      <aside className="admin-console-sidebar">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><b><AdminIcon type="dashboard" /></b>Dashboard</button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}><b><AdminIcon type="reports" /></b>Reports <i>{openReports}</i></button>
        <button className={tab === 'debates' ? 'active' : ''} onClick={() => setTab('debates')}><b><AdminIcon type="debates" /></b>Active Debates</button>
        <button className={tab === 'quickMatch' ? 'active' : ''} onClick={() => setTab('quickMatch')}><b><AdminIcon type="statistics" /></b>Quick Match Stats</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}><b><AdminIcon type="users" /></b>Users</button>
        <button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}><b><AdminIcon type="roles" /></b>Staff</button>
        {['admin', 'super_admin', 'owner'].includes(role) && <button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}><b><AdminIcon type="roles" /></b>Roles & permissions</button>}
        {['admin', 'super_admin', 'owner'].includes(role) && <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}><b><AdminIcon type="audit" /></b>Audit logs</button>}
        {['admin', 'super_admin', 'owner'].includes(role) && <button className={tab === 'news' ? 'active' : ''} onClick={() => setTab('news')}><b><AdminIcon type="news" /></b>What&apos;s Hot</button>}
        {['admin', 'super_admin', 'owner'].includes(role) && <button className={tab === 'dailyTake' ? 'active' : ''} onClick={() => setTab('dailyTake')}><b><AdminIcon type="statistics" /></b>Daily Take</button>}
        <button className={tab === 'verification' ? 'active' : ''} onClick={() => setTab('verification')}><b><AdminIcon type="verification" /></b>Verification {verificationApplications.filter((item) => item.status === 'pending').length > 0 && <i>{verificationApplications.filter((item) => item.status === 'pending').length}</i>}</button>
        <button className={tab === 'punishments' ? 'active' : ''} onClick={() => setTab('punishments')}><b><AdminIcon type="punishments" /></b>Punishment Log</button>
        <span />
        <button onClick={onBack}><b><AdminIcon type="back" /></b>Return to website</button>
      </aside>
      <main className="admin-console-main">
        <div className="admin-console-title"><div><p>HOT TAKE ADMINISTRATION</p><h1>{tab === 'dashboard' ? 'Control panel' : tab === 'quickMatch' ? 'Quick Match Statistics' : tab === 'staff' ? 'Staff directory' : tab === 'roles' ? 'Roles & permissions' : tab === 'punishments' ? 'Punishment Log' : tab === 'news' ? 'What’s Hot' : tab === 'dailyTake' ? 'Hot Take of the Day' : tab === 'verification' ? 'Debater verification' : tab[0].toUpperCase() + tab.slice(1)}</h1></div><button onClick={load}><AdminIcon type="refresh" /> Refresh</button></div>
        {error && <div className="admin-notice error"><b><AdminIcon type="close" /></b>{error}</div>}
        {busy && <div className="admin-loading-state" role="status" aria-live="polite"><span className="admin-loading-spinner" aria-hidden="true" /><span>Loading administrative data…</span></div>}

        {tab === 'dashboard' && !busy && <>
          <div className="admin-notice warning"><b className="admin-notice-alert-icon"><AdminIcon type="alert" /></b><span><strong>{openReports} reports require attention.</strong> Review reports and document every moderation action.</span></div>
          {bannedUsers > 0 && <div className="admin-notice danger"><b><AdminIcon type="close" /></b><span><strong>{bannedUsers} user accounts are currently banned.</strong></span></div>}
          <section className="admin-search-box"><label>Search for users:</label><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Username, email, UID…" /><button onClick={() => setTab('users')}><AdminIcon type="search" /> Search</button></section>
          <section className="admin-stat-grid">
            <article><h2>Total users</h2><strong>{users.length}</strong><span>Loaded Firebase accounts</span></article>
            <article><h2>Open reports</h2><strong>{openReports}</strong><span>Awaiting staff review</span></article>
            <article><h2>Staff accounts</h2><strong>{staffUsersCount}</strong><span>Moderators, admins, owners</span></article>
            <article><h2>Banned users</h2><strong>{bannedUsers}</strong><span>Disabled accounts</span></article>
          </section>
          <section className="admin-dashboard-panels"><article><h2>Recent reports</h2>{reports.slice(0,5).map((r)=><button key={r.id} onClick={()=>setTab('reports')}><span>{r.category || 'Report'}</span><small>{r.status || 'open'} · {r.roomId || r.id}</small></button>)}</article><article><h2>System status</h2><p><i className="ok"/>Firebase Admin connected</p><p><i className="ok"/>Staff authorization enforced</p><p><i className="ok"/>Audit logging enabled</p></article></section>

          <ActivityGraph users={users} reports={reports} debates={debates} punishments={punishments} />

          <section className="admin-dashboard-section">
            <header><div><p>PLATFORM ANALYTICS</p><h2>Logged activity</h2></div><span>Rolling activity recorded by Hot Take</span></header>
            <div className="admin-activity-table">
              <div className="admin-activity-row heading"><b>Type</b><b>Last day</b><b>Last week</b><b>Last month</b></div>
              {activityRows.map((item) => <div className="admin-activity-row" key={item.label}><span>{item.label}</span><strong>{countSince(item.source, item.field, 1)}</strong><strong>{countSince(item.source, item.field, 7)}</strong><strong>{countSince(item.source, item.field, 30)}</strong></div>)}
            </div>
          </section>

          <section className="admin-lower-grid">
            <article className="admin-dashboard-section admin-online-staff">
              <header><div><p>LIVE</p><h2>Online staff</h2></div><span>{onlineStaff.length} online now</span></header>
              <div className="admin-staff-list">
                {onlineStaff.length ? onlineStaff.map((member) => <button key={member.uid} onClick={() => { setTab('users'); setQuery(member.email || member.uid); }}><span className={'admin-staff-avatar' + (member.avatarUrl ? ' has-image' : '')}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span><span><b>{member.displayName || member.email || 'Staff member'}</b><small>{member.role} · Active now</small></span><i className="ok" /></button>) : <p className="admin-empty-list">No staff members are online right now.</p>}
              </div>
            </article>
            <article className="admin-dashboard-section">
              <header><div><p>STAFF</p><h2>Recent staff activity</h2></div></header>
              <div className="admin-staff-list">
                {recentStaff.length ? recentStaff.map((member) => <button key={member.uid} onClick={() => { setTab('users'); setQuery(member.email || member.uid); }}><span className={'admin-staff-avatar' + (member.avatarUrl ? ' has-image' : '')}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span><span><b>{member.displayName || member.email || 'Staff member'}</b><small>{member.role} · Last admin access {member.lastAdminAccessAt ? dateValue(member.lastAdminAccessAt) : 'Not recorded yet'}</small></span><i className={member.online ? 'ok' : 'offline'} /></button>) : <p>No staff accounts were returned.</p>}
              </div>
            </article>
            <article className="admin-dashboard-section">
              <header><div><p>HEALTH</p><h2>System checks</h2></div><span>Checked when this dashboard loaded</span></header>
              <div className="admin-health-list">
                <p><i className="ok"/><span><b>Firebase Admin</b><small>User directory available</small></span><strong>Healthy</strong></p>
                <p><i className="ok"/><span><b>Moderation API</b><small>Reports and actions available</small></span><strong>Healthy</strong></p>
                <p><i className="ok"/><span><b>Authorization</b><small>Role permissions enforced server-side</small></span><strong>Healthy</strong></p>
                <p><i className={['admin', 'super_admin', 'owner'].includes(role) ? 'ok' : 'limited'}/><span><b>Audit trail</b><small>{['admin', 'super_admin', 'owner'].includes(role) ? 'Administrative log available' : 'Restricted for this role'}</small></span><strong>{['admin', 'super_admin', 'owner'].includes(role) ? 'Healthy' : 'Restricted'}</strong></p>
              </div>
            </article>
          </section>
        </>}

        {tab === 'quickMatch' && !busy && <section className="quick-match-analytics">
          <div className="admin-stat-grid quick-match-summary">
            <article><h2>Match searches</h2><strong>{quickMatchTotals.queueJoins.toLocaleString()}</strong><span>All topic and side selections</span></article>
            <article><h2>Matches found</h2><strong>{quickMatchTotals.matches.toLocaleString()}</strong><span>{quickMatchTotals.queueJoins ? Math.min(100, quickMatchTotals.matches * 2 / quickMatchTotals.queueJoins * 100).toFixed(1) : '0.0'}% of searches matched</span></article>
            <article><h2>Average duration</h2><strong>{formatDuration(quickMatchTotals.completedMatches ? quickMatchTotals.durationMs / quickMatchTotals.completedMatches : null)}</strong><span>Across {quickMatchTotals.completedMatches.toLocaleString()} completed matches</span></article>
            <article><h2>Waiting now</h2><strong>{quickMatchTotals.liveQueue}</strong><span>Users currently in Quick Match</span></article>
          </div>
          <section className="quick-match-popularity-chart">
            <header><div><p>ACTUAL SEARCH DATA</p><h2>Popularity by Quick Match choice</h2></div><span>Most popular to least popular · {quickMatchTotals.queueJoins.toLocaleString()} total searches</span></header>
            {quickMatchTotals.queueJoins > 0 ? <div className="quick-match-chart-rows">
              {rankedQuickMatchStats.map((topic, index) => {
                const share = topic.queueJoins / quickMatchTotals.queueJoins * 100;
                return <div className="quick-match-chart-row" key={topic.id}>
                  <b className="quick-match-chart-rank">#{index + 1}</b>
                  <div className="quick-match-chart-label"><strong>{topic.label}</strong><span>{share.toFixed(1)}% of all searches</span></div>
                  <div className="quick-match-chart-track"><i style={{ width: `${largestQuickMatchCount ? topic.queueJoins / largestQuickMatchCount * 100 : 0}%` }} /></div>
                  <strong className="quick-match-chart-value">{topic.queueJoins.toLocaleString()}</strong>
                </div>;
              })}
            </div> : <div className="quick-match-chart-empty">No Quick Match searches have been recorded yet. The chart will populate from real activity.</div>}
          </section>
          <div className="quick-match-topic-grid">
            {quickMatchStats.map((topic, index) => {
              const selections = topic.agreeSelections + topic.disagreeSelections;
              const agreePercent = selections ? Math.round(topic.agreeSelections / selections * 100) : 50;
              return <article className="quick-match-topic-card" key={topic.id}>
                <header><span>CHOICE {index + 1}</span><strong className={topic.matchRate >= 60 ? 'healthy' : topic.matchRate >= 35 ? 'watch' : 'low'}>{topic.matchRate}% match rate</strong></header>
                <h2>{topic.label}</h2>
                <div className="quick-match-topic-metrics">
                  <div><span>Matches found</span><b>{topic.matches.toLocaleString()}</b></div>
                  <div><span>Searches</span><b>{topic.queueJoins.toLocaleString()}</b></div>
                  <div><span>Avg. duration</span><b>{formatDuration(topic.averageDurationMs)}</b></div>
                  <div><span>Waiting now</span><b>{topic.liveQueue.agree + topic.liveQueue.disagree}</b></div>
                </div>
                <div className="quick-match-side-labels"><span>Agree {agreePercent}%</span><span>Disagree {100 - agreePercent}%</span></div>
                <div className="quick-match-side-bar" aria-label={`${agreePercent}% agree and ${100 - agreePercent}% disagree`}><i style={{ width: `${agreePercent}%` }} /></div>
                <footer><span>{topic.liveQueue.agree} agree waiting · {topic.liveQueue.disagree} disagree waiting</span><span>Last match: {dateValue(topic.lastMatchedAt)}</span></footer>
              </article>;
            })}
          </div>
          <p className="quick-match-analytics-note">Match rate compares successful participants with total searches. Duration tracking starts with this release; historical matches remain included in search and match totals.</p>
        </section>}

        {tab === 'reports' && !busy && <section className="staff-report-list">
          {reports.length ? pageSlice(reports).map((r) => <details className="staff-report-row" key={r.id}>
            <summary>
              <strong className={'staff-report-status status-' + String(r.status || 'open').toLowerCase()}>{r.status === 'reviewing' ? 'IN PROGRESS' : String(r.status || 'open').toUpperCase()}</strong>
              <span className="staff-report-category">{r.reportContext === 'profile' ? 'PROFILE · ' : ''}{r.category || 'Report'}</span>
              <span className="staff-report-users"><b>{r.reporterEmail || 'Unknown reporter'}</b><i>→</i><b>{r.reportedEmail || 'Unknown user'}</b></span>
              <span className="staff-report-preview">{r.details || 'No details supplied.'}</span>
              <time>{dateValue(r.createdAt)}</time>
              <span className="staff-report-toggle" aria-hidden="true">⌄</span>
            </summary>
            <div className="staff-report-expanded">
              <div className="staff-report-description"><span>Report details</span><p>{r.details || 'No details supplied.'}</p></div>
              {r.reportContext === 'profile' && r.profileSnapshot && <div className="staff-report-profile-snapshot"><span>Profile when reported</span><strong>{r.profileSnapshot.displayName || 'No display name'}</strong><p>{r.profileSnapshot.bio || 'No bio was present.'}</p><small>{r.profileSnapshot.avatarUrl ? `Profile picture: ${r.profileSnapshot.avatarUrl}` : 'No profile picture was present.'}</small></div>}
              <dl>
                <div><dt>Report ID</dt><dd>{r.id}</dd></div>
                <div><dt>Context</dt><dd>{r.reportContext === 'profile' ? 'Member profile' : r.roomId ? `Debate room ${r.roomId}` : '—'}</dd></div>
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
          <Pagination page={page} total={reports.length} onChange={setPage} />
        </section>}

        {tab === 'debates' && !busy && <section className="admin-debates-log">
          <div className="admin-debate-summary"><span><i className="active" />{debateLog.filter((item) => item.active && !item.reported).length} active</span><span><i className="reported" />{debateLog.filter((item) => item.reported).length} reported</span><span><i className="completed" />{debateLog.filter((item) => !item.active).length} completed</span></div>
          <div className="staff-table-wrap"><table><thead><tr><th>Status</th><th>Started</th><th>Debate</th><th>Mode</th><th>Reports</th><th>Monitor</th></tr></thead><tbody>{pageSlice(debateLog).map((debate) => <tr key={debate.roomId}><td><span className={'debate-status ' + (debate.reported ? 'reported' : debate.active ? 'active' : 'completed')}>{debate.reported ? '⚑ REPORTED' : debate.active ? 'ACTIVE' : 'COMPLETED'}</span></td><td>{dateValue(debate.startedAt)}</td><td><b>{debate.statement || debate.topicId || 'Debate'}</b><small className="staff-uid">{debate.roomCode ? `Code: ${debate.roomCode} · ${debate.joinMode === 'code' ? 'Private' : 'Public'}` : debate.roomId}</small></td><td>{debate.matchMode}</td><td>{debate.reportCount || 0}</td><td>{debate.active ? <button className="admin-monitor-button" onClick={() => enterDebate(debate)}>Enter anonymously</button> : <span className="staff-not-applicable">Ended</span>}</td></tr>)}</tbody></table></div>
          {!debateLog.length && <div className="admin-notice">No debates have been recorded yet.</div>}
          <Pagination page={page} total={debateLog.length} onChange={setPage} />
        </section>}

        {tab === 'users' && !busy && <section>
          <input className="staff-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, name, UID, or role…" />
          <div className="staff-table-wrap"><table><thead><tr><th>User</th><th>UID</th><th>Created / last login</th><th>Role</th><th>Membership</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{pageSlice(filteredUsers).map((u) => <tr className="staff-user-row" key={u.uid} onClick={() => openUserEditor(u)} tabIndex="0" onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && openUserEditor(u)}>
              <td><b>{u.displayName || 'No display name'}</b><small>{u.email}</small></td>
              <td className="staff-uid">{u.uid}</td>
              <td><small>{dateValue(u.createdAt)}<br />{dateValue(u.lastSignInAt)}</small></td>
              <td><b>{u.role === 'super_admin' ? 'Super Admin' : u.role === 'moderator' ? 'Moderator' : u.role}</b></td>
              <td>{u.role === 'user' && u.premium ? <span className="staff-premium">Premium</span> : <span className="staff-not-applicable">Standard</span>}</td>
              <td>{u.disabled ? <span className="staff-banned">{u.banPermanent ? 'PERMANENTLY BANNED' : `BANNED · ${Math.max(1, Math.ceil((u.banUntilMs - Date.now()) / 60000))}m left`}</span> : 'Active'}</td>
              <td className="staff-actions">
                {capabilities.warnUsers && canManageAccount(u) && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'warn'); }}>Warn</button>}
                {!u.disabled && capabilities.banUsers && canManageAccount(u) && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'ban'); }}>Ban</button>}
                {u.disabled && capabilities.unbanUsers && canManageAccount(u) && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'unban'); }}>Unban</button>}
                {capabilities.revokeSessions && canManageAccount(u) && <button type="button" onClick={(event) => { event.stopPropagation(); act(u, 'revoke_sessions'); }}>Sign out</button>}
              </td>
            </tr>)}</tbody>
          </table></div>
          <Pagination page={page} total={filteredUsers.length} onChange={setPage} />
        </section>}
        {tab === 'staff' && !busy && <section className="admin-staff-directory">
          <div className="admin-staff-summary">
            <article><strong>{staffMembers.length}</strong><span>Total staff</span></article>
            <article><strong>{staffMembers.filter((member) => member.role === 'owner').length}</strong><span>Owner</span></article>
            <article><strong>{staffMembers.filter((member) => member.role === 'super_admin').length}</strong><span>Super Admins</span></article>
            <article><strong>{staffMembers.filter((member) => member.role === 'admin').length}</strong><span>Admins</span></article>
            <article><strong>{staffMembers.filter((member) => member.role === 'moderator').length}</strong><span>Moderators</span></article>
          </div>
          <div className="staff-table-wrap"><table><thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Last admin access</th><th>Account created</th></tr></thead>
            <tbody>{staffMembers.map((member) => <tr key={member.uid}>
              <td><div className="admin-staff-person">{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <span>{String(member.displayName || member.email || '?').charAt(0).toUpperCase()}</span>}<div><b>{member.displayName || 'No display name'}</b><small>{member.email}</small></div></div></td>
              <td><span className={'admin-role-pill ' + member.role}>{member.role === 'owner' ? 'Owner' : member.role === 'super_admin' ? 'Super Admin' : member.role === 'admin' ? 'Admin' : 'Moderator'}</span></td>
              <td><span className={'admin-staff-presence ' + (member.online ? 'online' : 'offline')}><i />{member.online ? 'Online' : 'Offline'}</span></td>
              <td>{dateValue(member.lastAdminAccessAt)}</td>
              <td>{dateValue(member.createdAt)}</td>
            </tr>)}</tbody>
          </table></div>
          {!staffMembers.length && <div className="admin-notice">No staff accounts found.</div>}
        </section>}
        {tab === 'roles' && !busy && <section className="role-permissions">
          <div className="role-permissions-intro">
            <div><p>Select Yes or No to give or remove a permission. Changes apply to every account with that role. Premium remains a membership and is not a role.</p></div>
            <span>Saved in Firebase</span>
          </div>
          <div className="role-card-grid">
            {SITE_ROLES.map((siteRole) => <article key={siteRole.id} className={role === siteRole.id ? 'current' : ''}>
              <div className={'role-card-icon role-' + siteRole.id}><AdminIcon type={siteRole.id === 'user' ? 'member' : siteRole.id} /></div>
              <div><h2>{siteRole.name}</h2><p>{siteRole.description}</p>{role === siteRole.id && <small>Your current role</small>}</div>
            </article>)}
          </div>
          <div className="permission-table-wrap">
            <table className="permission-table">
              <thead><tr><th>Permission</th>{SITE_ROLES.map((siteRole) => <th key={siteRole.id}>{siteRole.name}</th>)}</tr></thead>
              <tbody>{ROLE_PERMISSIONS.map((section) => <Fragment key={section.group}>
                <tr className="permission-group"><th colSpan={SITE_ROLES.length + 1}>{section.group}</th></tr>
                {section.permissions.map((permission) => <tr key={permission.name}><td>{permission.name}{!permission.key && <small>Standard platform access</small>}</td>{SITE_ROLES.map((siteRole, index) => {
                  const value = permission.key ? (permissions[siteRole.id]?.[permission.key] ?? permission.values[index]) : permission.values[index];
                  const editable = role === 'owner' && Boolean(permission.key) && ['moderator', 'admin', 'super_admin'].includes(siteRole.id);
                  const id = siteRole.id + ':' + permission.key;
                  return <td key={siteRole.id}><button type="button" disabled={!editable || savingPermission === id} onClick={() => editable && togglePermission(siteRole.id, permission.key, !value)} className={'permission-value ' + (value ? 'allowed' : 'denied') + (editable ? ' editable' : '')}>{savingPermission === id ? '…' : value ? '✓' : '—'} {permissionLabel(value)}</button></td>;
                })}</tr>)}
              </Fragment>)}</tbody>
            </table>
          </div>
          <p className="permission-footnote">Only the Owner can edit role permissions. Owner access and standard debate rights remain permanently protected.</p>
        </section>}
        {editingUser && userDraft && <div className="user-editor-backdrop" onMouseDown={() => setEditingUser(null)}>
          <section className="user-editor" role="dialog" aria-modal="true" aria-label={'Manage ' + (editingUser.email || editingUser.uid)} onMouseDown={(event) => event.stopPropagation()}>
            <header className="user-editor-header">
              <div className={'user-editor-avatar' + (userDraft.avatarUrl ? ' has-image' : '')}>{userDraft.avatarUrl ? <img src={userDraft.avatarUrl} alt="" /> : <GenericAvatar />}</div>
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
                    <div className={'user-editor-avatar staff-avatar-preview' + (userDraft.avatarUrl ? ' has-image' : '')}>{userDraft.avatarUrl ? <img src={userDraft.avatarUrl} alt="Profile preview" /> : <GenericAvatar />}</div>
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
                  <div className="user-star-summary" aria-label={editingUser.starCount ? `${editingUser.starAverage} stars from ${editingUser.starCount} ratings` : 'No star ratings yet'}><span>Debate stars</span><div><b>{editingUser.starAverage == null ? '—' : Number(editingUser.starAverage).toFixed(2)}</b><i aria-hidden="true">★</i><small>{editingUser.starCount ? `${editingUser.starCount} rating${editingUser.starCount === 1 ? '' : 's'}` : 'No ratings yet'}</small></div></div>
                </section>
                <section className="user-editor-section"><h3>Role & membership</h3>
                  <label><span>Primary role</span><select value={userDraft.role} disabled={!capabilities.manageRoles || editingProtected} onChange={(event) => setUserDraft((draft) => ({ ...draft, role: event.target.value, premium: event.target.value === 'user' ? draft.premium : false }))}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option>{role === 'owner' && <option value="super_admin">Super Admin</option>}</select></label>
                  <label className="user-editor-check"><span>Premium</span><input type="checkbox" checked={userDraft.role === 'user' && userDraft.premium} disabled={!capabilities.managePremium || editingProtected || userDraft.role !== 'user' || editingUser.role === 'owner'} onChange={(event) => setUserDraft((draft) => ({ ...draft, premium: event.target.checked }))} /><b>Premium member</b></label>
                  <label className="user-editor-check"><span>Verified debater</span><input type="checkbox" checked={userDraft.verifiedDebater === true} disabled={!capabilities.manageVerification || editingProtected} onChange={(event) => setUserDraft((draft) => ({ ...draft, verifiedDebater: event.target.checked }))} /><b>{userDraft.verifiedDebater ? 'Verified status granted' : 'Not a verified debater'}</b><small>Admins, Super Admins, and the Owner can grant or revoke this status directly without an application.</small></label>
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
                  <div className="user-editor-action-card"><div><strong>Active sessions</strong><span>Force every device to authenticate again.</span></div><button type="button" disabled={!capabilities.revokeSessions || !canManageAccount(editingUser)} onClick={() => act(editingUser, 'revoke_sessions')}>Sign out all sessions</button></div>
                </section>
                <section className="user-editor-section"><h3>Account metadata</h3>
                  <div className="user-editor-meta"><div><span>Account created</span><b>{dateValue(editingUser.createdAt)}</b></div><div><span>Last sign-in</span><b>{dateValue(editingUser.lastSignInAt)}</b></div><div><span>Account status</span><b className={editingUser.disabled ? 'status-danger' : 'status-good'}>{editingUser.disabled ? (editingUser.banPermanent ? 'Permanently banned' : `Banned · ${Math.max(1, Math.ceil((editingUser.banUntilMs - Date.now()) / 60000))} minutes left`) : 'Active'}</b></div><div><span>Sign-in methods</span><b>{editingUser.providers?.join(', ') || 'Email/password'}</b></div></div>
                </section>
              </>}
              {editorTab === 'moderation' && <>
                <section className="user-editor-section danger-zone"><h3>Moderation actions</h3><p>Every action requires a reason and is recorded in the staff audit log.</p>
                  <div className="user-editor-actions">
                    {capabilities.warnUsers && canManageAccount(editingUser) && <button type="button" onClick={() => act(editingUser, 'warn')}>Issue warning</button>}
                    {((editingUser.disabled && capabilities.unbanUsers) || (!editingUser.disabled && capabilities.banUsers)) && canManageAccount(editingUser) && <button type="button" onClick={() => act(editingUser, editingUser.disabled ? 'unban' : 'ban')}>{editingUser.disabled ? 'Unban account' : 'Ban account'}</button>}
                    {capabilities.revokeSessions && canManageAccount(editingUser) && <button type="button" onClick={() => act(editingUser, 'revoke_sessions')}>Revoke sessions</button>}
                    {capabilities.deleteUsers && canManageAccount(editingUser) && editingUser.role !== 'owner' && <button type="button" className="danger" onClick={() => act(editingUser, 'delete')}>Delete account</button>}
                    {!canManageAccount(editingUser) && <span className="user-editor-protected">This role is protected from your account-management permissions.</span>}
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
        {tab === 'verification' && !busy && <section className="verification-admin-list">
          <div className="verification-admin-summary"><strong>{verificationApplications.filter((item) => item.status === 'pending').length}</strong><span>applications awaiting review</span><small>Moderators can review evidence. Only Admins and the Owner can change verification status.</small></div>
          {verificationApplications.length ? verificationApplications.map((application) => <article className="verification-admin-card" key={application.uid}>
            <header><div><h2>{application.displayName || application.email}<IdentityBadges verified={application.verifiedDebater} /></h2><p>{application.email}</p></div><span className={'verification-status status-' + application.status}>{String(application.status || 'pending').replace('_', ' ')}</span></header>
            <div className="verification-admin-evidence"><dl><div><dt>Platform</dt><dd>{application.platform || '—'}</dd></div><div><dt>Audience</dt><dd>{Number(application.followerCount || 0).toLocaleString()}</dd></div><div><dt>Submitted</dt><dd>{application.submittedAtMs ? new Date(application.submittedAtMs).toLocaleString() : '—'}</dd></div></dl><a href={application.profileUrl} target="_blank" rel="noreferrer">Open public profile ↗</a></div>
            <p className="verification-admin-explanation">{application.explanation || 'No explanation supplied.'}</p>
            {application.supportingLinks?.length > 0 && <div className="verification-admin-links">{application.supportingLinks.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer">Supporting evidence ↗</a>)}</div>}
            {application.staffNote && <blockquote><b>Staff note:</b> {application.staffNote}</blockquote>}
            {capabilities.manageVerification && <footer><button className="approve" onClick={() => reviewVerification(application, 'approve')}>Approve</button><button onClick={() => reviewVerification(application, 'request_info')}>Request information</button><button onClick={() => reviewVerification(application, 'deny')}>Deny</button>{application.verifiedDebater && <button className="danger" onClick={() => reviewVerification(application, 'revoke')}>Revoke</button>}</footer>}
          </article>) : <div className="admin-notice">No verification applications found.</div>}
        </section>}
        {tab === 'news' && !busy && <NewsManager stories={newsStories} onReload={load} />}
        {tab === 'dailyTake' && !busy && <DailyTakeManager data={dailyTake} onReload={load} />}

        {tab === 'punishments' && !busy && <section className="punishment-log">
          <div className="punishment-log-summary">
            <div><span>Total recorded infractions</span><strong>{punishments.length}</strong></div>
            <div><span>Active temporary bans</span><strong>{activeTemporaryBans.length}</strong></div>
            <div><span>Permanently banned</span><strong>{permanentBans.length}</strong></div>
          </div>
          <nav className="punishment-view-tabs" aria-label="Punishment log views">
            <button type="button" className={punishmentView === 'history' ? 'active' : ''} onClick={() => setPunishmentView('history')}>Full history <b>{punishments.length}</b></button>
            <button type="button" className={punishmentView === 'active' ? 'active' : ''} onClick={() => setPunishmentView('active')}>Active bans <b>{activeTemporaryBans.length}</b></button>
            <button type="button" className={punishmentView === 'permanent' ? 'active' : ''} onClick={() => setPunishmentView('permanent')}>Permanent bans <b>{permanentBans.length}</b></button>
          </nav>
          <div className="staff-table-wrap punishment-table"><table>
            <thead><tr><th>Issued</th><th>Punishment</th><th>Issued by</th><th>Punished user</th><th>Reason</th><th>Initial duration</th><th>Time remaining</th><th>Total infractions</th></tr></thead>
            <tbody>{pageSlice(visiblePunishments).map((item) => {
              const remainingMinutes = item.expiresAtMs ? Math.max(0, Math.ceil((item.expiresAtMs - punishmentNow) / 60000)) : null;
              const expired = item.type === 'ban' && !item.permanent && remainingMinutes === 0;
              return <tr key={item.id}>
                <td data-label="Issued"><b>{dateValue(item.issuedAt)}</b></td>
                <td data-label="Punishment"><span className={'punishment-type ' + item.type}>{item.type === 'warning' ? 'WARNING' : 'BAN'}</span></td>
                <td data-label="Issued by"><b>{item.issuedByEmail || 'Unknown staff'}</b><small>{item.issuedByRole}</small></td>
                <td data-label="Punished user"><b>{item.punishedEmail || 'Email unavailable'}</b><small>{item.punishedUid || '—'}</small></td>
                <td data-label="Reason" className="punishment-reason">{item.reason}</td>
                <td data-label="Initial duration">{item.type === 'warning'
                  ? <span className="punishment-time neutral">No expiration</span>
                  : item.permanent
                    ? <span className="punishment-time permanent">Permanent</span>
                    : <span className="punishment-time initial">{item.durationMinutes} minute{item.durationMinutes === 1 ? '' : 's'}</span>}</td>
                <td data-label="Time remaining">{item.type === 'warning'
                  ? <span className="punishment-time neutral">No expiration</span>
                  : item.permanent
                    ? <span className="punishment-time permanent">Permanent</span>
                    : expired
                      ? <span className="punishment-time expired">Expired</span>
                      : <><span className="punishment-time active">{formatBanRemaining(item.expiresAtMs - punishmentNow)}</span><small>Ends {new Date(item.expiresAtMs).toLocaleString()}</small></>}</td>
                <td data-label="Total infractions"><strong className="infraction-count">{item.infractionCount}</strong></td>
              </tr>;
            })}</tbody>
          </table></div>
          {!visiblePunishments.length && <div className="admin-notice">{punishmentView === 'active' ? 'No temporary bans are currently active.' : punishmentView === 'permanent' ? 'No users are permanently banned.' : 'No warnings or bans have been issued.'}</div>}
          <Pagination page={page} total={visiblePunishments.length} onChange={setPage} />
        </section>}

        {tab === 'audit' && !busy && <section><div className="staff-table-wrap"><table><thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Target</th><th>Details</th></tr></thead><tbody>{pageSlice(audit).map((a) => <tr key={a.id}><td>{dateValue(a.createdAt)}</td><td>{a.actorEmail}<small>{a.actorRole}</small></td><td>{a.action}</td><td className="staff-uid">{a.targetUid || '—'}</td><td><pre>{JSON.stringify(a.details || {}, null, 2)}</pre></td></tr>)}</tbody></table></div><Pagination page={page} total={audit.length} onChange={setPage} /></section>}

        {watchingDebate && <div className="admin-monitor-backdrop" onMouseDown={exitDebate}>
          <section className="admin-monitor-modal live" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p>LIVE · ANONYMOUS STAFF SPECTATOR</p><h2>{watchingDebate.statement || watchingDebate.topicId || 'Active debate'}</h2></div><button onClick={exitDebate} aria-label="Exit debate">×</button></header>
            <div className="admin-monitor-stage">
              <div className="admin-spectator-grid">{Object.values(spectatorStreams).map((stream, index) => <SpectatorVideo key={stream.id || index} stream={stream} label={'Debater ' + (index + 1)} />)}{!Object.keys(spectatorStreams).length && <div className="admin-spectator-connecting"><span className="admin-loading-spinner" /><b>Connecting to live debate…</b><small>Waiting for the debaters’ audio and video streams.</small></div>}</div>
              {spectatorError && <p className="admin-spectator-error">{spectatorError}</p>}
              <p>You are spectating silently. Your camera and microphone are not connected, and neither debater is notified.</p>
              <div className="admin-monitor-columns">
                <section><h3>Connected users</h3>{debateDetails.participants.map((participant) => <div className="admin-monitor-user" key={participant.uid}><b>{participant.email}</b><small>{participant.uid}</small></div>)}</section>
                <section><h3>Live chat log</h3><div className="admin-monitor-chat">{debateDetails.messages.map((message) => <div key={message.id}><b className={chatIdentityClass(message.authorUid, debateDetails.participants)}>{debateDetails.participants.find((participant) => participant.uid === message.authorUid)?.email || 'Debater'}</b><span>{message.text}</span><time>{message.sentAtMs ? new Date(message.sentAtMs).toLocaleTimeString() : ''}</time></div>)}{!debateDetails.messages.length && <p>No chat messages in this debate.</p>}</div></section>
              </div>
            </div>
            <footer><button onClick={exitDebate}>Exit debate</button><button className="danger" disabled={endingDebate} onClick={endWatchedDebate}>{endingDebate ? 'Ending…' : 'End debate for everyone'}</button></footer>
          </section>
        </div>}
      </main>
    </div>
  </div>;
}

