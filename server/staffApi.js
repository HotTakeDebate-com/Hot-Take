import express from 'express';
import admin from 'firebase-admin';

const OWNER_EMAIL = (process.env.HOT_TAKE_OWNER_EMAIL || 'justinself88@gmail.com').trim().toLowerCase();
const STAFF_ROLES = new Set(['moderator', 'admin', 'owner']);
const ROLE_LEVEL = { user: 0, moderator: 1, admin: 2, owner: 3 };
const PERMISSION_DEFAULTS = {
  user: {
    viewReports: false, respondReports: false, viewUsers: false, warnUsers: false,
    banUsers: false, revokeSessions: false, unbanUsers: false, viewAudit: false,
    manageRoles: false, managePremium: false, editUsers: false, manageCredentials: false, deleteUsers: false,
  },
  moderator: {
    viewReports: true, respondReports: true, viewUsers: true, warnUsers: true,
    banUsers: true, revokeSessions: true, unbanUsers: false, viewAudit: false,
    manageRoles: false, managePremium: false, editUsers: false, manageCredentials: false, deleteUsers: false,
  },
  admin: {
    viewReports: true, respondReports: true, viewUsers: true, warnUsers: true,
    banUsers: true, revokeSessions: true, unbanUsers: true, viewAudit: true,
    manageRoles: true, managePremium: true, editUsers: true, manageCredentials: true, deleteUsers: true,
  },
  owner: {
    viewReports: true, respondReports: true, viewUsers: true, warnUsers: true,
    banUsers: true, revokeSessions: true, unbanUsers: true, viewAudit: true,
    manageRoles: true, managePremium: true, editUsers: true, manageCredentials: true, deleteUsers: true,
  },
};
const PERMISSION_KEYS = new Set(Object.keys(PERMISSION_DEFAULTS.admin));


function roleOf(claims) {
  if (claims?.email?.toLowerCase() === OWNER_EMAIL) return 'owner';
  const role = String(claims?.role || 'user');
  return STAFF_ROLES.has(role) ? role : 'user';
}

async function requireStaff(req, res, next) {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign-in required.' });
  try {
    const claims = await admin.auth().verifyIdToken(match[1].trim(), true);
    const role = roleOf(claims);
    if (!STAFF_ROLES.has(role)) return res.status(403).json({ error: 'Staff access required.' });
    if (claims.email?.toLowerCase() === OWNER_EMAIL && claims.role !== 'owner') {
      const user = await admin.auth().getUser(claims.uid);
      await admin.auth().setCustomUserClaims(claims.uid, { ...(user.customClaims || {}), role: 'owner' });
    }
    req.staff = { uid: claims.uid, email: claims.email || '', role };
    next();
  } catch (e) {
    console.warn('[staff] auth failed', e?.message ?? e);
    res.status(401).json({ error: 'Staff session could not be verified.' });
  }
}

function requireRole(minimum) {
  return (req, res, next) => {
    if ((ROLE_LEVEL[req.staff?.role] || 0) < ROLE_LEVEL[minimum]) {
      return res.status(403).json({ error: minimum + ' access required.' });
    }
    next();
  };
}

async function permissionConfig() {
  const snap = await admin.firestore().collection('staff_config').doc('role_permissions').get();
  const stored = snap.exists ? (snap.data()?.roles || {}) : {};
  return Object.fromEntries(Object.entries(PERMISSION_DEFAULTS).map(([role, defaults]) => [
    role,
    { ...defaults, ...(stored[role] || {}), ...(role === 'owner' ? defaults : {}) },
  ]));
}

async function hasPermission(role, permission) {
  if (role === 'owner') return true;
  const config = await permissionConfig();
  return config[role]?.[permission] === true;
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!(await hasPermission(req.staff?.role, permission))) {
        return res.status(403).json({ error: 'Your role does not have permission to perform this action.' });
      }
      next();
    } catch (e) {
      console.warn('[staff] permission check failed', e?.message ?? e);
      res.status(500).json({ error: 'Could not verify staff permissions.' });
    }
  };
}

async function audit(action, actor, targetUid, details = {}) {
  await admin.firestore().collection('staff_audit').add({
    action,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    targetUid: targetUid || null,
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

export function attachStaffRoutes(app, { isAdminReady }) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Firebase Admin not configured.' });
    next();
  });
  router.use(requireStaff);

  router.get('/me', (req, res) => res.json({ ...req.staff, ownerEmail: OWNER_EMAIL }));

  router.get('/permissions', requireRole('admin'), async (_req, res) => {
    res.json({ permissions: await permissionConfig() });
  });

  router.post('/permissions', requireRole('admin'), async (req, res) => {
    const targetRole = String(req.body?.role || '');
    const permission = String(req.body?.permission || '');
    const enabled = req.body?.enabled === true;
    if (!['moderator', 'admin'].includes(targetRole)) {
      return res.status(400).json({ error: 'Only Moderator and Admin permissions can be changed.' });
    }
    if (!PERMISSION_KEYS.has(permission)) return res.status(400).json({ error: 'Unknown permission.' });
    const ref = admin.firestore().collection('staff_config').doc('role_permissions');
    await ref.set({
      roles: { [targetRole]: { [permission]: enabled } },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.staff.email,
    }, { merge: true });
    await audit('permission_change', req.staff, null, { role: targetRole, permission, enabled });
    res.json({ ok: true, permissions: await permissionConfig() });
  });

  router.get('/users', requirePermission('viewUsers'), async (req, res) => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined;
    const result = await admin.auth().listUsers(limit, pageToken);
    const users = result.users.map((u) => ({
      uid: u.uid,
      email: u.email || '',
      displayName: u.displayName || '',
      emailVerified: u.emailVerified,
      disabled: u.disabled,
      providers: u.providerData.map((p) => p.providerId),
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
      role: u.email?.toLowerCase() === OWNER_EMAIL ? 'owner' : (u.customClaims?.role || 'user'),
      premium: u.customClaims?.premium === true,
    }));
    res.json({ users, pageToken: result.pageToken || null, capabilities: (await permissionConfig())[req.staff.role] || {} });
  });

  router.post('/users/:uid/update', requirePermission('viewUsers'), async (req, res) => {
    const uid = String(req.params.uid);
    const target = await admin.auth().getUser(uid);
    const isOwner = target.email?.toLowerCase() === OWNER_EMAIL;
    const targetRole = isOwner ? 'owner' : (target.customClaims?.role || 'user');
    if (req.staff.role !== 'owner' && ROLE_LEVEL[targetRole] >= ROLE_LEVEL[req.staff.role]) {
      return res.status(403).json({ error: 'You cannot edit an equal or higher role.' });
    }
    if (isOwner && req.staff.role !== 'owner') {
      return res.status(403).json({ error: 'Owner account is protected.' });
    }
    const requestedDisplayName = String(req.body?.displayName || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    const wantsProfileChange = requestedDisplayName !== String(target.displayName || '');
    if (wantsProfileChange && !(await hasPermission(req.staff.role, 'editUsers'))) {
      return res.status(403).json({ error: 'Your role cannot edit user profile details.' });
    }
    const wantsCredentialChange = (
      (typeof req.body?.email === 'string' && req.body.email.trim().toLowerCase() !== String(target.email || '').toLowerCase())
      || (typeof req.body?.emailVerified === 'boolean' && req.body.emailVerified !== target.emailVerified)
    );
    if (wantsCredentialChange && !(await hasPermission(req.staff.role, 'manageCredentials'))) {
      return res.status(403).json({ error: 'Your role cannot change email or verification settings.' });
    }
    const displayName = requestedDisplayName;
    if (!displayName) return res.status(400).json({ error: 'Display name is required.' });

    const requestedEmail = String(req.body?.email || target.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    const emailChanged = requestedEmail !== String(target.email || '').toLowerCase();
    if (isOwner && emailChanged) {
      return res.status(400).json({ error: 'The protected Owner email cannot be changed here.' });
    }
    const emailVerified = emailChanged
      ? false
      : (typeof req.body?.emailVerified === 'boolean' ? req.body.emailVerified : target.emailVerified);

    const updated = await admin.auth().updateUser(uid, {
      displayName,
      email: requestedEmail,
      emailVerified,
    });
    if (emailChanged) await admin.auth().revokeRefreshTokens(uid);
    await audit('user_update', req.staff, uid, {
      displayName,
      emailVerified,
      previousEmail: target.email || null,
      email: updated.email || null,
      emailChanged,
    });
    res.json({
      ok: true,
      user: {
        uid: updated.uid,
        displayName: updated.displayName || '',
        email: updated.email || '',
        emailVerified: updated.emailVerified,
      },
    });
  });

  router.post('/users/:uid/password', requirePermission('manageCredentials'), async (req, res) => {
    const uid = String(req.params.uid);
    const target = await admin.auth().getUser(uid);
    const targetRole = target.email?.toLowerCase() === OWNER_EMAIL ? 'owner' : (target.customClaims?.role || 'user');
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'The protected Owner password cannot be changed from the Admin panel.' });
    }
    if (ROLE_LEVEL[targetRole] >= ROLE_LEVEL[req.staff.role]) {
      return res.status(403).json({ error: 'You cannot change the password of an equal or higher role.' });
    }
    const password = String(req.body?.password || '');
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'The new password must be between 8 and 128 characters.' });
    }
    await admin.auth().updateUser(uid, { password });
    await admin.auth().revokeRefreshTokens(uid);
    await audit('password_set', req.staff, uid, { targetEmail: target.email || null });
    res.json({ ok: true });
  });

  router.get('/reports', requirePermission('viewReports'), async (req, res) => {
    const snap = await admin.firestore().collection('reports').orderBy('createdAt', 'desc').limit(200).get();
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const uids = [...new Set(reports.flatMap((report) => [report.reporterUid, report.peerUid]).filter(Boolean))];
    const emailByUid = new Map();
    for (let index = 0; index < uids.length; index += 100) {
      const batch = await admin.auth().getUsers(uids.slice(index, index + 100).map((uid) => ({ uid })));
      batch.users.forEach((user) => emailByUid.set(user.uid, user.email || ''));
    }
    res.json({
      reports: reports.map((report) => ({
        ...report,
        reporterEmail: report.reporterEmail || emailByUid.get(report.reporterUid) || '',
        reportedEmail: report.reportedEmail || emailByUid.get(report.peerUid) || '',
      })),
    });
  });

  router.post('/reports/:id/respond', requirePermission('respondReports'), async (req, res) => {
    const response = String(req.body?.response || '').trim().slice(0, 4000);
    const status = String(req.body?.status || 'responded');
    if (!response) return res.status(400).json({ error: 'Response required.' });
    if (!['open', 'reviewing', 'responded', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const ref = admin.firestore().collection('reports').doc(String(req.params.id));
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Report not found.' });
    await ref.set({
      status,
      staffResponse: response,
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      respondedBy: req.staff.email,
    }, { merge: true });
    await audit('report_response', req.staff, null, { reportId: req.params.id, status });
    res.json({ ok: true });
  });

  router.post('/users/:uid/action', requireRole('moderator'), async (req, res) => {
    const uid = String(req.params.uid);
    const action = String(req.body?.action || '');
    const reason = String(req.body?.reason || '').trim().slice(0, 2000);
    if (!reason) return res.status(400).json({ error: 'A reason is required.' });
    const permissionForAction = {
      warn: 'warnUsers', ban: 'banUsers', unban: 'unbanUsers',
      revoke_sessions: 'revokeSessions', delete: 'deleteUsers',
    }[action];
    if (!permissionForAction || !(await hasPermission(req.staff.role, permissionForAction))) {
      return res.status(403).json({ error: 'Your role does not have permission to perform this action.' });
    }
    const target = await admin.auth().getUser(uid);
    const targetRole = target.email?.toLowerCase() === OWNER_EMAIL ? 'owner' : (target.customClaims?.role || 'user');
    if (ROLE_LEVEL[targetRole] >= ROLE_LEVEL[req.staff.role]) {
      return res.status(403).json({ error: 'You cannot punish an equal or higher role.' });
    }
    if (action === 'warn') {
      await admin.firestore().collection('user_warnings').add({
        uid, email: target.email || null, reason,
        issuedBy: req.staff.email, issuedByRole: req.staff.role,
        acknowledged: false, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'ban') {
      await admin.auth().updateUser(uid, { disabled: true });
      await admin.auth().revokeRefreshTokens(uid);
    } else if (action === 'unban') {
      if (ROLE_LEVEL[req.staff.role] < ROLE_LEVEL.admin) return res.status(403).json({ error: 'Admin access required.' });
      await admin.auth().updateUser(uid, { disabled: false });
    } else if (action === 'revoke_sessions') {
      await admin.auth().revokeRefreshTokens(uid);
    } else if (action === 'delete') {
      if (ROLE_LEVEL[req.staff.role] < ROLE_LEVEL.admin) return res.status(403).json({ error: 'Admin access required.' });
      await admin.auth().deleteUser(uid);
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }
    await audit(action, req.staff, uid, { reason, targetEmail: target.email || null });
    res.json({ ok: true });
  });

  router.post('/users/:uid/role', requireRole('admin'), async (req, res) => {
    const uid = String(req.params.uid);
    if (uid === req.staff.uid) return res.status(400).json({ error: 'You cannot change your own role.' });
    const role = String(req.body?.role || 'user');
    const premium = role === 'user' && req.body?.premium === true;
    if (!['user', 'moderator', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    const target = await admin.auth().getUser(uid);
    if (target.email?.toLowerCase() === OWNER_EMAIL) return res.status(400).json({ error: 'Owner role is protected.' });
    const currentRole = target.customClaims?.role || 'user';
    if (req.staff.role !== 'owner' && ROLE_LEVEL[currentRole] >= ROLE_LEVEL[req.staff.role]) {
      return res.status(403).json({ error: 'You cannot change the access of an equal or higher role.' });
    }
    const currentPremium = target.customClaims?.premium === true;
    if (role !== currentRole && !(await hasPermission(req.staff.role, 'manageRoles'))) {
      return res.status(403).json({ error: 'Your role cannot manage roles.' });
    }
    if (premium !== currentPremium && !(await hasPermission(req.staff.role, 'managePremium'))) {
      return res.status(403).json({ error: 'Your role cannot manage Premium memberships.' });
    }
    await admin.auth().setCustomUserClaims(uid, { ...(target.customClaims || {}), role, premium });
    await admin.auth().revokeRefreshTokens(uid);
    await audit('role_change', req.staff, uid, { role, premium, targetEmail: target.email || null });
    res.json({ ok: true, role, premium });
  });

  router.get('/audit', requirePermission('viewAudit'), async (_req, res) => {
    const snap = await admin.firestore().collection('staff_audit').orderBy('createdAt', 'desc').limit(300).get();
    res.json({ audit: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  });

  app.use('/api/staff', router);
}
