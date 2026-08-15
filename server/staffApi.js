import express from 'express';
import admin from 'firebase-admin';

const OWNER_EMAIL = (process.env.HOT_TAKE_OWNER_EMAIL || 'justinself88@gmail.com').trim().toLowerCase();
const STAFF_ROLES = new Set(['moderator', 'admin', 'owner']);
const ROLE_LEVEL = { user: 0, moderator: 1, admin: 2, owner: 3 };

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

  router.get('/users', requireRole('moderator'), async (req, res) => {
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
    res.json({ users, pageToken: result.pageToken || null });
  });

  router.get('/reports', requireRole('moderator'), async (req, res) => {
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

  router.post('/reports/:id/respond', requireRole('moderator'), async (req, res) => {
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
    const target = await admin.auth().getUser(uid);
    const targetRole = target.email?.toLowerCase() === OWNER_EMAIL ? 'owner' : (target.customClaims?.role || 'user');
    if (ROLE_LEVEL[targetRole] >= ROLE_LEVEL[req.staff.role]) {
      return res.status(403).json({ error: 'You cannot punish an equal or higher role.' });
    }
    if (action === 'warn') {
      await admin.firestore().collection('user_warnings').add({
        uid, email: target.email || null, reason,
        issuedBy: req.staff.email, createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
    await admin.auth().setCustomUserClaims(uid, { ...(target.customClaims || {}), role, premium });
    await admin.auth().revokeRefreshTokens(uid);
    await audit('role_change', req.staff, uid, { role, premium, targetEmail: target.email || null });
    res.json({ ok: true, role, premium });
  });

  router.get('/audit', requireRole('admin'), async (_req, res) => {
    const snap = await admin.firestore().collection('staff_audit').orderBy('createdAt', 'desc').limit(300).get();
    res.json({ audit: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  });

  app.use('/api/staff', router);
}
