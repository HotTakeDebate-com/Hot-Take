import crypto from 'crypto';
import express from 'express';
import admin from 'firebase-admin';

/**
 * Operator-only REST API. Requires Firebase Admin + env HOT_TAKE_MODERATION_SECRET
 * (or legacy CHITCHAT_MODERATION_SECRET), min 16 chars.
 * Use HTTPS only in production. Rotate the secret if leaked.
 */

function timingSafeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function moderationAuth(req, res, next) {
  const secret =
    process.env.HOT_TAKE_MODERATION_SECRET || process.env.CHITCHAT_MODERATION_SECRET;
  if (!secret || secret.length < 16) {
    return res.status(503).json({
      error:
        'Moderation API disabled (set HOT_TAKE_MODERATION_SECRET or CHITCHAT_MODERATION_SECRET, 16+ chars).',
    });
  }
  const header =
    req.get('x-hot-take-moderation') || req.get('x-chitchat-moderation');
  const auth = req.get('authorization');
  const bearer =
    auth && /^Bearer\s+/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  const provided = (header || bearer || '').trim();
  if (!timingSafeEq(provided, secret)) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

function parseLimit(raw, def, max) {
  const n = parseInt(String(raw ?? def), 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(1, n));
}

async function requireVerifiedUser(req, res) {
  const authHeader = req.get('authorization') || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Sign-in required.' });
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1].trim());
    if (decoded.email && decoded.email_verified !== true) {
      res.status(403).json({ error: 'Verify your email before using ratings.' });
      return null;
    }
    return decoded;
  } catch (e) {
    console.warn('[ratings] token verification failed', e?.message ?? e);
    res.status(401).json({ error: 'Your sign-in session could not be verified.' });
    return null;
  }
}

function ratingDocId(ratedUid, raterUid, roomId) {
  return `${ratedUid}_${raterUid}_${roomId}`
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 500);
}

export function attachModerationRoutes(app, { isAdminReady }) {
  const router = express.Router();

  // Authenticated user-facing rating endpoints. These use Firebase Admin so rating
  // persistence does not depend on the browser having the latest Firestore rules.
  app.post('/api/debate-ratings', async (req, res) => {
    if (!isAdminReady()) {
      return res.status(503).json({ error: 'Firebase Admin not configured on this server.' });
    }
    const user = await requireVerifiedUser(req, res);
    if (!user) return;

    const ratedUid = String(req.body?.ratedUid || '').trim();
    const roomId = String(req.body?.roomId || '').trim();
    const rating = Number(req.body?.rating);
    if (
      !ratedUid ||
      ratedUid === user.uid ||
      ratedUid.length > 128 ||
      !roomId ||
      roomId.length > 128 ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({ error: 'Invalid debate rating.' });
    }

    try {
      const db = admin.firestore();
      const id = ratingDocId(ratedUid, user.uid, roomId);
      await db.collection('userRatings').doc(id).set({
        ratedUid,
        raterUid: user.uid,
        rating,
        roomId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: false });
      res.status(201).json({ ok: true, ratedUid, rating });
    } catch (e) {
      console.warn('[ratings] write failed', e?.message ?? e);
      res.status(500).json({ error: 'Could not save the debate rating.' });
    }
  });

  app.get('/api/debate-ratings/:uid', async (req, res) => {
    if (!isAdminReady()) {
      return res.status(503).json({ error: 'Firebase Admin not configured on this server.' });
    }
    const user = await requireVerifiedUser(req, res);
    if (!user) return;

    const ratedUid = String(req.params.uid || '').trim();
    if (!ratedUid || ratedUid.length > 128) {
      return res.status(400).json({ error: 'Invalid user.' });
    }

    try {
      const snap = await admin
        .firestore()
        .collection('userRatings')
        .where('ratedUid', '==', ratedUid)
        .limit(500)
        .get();
      const scores = snap.docs
        .map((d) => Number(d.data()?.rating))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
      if (!scores.length) return res.json({ average: null, count: 0 });
      const average = scores.reduce((sum, n) => sum + n, 0) / scores.length;
      res.json({ average: Number(average.toFixed(2)), count: scores.length });
    } catch (e) {
      console.warn('[ratings] read failed', e?.message ?? e);
      res.status(500).json({ error: 'Could not load the debate rating.' });
    }
  });

  router.use((req, res, next) => {
    if (!isAdminReady()) {
      return res.status(503).json({ error: 'Firebase Admin not configured on this server.' });
    }
    moderationAuth(req, res, next);
  });

  router.get('/status', (_req, res) => {
    res.json({ ok: true, moderation: true, firebaseAdmin: true });
  });

  router.get('/reports', async (req, res) => {
    const lim = parseLimit(req.query.limit, 50, 200);
    try {
      const snap = await admin
        .firestore()
        .collection('reports')
        .orderBy('createdAt', 'desc')
        .limit(lim)
        .get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ count: items.length, reports: items });
    } catch (e) {
      console.warn('[mod] reports list', e?.message ?? e);
      res.status(500).json({ error: e?.message ?? 'Query failed.' });
    }
  });

  router.get('/reports/:id', async (req, res) => {
    try {
      const doc = await admin.firestore().collection('reports').doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: 'Not found.' });
      res.json({ id: doc.id, ...doc.data() });
    } catch (e) {
      res.status(500).json({ error: e?.message ?? 'Read failed.' });
    }
  });

  router.post('/reports/:id/respond', async (req, res) => {
    const reportId = String(req.params.id || '').trim();
    const response = String(req.body?.response || '').trim().slice(0, 4000);
    const actorLabel = String(req.body?.actorLabel || '').trim().slice(0, 200) || 'Hot Take Support';
    const status = String(req.body?.status || 'responded').trim();
    if (!reportId || !response) {
      return res.status(400).json({ error: 'Report id and response are required.' });
    }
    if (!['open', 'reviewing', 'responded', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid report status.' });
    }
    try {
      const ref = admin.firestore().collection('reports').doc(reportId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Report not found.' });
      await ref.set({
        status,
        staffResponse: response,
        respondedAt: admin.firestore.FieldValue.serverTimestamp(),
        respondedBy: actorLabel,
      }, { merge: true });
      res.json({ ok: true, id: reportId, status });
    } catch (e) {
      console.warn('[mod] report response', e?.message ?? e);
      res.status(500).json({ error: 'Could not save the response.' });
    }
  });

  router.get('/match/:roomId', async (req, res) => {
    const roomId = String(req.params.roomId || '').trim();
    if (!roomId || roomId.length > 512) return res.status(400).json({ error: 'Invalid roomId.' });
    const msgLimit = parseLimit(req.query.chatLimit, 200, 2000);
    try {
      const db = admin.firestore();
      const debateSnap = await db
        .collectionGroup('debates')
        .where('sessionKind', '==', 'match')
        .where('roomId', '==', roomId)
        .limit(2)
        .get();

      let session = null;
      let chat_messages = [];
      if (!debateSnap.empty) {
        const d0 = debateSnap.docs[0];
        session = { id: d0.id, ...d0.data() };
        const chatSnap = await d0.ref
          .collection('chat_messages')
          .orderBy('sentAtMs', 'asc')
          .limit(msgLimit)
          .get();
        chat_messages = chatSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else {
        const sessionRef = db.collection('match_sessions').doc(roomId);
        const sessionSnap = await sessionRef.get();
        if (sessionSnap.exists) {
          session = { id: sessionSnap.id, ...sessionSnap.data() };
          const chatSnap = await sessionRef
            .collection('chat_messages')
            .orderBy('sentAtMs', 'asc')
            .limit(msgLimit)
            .get();
          chat_messages = chatSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      }
      res.json({ roomId, session, chat_messages });
    } catch (e) {
      console.warn('[mod] match', e?.message ?? e);
      res.status(500).json({ error: e?.message ?? 'Query failed.' });
    }
  });

  router.get('/user/:uid/debates', async (req, res) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid || uid.length > 128) return res.status(400).json({ error: 'Invalid uid.' });
    const lim = parseLimit(req.query.limit, 40, 200);
    const half = Math.max(1, Math.ceil(lim / 2));
    try {
      const db = admin.firestore();
      let userEmail = null;
      try {
        const rec = await admin.auth().getUser(uid);
        userEmail = rec.email?.trim().toLowerCase() || null;
      } catch {
        /* uid may be invalid */
      }

      const tasks = [
        db.collection('debates').where('uid', '==', uid).limit(half).get(),
      ];
      if (userEmail) {
        tasks.push(db.collection('users').doc(userEmail).collection('debates').limit(half).get());
      }

      const snaps = await Promise.all(tasks);
      const map = new Map();
      for (const snap of snaps) {
        for (const d of snap.docs) map.set(d.ref.path, { id: d.id, ...d.data() });
      }
      const rows = [...map.values()];
      rows.sort((a, b) => (b.endedAtMs ?? 0) - (a.endedAtMs ?? 0));
      const sliced = rows.slice(0, lim);
      res.json({ uid, userEmail, count: sliced.length, debates: sliced });
    } catch (e) {
      res.status(500).json({ error: e?.message ?? 'Query failed.' });
    }
  });

  router.get('/user/:uid/sessions', async (req, res) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid || uid.length > 128) return res.status(400).json({ error: 'Invalid uid.' });
    const lim = parseLimit(req.query.limit, 40, 100);
    try {
      const db = admin.firestore();
      let userEmail = null;
      try {
        const rec = await admin.auth().getUser(uid);
        userEmail = rec.email?.trim().toLowerCase() || null;
      } catch {
        /* invalid uid */
      }

      const sessions = [];
      if (userEmail) {
        const snap = await db
          .collection('users')
          .doc(userEmail)
          .collection('debates')
          .where('sessionKind', '==', 'match')
          .limit(100)
          .get();
        for (const d of snap.docs) sessions.push({ id: d.id, ...d.data() });
      }

      const byId = new Map(sessions.map((s) => [s.id, s]));
      const [proSnap, conSnap] = await Promise.all([
        db.collection('match_sessions').where('proUid', '==', uid).limit(lim).get(),
        db.collection('match_sessions').where('conUid', '==', uid).limit(lim).get(),
      ]);
      for (const d of [...proSnap.docs, ...conSnap.docs]) {
        if (!byId.has(d.id)) byId.set(d.id, { id: d.id, ...d.data(), _legacyPath: 'match_sessions' });
      }
      const merged = [...byId.values()].sort((a, b) => {
        const ta = a.startedAt?.toMillis?.() ?? 0;
        const tb = b.startedAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
      const sliced = merged.slice(0, lim);
      res.json({ uid, userEmail, count: sliced.length, match_sessions: sliced });
    } catch (e) {
      console.warn('[mod] user sessions', e?.message ?? e);
      res.status(500).json({ error: e?.message ?? 'Query failed.' });
    }
  });

  router.get('/actions', async (req, res) => {
    const lim = parseLimit(req.query.limit, 50, 200);
    try {
      const snap = await admin
        .firestore()
        .collection('moderation_actions')
        .orderBy('createdAt', 'desc')
        .limit(lim)
        .get();
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      res.json({ count: items.length, actions: items });
    } catch (e) {
      console.warn('[mod] actions list', e?.message ?? e);
      res.status(500).json({ error: e?.message ?? 'Query failed.' });
    }
  });

  const ALLOWED_ACTIONS = new Set(['note', 'warn', 'ban_applied', 'ban_lifted', 'reviewed', 'escalated']);

  router.post('/actions', async (req, res) => {
    const { targetUid, action, reason, actorLabel, relatedReportId, relatedRoomId } = req.body ?? {};
    const uid = String(targetUid || '').trim();
    if (!uid || uid.length > 128) return res.status(400).json({ error: 'targetUid required.' });
    const act = String(action || '').trim();
    if (!ALLOWED_ACTIONS.has(act)) {
      return res.status(400).json({ error: `action must be one of: ${[...ALLOWED_ACTIONS].join(', ')}` });
    }
    const text = String(reason || '').trim().slice(0, 8000);
    if (!text) return res.status(400).json({ error: 'reason required.' });
    const actor = String(actorLabel || '').trim().slice(0, 200);
    try {
      const ref = await admin.firestore().collection('moderation_actions').add({
        targetUid: uid,
        action: act,
        reason: text,
        actorLabel: actor || 'operator',
        relatedReportId: relatedReportId ? String(relatedReportId).slice(0, 200) : null,
        relatedRoomId: relatedRoomId ? String(relatedRoomId).slice(0, 512) : null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(201).json({ ok: true, id: ref.id });
    } catch (e) {
      res.status(500).json({ error: e?.message ?? 'Write failed.' });
    }
  });

  router.post('/user/:uid/auth-disable', async (req, res) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'Invalid uid.' });
    const { reason, actorLabel } = req.body ?? {};
    const text = String(reason || '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ error: 'reason required (audit trail).' });
    try {
      await admin.auth().updateUser(uid, { disabled: true });
      await admin.firestore().collection('moderation_actions').add({
        targetUid: uid,
        action: 'ban_applied',
        reason: `Auth disabled. ${text}`,
        actorLabel: String(actorLabel || '').trim().slice(0, 200) || 'operator',
        relatedReportId: null,
        relatedRoomId: null,
        authDisabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.json({ ok: true, disabled: true });
    } catch (e) {
      console.warn('[mod] auth-disable', e?.message ?? e);
      res.status(500).json({ error: e?.message ?? 'Failed to disable user.' });
    }
  });

  router.post('/user/:uid/auth-enable', async (req, res) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid) return res.status(400).json({ error: 'Invalid uid.' });
    const { reason, actorLabel } = req.body ?? {};
    const text = String(reason || '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ error: 'reason required (audit trail).' });
    try {
      await admin.auth().updateUser(uid, { disabled: false });
      await admin.firestore().collection('moderation_actions').add({
        targetUid: uid,
        action: 'ban_lifted',
        reason: text,
        actorLabel: String(actorLabel || '').trim().slice(0, 200) || 'operator',
        authReenabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.json({ ok: true, disabled: false });
    } catch (e) {
      console.warn('[mod] auth-enable', e?.message ?? e);
      res.status(500).json({ error: e?.message ?? 'Failed to enable user.' });
    }
  });

  app.use('/api/mod', router);
}
