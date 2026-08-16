import express from 'express';
import admin from 'firebase-admin';

const OWNER_EMAIL = (process.env.HOT_TAKE_OWNER_EMAIL || 'justinself88@gmail.com').trim().toLowerCase();
const STAFF_ROLES = new Set(['moderator', 'admin', 'owner']);
const ROLE_LEVEL = { user: 0, moderator: 1, admin: 2, owner: 3 };
const PERMISSION_DEFAULTS = {
  user: {
    viewReports: false, respondReports: false, deleteReports: false, viewUsers: false, warnUsers: false,
    banUsers: false, revokeSessions: false, unbanUsers: false, viewAudit: false, viewPunishments: false,
    manageRoles: false, managePremium: false, manageNews: false, editUsers: false, editAvatars: false, manageCredentials: false, deleteUsers: false,
  },
  moderator: {
    viewReports: true, respondReports: true, deleteReports: true, viewUsers: true, warnUsers: true,
    banUsers: true, revokeSessions: true, unbanUsers: false, viewAudit: false, viewPunishments: true,
    manageRoles: false, managePremium: false, editUsers: false, editAvatars: true, manageCredentials: false, deleteUsers: false,
  },
  admin: {
    viewReports: true, respondReports: true, deleteReports: true, viewUsers: true, warnUsers: true,
    banUsers: true, revokeSessions: true, unbanUsers: true, viewAudit: true, viewPunishments: true,
    manageRoles: true, managePremium: true, manageNews: true, editUsers: true, editAvatars: true, manageCredentials: true, deleteUsers: true,
  },
  owner: {
    viewReports: true, respondReports: true, deleteReports: true, viewUsers: true, warnUsers: true,
    banUsers: true, revokeSessions: true, unbanUsers: true, viewAudit: true, viewPunishments: true,
    manageRoles: true, managePremium: true, manageNews: true, editUsers: true, editAvatars: true, manageCredentials: true, deleteUsers: true,
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

const INITIAL_WHATS_HOT_STORY = {
  title: 'Candace Owens vs. Andrew Wilson',
  slug: 'candace-owens-vs-andrew-wilson-2026-08-14',
  category: 'Latest debate',
  summary: 'Candace Owens and Andrew Wilson meet for a long-form debate that has become a major topic across online debate communities.',
  body: 'Watch the full exchange, hear both sides in their own words, and form your own view.',
  videoUrl: 'https://www.youtube.com/watch?v=aPOyk1i2LOc&t=11251s',
  videoId: 'aPOyk1i2LOc',
  startSeconds: 11251,
  eventDate: '2026-08-14',
  status: 'published',
  featured: true,
};

function storyTimestamp(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value._seconds) return value._seconds * 1000;
  return 0;
}

function parseYouTubeVideo(value) {
  const input = String(value || '').trim();
  if (!input) return { videoUrl: '', videoId: '', startSeconds: 0 };
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Enter a valid YouTube URL.');
  }
  const host = parsed.hostname.replace(/^www\./, '');
  let videoId = '';
  if (host === 'youtu.be') videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
  if (host.endsWith('youtube.com')) {
    videoId = parsed.searchParams.get('v') || '';
    if (!videoId && parsed.pathname.startsWith('/embed/')) videoId = parsed.pathname.split('/')[2] || '';
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error('The YouTube video ID is invalid.');
  const rawStart = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '0';
  let startSeconds = Number(String(rawStart).replace(/s$/i, ''));
  if (!Number.isFinite(startSeconds) || startSeconds < 0) startSeconds = 0;
  return { videoUrl: input, videoId, startSeconds: Math.floor(startSeconds) };
}

function serializeStory(doc) {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id || data.id,
    ...data,
    publishedAtMs: storyTimestamp(data.publishedAt),
    createdAtMs: storyTimestamp(data.createdAt),
    updatedAtMs: storyTimestamp(data.updatedAt),
  };
}

async function ensureInitialWhatsHotStory(db) {
  const ref = db.collection('whats_hot_stories').doc(INITIAL_WHATS_HOT_STORY.slug);
  const snap = await ref.get();
  if (!snap.exists) {
    const now = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({
      ...INITIAL_WHATS_HOT_STORY,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      createdBy: 'system migration',
      updatedBy: 'system migration',
    });
  }
}

function cleanStoryInput(body = {}) {
  const title = String(body.title || '').trim().slice(0, 180);
  const category = String(body.category || 'Debate').trim().slice(0, 80);
  const summary = String(body.summary || '').trim().slice(0, 800);
  const storyBody = String(body.body || '').trim().slice(0, 3000);
  const eventDate = String(body.eventDate || '').trim().slice(0, 10);
  const status = String(body.status || 'draft').trim();
  if (!title || !summary) throw new Error('Title and summary are required.');
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid story status.');
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('Use a valid story date.');
  const video = parseYouTubeVideo(body.videoUrl);
  return { title, category, summary, body: storyBody, eventDate, status, featured: body.featured === true, ...video };
}

export function attachStaffRoutes(app, { isAdminReady, io, customGames }) {
  const router = express.Router();

  app.get('/api/whats-hot', async (_req, res) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'News is temporarily unavailable.' });
    try {
      const db = admin.firestore();
      await ensureInitialWhatsHotStory(db);
      const snap = await db.collection('whats_hot_stories').limit(100).get();
      const stories = snap.docs
        .map(serializeStory)
        .filter((story) => story.status === 'published')
        .sort((a, b) => Number(b.featured) - Number(a.featured) || b.publishedAtMs - a.publishedAtMs || b.updatedAtMs - a.updatedAtMs);
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.json({ stories });
    } catch (error) {
      console.warn('[whats-hot] public list failed', error?.message ?? error);
      res.status(500).json({ error: 'Could not load What\'s Hot stories.' });
    }
  });

  router.use((req, res, next) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Firebase Admin not configured.' });
    next();
  });
  router.use(requireStaff);

  router.get('/me', (req, res) => res.json({ ...req.staff, ownerEmail: OWNER_EMAIL }));

  router.post('/access', async (req, res) => {
    await admin.firestore().collection('staff_access').doc(req.staff.uid).set({
      uid: req.staff.uid,
      email: req.staff.email,
      role: req.staff.role,
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
      accessCount: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
    res.json({ ok: true });
  });

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
    const profileByEmail = new Map();
    try {
      const profileRefs = result.users
        .filter((user) => user.email)
        .map((user) => admin.firestore().collection('publicProfiles').doc(user.email.toLowerCase()));
      if (profileRefs.length) {
        const profileSnaps = await admin.firestore().getAll(...profileRefs);
        profileSnaps.forEach((profileSnap) => {
          if (profileSnap.exists) profileByEmail.set(profileSnap.id, profileSnap.data());
        });
      }
    } catch (profileError) {
      console.warn('[staff] profile pictures could not be loaded', profileError?.message ?? profileError);
    }
    const ratingByUid = new Map();
    try {
      for (let index = 0; index < result.users.length; index += 30) {
        const uids = result.users.slice(index, index + 30).map((user) => user.uid);
        if (!uids.length) continue;
        const ratingSnap = await admin.firestore().collection('userRatings').where('ratedUid', 'in', uids).get();
        ratingSnap.docs.forEach((ratingDoc) => {
          const data = ratingDoc.data();
          const uid = String(data?.ratedUid || '');
          const score = Number(data?.rating);
          if (!uid || !Number.isInteger(score) || score < 1 || score > 5) return;
          const summary = ratingByUid.get(uid) || { sum: 0, count: 0 };
          summary.sum += score;
          summary.count += 1;
          ratingByUid.set(uid, summary);
        });
      }
    } catch (ratingError) {
      console.warn('[staff] debate ratings could not be loaded', ratingError?.message ?? ratingError);
    }
    const banByUid = new Map();
    try {
      const banRefs = result.users.map((user) => admin.firestore().collection('user_bans').doc(user.uid));
      if (banRefs.length) {
        const banSnaps = await admin.firestore().getAll(...banRefs);
        banSnaps.forEach((banSnap) => {
          if (banSnap.exists) banByUid.set(banSnap.id, banSnap.data());
        });
      }
    } catch (banError) {
      console.warn('[staff] ban records could not be loaded', banError?.message ?? banError);
    }
    const nowMs = Date.now();
    const accessByUid = new Map();
    try {
      const staffAccessRefs = result.users
        .filter((user) => STAFF_ROLES.has(user.email?.toLowerCase() === OWNER_EMAIL ? 'owner' : (user.customClaims?.role || 'user')))
        .map((user) => admin.firestore().collection('staff_access').doc(user.uid));
      if (staffAccessRefs.length) {
        const staffAccessSnaps = await admin.firestore().getAll(...staffAccessRefs);
        staffAccessSnaps.forEach((accessSnap) => {
          if (accessSnap.exists) accessByUid.set(accessSnap.id, accessSnap.data());
        });
      }
    } catch (accessError) {
      console.warn('[staff] admin access timestamps could not be loaded', accessError?.message ?? accessError);
    }
    const onlineUids = new Set(
      [...(io?.sockets?.sockets?.values?.() || [])].map((socket) => socket.data?.uid).filter(Boolean)
    );
    const users = result.users.map((u) => {
      const ban = banByUid.get(u.uid) || null;
      const banUntilMs = ban?.banUntil?.toMillis?.() || null;
      const timedBanActive = ban?.active === true && ban?.permanent !== true && Number(banUntilMs) > nowMs;
      const rating = ratingByUid.get(u.uid) || { sum: 0, count: 0 };
      return ({
      uid: u.uid,
      email: u.email || '',
      displayName: u.displayName || '',
      emailVerified: u.emailVerified,
      disabled: u.disabled || timedBanActive,
      authDisabled: u.disabled,
      banPermanent: ban?.permanent === true || (u.disabled && !banUntilMs),
      banUntilMs,
      banReason: ban?.reason || '',
      bannedByRole: ban?.issuedByRole || '',
      providers: u.providerData.map((p) => p.providerId),
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
      lastAdminAccessAt: accessByUid.get(u.uid)?.lastAccessedAt || null,
      online: onlineUids.has(u.uid),
      role: u.email?.toLowerCase() === OWNER_EMAIL ? 'owner' : (u.customClaims?.role || 'user'),
      premium: u.customClaims?.premium === true,
      avatarUrl: u.email ? String(profileByEmail.get(u.email.toLowerCase())?.avatarUrl || '') : '',
      starAverage: rating.count ? Number((rating.sum / rating.count).toFixed(2)) : null,
      starCount: rating.count,
    });
    });
    res.json({ users, pageToken: result.pageToken || null, capabilities: (await permissionConfig())[req.staff.role] || {} });
  });

  router.get('/dashboard-activity', requirePermission('viewUsers'), async (_req, res) => {
    const snapshot = await admin.firestore().collectionGroup('debates').limit(2000).get();
    const debatesByRoom = new Map();
    snapshot.docs.forEach((doc) => {
      const debate = doc.data() || {};
      const roomId = String(debate.roomId || doc.id);
      const startedAtMs = debate.startedAt?.toMillis?.() || 0;
      if (!startedAtMs) return;
      const existing = debatesByRoom.get(roomId);
      if (!existing || startedAtMs < existing.startedAtMs) debatesByRoom.set(roomId, { roomId, startedAtMs });
    });
    res.json({ debates: [...debatesByRoom.values()] });
  });

  router.get('/debates', requirePermission('viewReports'), async (_req, res) => {
    const snapshot = await admin.firestore().collectionGroup('debates').limit(2000).get();
    const activeRoomIds = new Set(
      [...(io?.sockets?.sockets?.values?.() || [])].map((socket) => socket.data?.roomId).filter(Boolean)
    );
    const debatesByRoom = new Map();
    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const roomId = String(data.roomId || doc.id);
      const current = debatesByRoom.get(roomId) || {};
      debatesByRoom.set(roomId, {
        ...current, roomId,
        topicId: data.topicId ?? current.topicId ?? null,
        statement: data.statement ?? current.statement ?? null,
        matchMode: data.matchMode || current.matchMode || 'quick',
        startedAt: data.startedAt || current.startedAt || null,
        reported: data.reported === true || current.reported === true,
        reportCount: Math.max(Number(data.reportCount || 0), Number(current.reportCount || 0)),
        active: activeRoomIds.has(roomId),
      });
    });
    const waitingRooms = [...(customGames?.values?.() || [])]
      .filter((game) => !game.activeRoomId)
      .map((game) => ({
        roomId: `lobby:${game.roomCode}`,
        roomCode: game.roomCode,
        topicId: 'custom',
        statement: game.statement,
        matchMode: 'custom',
        joinMode: game.joinMode,
        startedAt: game.createdAtMs,
        reported: false,
        reportCount: 0,
        active: false,
        waiting: true,
      }));
    const debates = [...waitingRooms, ...debatesByRoom.values()].sort((a, b) => {
      if (a.waiting !== b.waiting) return a.waiting ? -1 : 1;
      if (a.active !== b.active) return a.active ? -1 : 1;
      const time = (value) => value?.toMillis?.() || Number(value || 0);
      return time(b.startedAt) - time(a.startedAt);
    });
    res.json({ debates });
  });

  router.get('/debates/:roomId/details', requirePermission('viewReports'), async (req, res) => {
    const roomId = String(req.params.roomId || '');
    const debateSnapshot = await admin.firestore().collectionGroup('debates').limit(2000).get();
    const debateDocs = debateSnapshot.docs.filter((doc) => String(doc.data()?.roomId || doc.id) === roomId);
    if (!debateDocs.length) return res.status(404).json({ error: 'Debate not found.' });
    const debate = debateDocs[0].data() || {};
    const participantUids = [...new Set([debate.agreeUid, debate.disagreeUid].filter(Boolean))];
    const participantResult = participantUids.length
      ? await admin.auth().getUsers(participantUids.map((uid) => ({ uid })))
      : { users: [] };
    const participants = participantResult.users.map((user) => ({ uid: user.uid, email: user.email || 'Email unavailable' }));
    const messageSnapshot = await admin.firestore().collectionGroup('chat_messages').limit(2000).get();
    const rawMessages = messageSnapshot.docs
      .filter((doc) => doc.ref.parent.parent?.id === roomId)
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => Number(a.sentAtMs || 0) - Number(b.sentAtMs || 0));
    const messages = [...new Map(rawMessages.map((message) => [
      `${message.authorUid || message.authorSocketId}:${message.sentAtMs}:${message.text}`,
      message,
    ])).values()];
    res.json({ participants, messages });
  });

  router.post('/debates/:roomId/end', requirePermission('viewReports'), async (req, res) => {
    const roomId = String(req.params.roomId || '');
    const members = [...(io?.sockets?.adapter?.rooms?.get(roomId) || [])]
      .map((id) => io.sockets.sockets.get(id))
      .filter((member) => member?.data?.roomId === roomId);
    if (!members.length) return res.status(409).json({ error: 'That debate is no longer active.' });
    members.forEach((member) => {
      member.emit('peer-left', { endedByStaff: true });
      member.leave(roomId);
      member.data.roomId = null;
      member.data.topicId = null;
      member.data.side = null;
    });
    await audit('debate_ended', req.staff, null, { roomId, participantCount: members.length });
    res.json({ ok: true });
  });

  router.post('/users/:uid/update', requirePermission('viewUsers'), async (req, res) => {
    const uid = String(req.params.uid);
    const target = await admin.auth().getUser(uid);
    const isOwner = target.email?.toLowerCase() === OWNER_EMAIL;
    const targetRole = isOwner ? 'owner' : (target.customClaims?.role || 'user');
    if (ROLE_LEVEL[targetRole] >= ROLE_LEVEL[req.staff.role]) {
      return res.status(403).json({ error: 'You cannot edit an equal or higher role.' });
    }
    if (isOwner && req.staff.role !== 'owner') {
      return res.status(403).json({ error: 'Owner account is protected.' });
    }
    const requestedDisplayName = String(req.body?.displayName || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    const profileRef = target.email
      ? admin.firestore().collection('publicProfiles').doc(target.email.toLowerCase())
      : null;
    const profileSnap = profileRef ? await profileRef.get() : null;
    const currentAvatarUrl = profileSnap?.exists ? String(profileSnap.data()?.avatarUrl || '') : '';
    const requestedAvatarUrl = typeof req.body?.avatarUrl === 'string'
      ? req.body.avatarUrl.trim()
      : currentAvatarUrl;
    const avatarChanged = requestedAvatarUrl !== currentAvatarUrl;
    const validAvatarUrl = !requestedAvatarUrl
      || (/^data:image\/(?:png|jpeg|webp);base64,/i.test(requestedAvatarUrl) && requestedAvatarUrl.length <= 250000)
      || (/^https:\/\//i.test(requestedAvatarUrl) && requestedAvatarUrl.length <= 2048);
    if (!validAvatarUrl) return res.status(400).json({ error: 'Choose a valid JPG, PNG, or WebP profile picture.' });
    const displayNameChanged = requestedDisplayName !== String(target.displayName || '');
    if (displayNameChanged && !(await hasPermission(req.staff.role, 'editUsers'))) {
      return res.status(403).json({ error: 'Your role cannot edit user profile details.' });
    }
    if (avatarChanged && !(await hasPermission(req.staff.role, 'editAvatars'))) {
      return res.status(403).json({ error: 'Your role cannot edit profile pictures.' });
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
    const updatedProfileRef = admin.firestore().collection('publicProfiles').doc(requestedEmail);
    await updatedProfileRef.set({
      uid,
      displayName,
      avatarUrl: requestedAvatarUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await audit('user_update', req.staff, uid, {
      displayName,
      emailVerified,
      previousEmail: target.email || null,
      email: updated.email || null,
      emailChanged,
      avatarChanged,
    });
    res.json({
      ok: true,
      user: {
        uid: updated.uid,
        displayName: updated.displayName || '',
        email: updated.email || '',
        emailVerified: updated.emailVerified,
        avatarUrl: requestedAvatarUrl,
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
      capabilities: (await permissionConfig())[req.staff.role] || {},
    });
  });

  router.delete('/reports/:id', requirePermission('deleteReports'), async (req, res) => {
    const reportId = String(req.params.id || '').trim();
    if (!reportId) return res.status(400).json({ error: 'Report ID is required.' });

    const reportRef = admin.firestore().collection('reports').doc(reportId);
    const reportSnap = await reportRef.get();
    if (!reportSnap.exists) return res.status(404).json({ error: 'Report not found.' });
    const report = reportSnap.data() || {};

    const auditRef = admin.firestore().collection('staff_audit').doc();
    const batch = admin.firestore().batch();
    batch.delete(reportRef);
    batch.set(auditRef, {
      action: 'report_deleted',
      actorUid: req.staff.uid,
      actorEmail: req.staff.email,
      actorRole: req.staff.role,
      targetUid: report.peerUid || null,
      details: {
        reportId,
        category: report.category || null,
        reporterUid: report.reporterUid || null,
        reporterEmail: report.reporterEmail || null,
        reportedUid: report.peerUid || null,
        reportedEmail: report.reportedEmail || null,
        roomId: report.roomId || null,
        previousStatus: report.status || 'open',
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    res.json({ ok: true, id: reportId });
  });

  router.post('/reports/:id/respond', requirePermission('respondReports'), async (req, res) => {
    const response = String(req.body?.response || '').trim().slice(0, 4000);
    const status = String(req.body?.status || 'responded');
    if (!response) return res.status(400).json({ error: 'Response required.' });
    if (!['open', 'reviewing', 'responded', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const ref = admin.firestore().collection('reports').doc(String(req.params.id));
    const reportSnap = await ref.get();
    if (!reportSnap.exists) return res.status(404).json({ error: 'Report not found.' });
    const report = reportSnap.data() || {};
    const batch = admin.firestore().batch();
    batch.set(ref, {
      status,
      staffResponse: response,
      respondedAt: admin.firestore.FieldValue.serverTimestamp(),
      respondedBy: req.staff.email,
    }, { merge: true });
    if (report.reporterUid) {
      const noticeRef = admin.firestore().collection('user_report_responses').doc();
      batch.set(noticeRef, {
        uid: report.reporterUid,
        reportId: String(req.params.id),
        message: response,
        issuedBy: req.staff.email,
        issuedByRole: req.staff.role,
        acknowledged: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    await audit('report_response', req.staff, null, { reportId: req.params.id, status });
    res.json({ ok: true });
  });

  router.post('/users/:uid/action', requireRole('moderator'), async (req, res) => {
    const uid = String(req.params.uid);
    const action = String(req.body?.action || '');
    const reason = String(req.body?.reason || '').trim().slice(0, 2000);
    if (!reason) return res.status(400).json({ error: 'A reason is required.' });
    const durationMinutes = action === 'ban' ? Number(req.body?.durationMinutes ?? 0) : null;
    if (action === 'ban' && (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 525600)) {
      return res.status(400).json({ error: 'Ban length must be 0 (permanent) or a whole number of minutes up to 525600.' });
    }
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
      const permanent = durationMinutes === 0;
      const bannedAtMs = Date.now();
      const banUntilMs = permanent ? null : bannedAtMs + durationMinutes * 60_000;
      await admin.firestore().collection('user_bans').doc(uid).set({
        uid,
        email: target.email || null,
        reason,
        permanent,
        durationMinutes,
        active: true,
        issuedBy: req.staff.email,
        issuedByRole: req.staff.role,
        bannedAt: admin.firestore.FieldValue.serverTimestamp(),
        banUntil: banUntilMs ? admin.firestore.Timestamp.fromMillis(banUntilMs) : null,
      });
      await admin.auth().updateUser(uid, { disabled: permanent });
      if (permanent) await admin.auth().revokeRefreshTokens(uid);
      io?.sockets?.sockets?.forEach((socket) => {
        if (socket.data?.uid === uid) {
          socket.emit('account-banned', { permanent, banUntilMs, reason });
          socket.disconnect(true);
        }
      });
    } else if (action === 'unban') {
      if (ROLE_LEVEL[req.staff.role] < ROLE_LEVEL.admin) return res.status(403).json({ error: 'Admin access required.' });
      await admin.auth().updateUser(uid, { disabled: false });
      await admin.firestore().collection('user_bans').doc(uid).delete().catch(() => {});
    } else if (action === 'revoke_sessions') {
      await admin.auth().revokeRefreshTokens(uid);
    } else if (action === 'delete') {
      if (ROLE_LEVEL[req.staff.role] < ROLE_LEVEL.admin) return res.status(403).json({ error: 'Admin access required.' });
      await admin.auth().deleteUser(uid);
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }
    await audit(action, req.staff, uid, { reason, targetEmail: target.email || null, durationMinutes });
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

  router.get('/punishments', requirePermission('viewPunishments'), async (_req, res) => {
    const snap = await admin.firestore().collection('staff_audit').orderBy('createdAt', 'desc').get();
    const events = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((event) => event.action === 'warn' || event.action === 'ban');

    const infractionCounts = new Map();
    events.forEach((event) => {
      if (event.targetUid) infractionCounts.set(event.targetUid, (infractionCounts.get(event.targetUid) || 0) + 1);
    });

    const targetUids = [...new Set(events.map((event) => event.targetUid).filter(Boolean))];
    const emailByUid = new Map();
    for (let index = 0; index < targetUids.length; index += 100) {
      const result = await admin.auth().getUsers(targetUids.slice(index, index + 100).map((uid) => ({ uid })));
      result.users.forEach((user) => emailByUid.set(user.uid, user.email || ''));
    }

    const punishments = events.map((event) => {
      const issuedAtMs = event.createdAt?.toMillis?.() || null;
      const durationMinutes = event.action === 'ban' && Number.isFinite(Number(event.details?.durationMinutes))
        ? Number(event.details.durationMinutes)
        : null;
      const permanent = event.action === 'ban' && (durationMinutes === null || durationMinutes === 0);
      const expiresAtMs = event.action === 'ban' && durationMinutes > 0 && issuedAtMs
        ? issuedAtMs + durationMinutes * 60_000
        : null;
      return {
        id: event.id,
        type: event.action === 'warn' ? 'warning' : 'ban',
        issuedByEmail: event.actorEmail || '',
        issuedByRole: event.actorRole || 'moderator',
        punishedUid: event.targetUid || '',
        punishedEmail: event.details?.targetEmail || emailByUid.get(event.targetUid) || '',
        reason: event.details?.reason || 'No reason recorded.',
        issuedAt: event.createdAt || null,
        issuedAtMs,
        durationMinutes,
        permanent,
        expiresAtMs,
        infractionCount: event.targetUid ? (infractionCounts.get(event.targetUid) || 0) : 0,
      };
    });
    res.json({ punishments, capabilities: (await permissionConfig())[_req.staff.role] || {} });
  });

  router.get('/news', requirePermission('manageNews'), async (_req, res) => {
    const db = admin.firestore();
    await ensureInitialWhatsHotStory(db);
    const snap = await db.collection('whats_hot_stories').limit(200).get();
    const stories = snap.docs.map(serializeStory).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    res.json({ stories });
  });

  router.post('/news', requirePermission('manageNews'), async (req, res) => {
    let story;
    try { story = cleanStoryInput(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const db = admin.firestore();
    const ref = db.collection('whats_hot_stories').doc();
    const now = admin.firestore.FieldValue.serverTimestamp();
    if (story.featured && story.status === 'published') {
      const featured = await db.collection('whats_hot_stories').where('featured', '==', true).limit(50).get();
      await Promise.all(featured.docs.map((doc) => doc.ref.set({ featured: false, updatedAt: now }, { merge: true })));
    }
    await ref.set({
      ...story,
      createdAt: now,
      updatedAt: now,
      publishedAt: story.status === 'published' ? now : null,
      createdBy: req.staff.email,
      updatedBy: req.staff.email,
    });
    await audit('news_create', req.staff, null, { storyId: ref.id, title: story.title, status: story.status });
    res.status(201).json({ ok: true, id: ref.id });
  });

  router.post('/news/:id', requirePermission('manageNews'), async (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id || id.length > 180) return res.status(400).json({ error: 'Invalid story.' });
    let story;
    try { story = cleanStoryInput(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const db = admin.firestore();
    const ref = db.collection('whats_hot_stories').doc(id);
    const existing = await ref.get();
    if (!existing.exists) return res.status(404).json({ error: 'Story not found.' });
    const now = admin.firestore.FieldValue.serverTimestamp();
    if (story.featured && story.status === 'published') {
      const featured = await db.collection('whats_hot_stories').where('featured', '==', true).limit(50).get();
      await Promise.all(featured.docs.filter((doc) => doc.id !== id).map((doc) => doc.ref.set({ featured: false, updatedAt: now }, { merge: true })));
    }
    const wasPublished = existing.data()?.status === 'published';
    await ref.set({
      ...story,
      updatedAt: now,
      updatedBy: req.staff.email,
      publishedAt: story.status === 'published' ? (wasPublished ? existing.data().publishedAt || now : now) : existing.data().publishedAt || null,
    }, { merge: true });
    await audit('news_update', req.staff, null, { storyId: id, title: story.title, status: story.status });
    res.json({ ok: true, id });
  });

  router.get('/audit', requirePermission('viewAudit'), async (_req, res) => {
    const snap = await admin.firestore().collection('staff_audit').orderBy('createdAt', 'desc').limit(300).get();
    res.json({ audit: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  });

  app.use('/api/staff', router);
}
