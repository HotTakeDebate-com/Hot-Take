import express from 'express';
import admin from 'firebase-admin';

async function requireUser(req, res, next) {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign-in required.' });
  try {
    req.user = await admin.auth().verifyIdToken(match[1].trim(), true);
    next();
  } catch {
    res.status(401).json({ error: 'Your session could not be verified.' });
  }
}

export function attachWarningRoutes(app, { isAdminReady }) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Firebase Admin not configured.' });
    next();
  });
  router.use(requireUser);

  router.get('/ban', async (req, res) => {
    const ref = admin.firestore().collection('user_bans').doc(req.user.uid);
    const snap = await ref.get();
    if (!snap.exists) return res.json({ active: false, serverNowMs: Date.now() });
    const ban = snap.data() || {};
    const banUntilMs = ban.banUntil?.toMillis?.() || null;
    const active = ban.active === true && (ban.permanent === true || Number(banUntilMs) > Date.now());
    if (!active) {
      await ref.delete().catch(() => {});
      return res.json({ active: false, serverNowMs: Date.now() });
    }
    res.json({
      active: true,
      permanent: ban.permanent === true,
      banUntilMs,
      reason: ban.reason || 'a violation of the community guidelines',
      issuedByRole: ban.issuedByRole || 'moderator',
      serverNowMs: Date.now(),
    });
  });

  router.get('/', async (req, res) => {
    const snap = await admin.firestore().collection('user_warnings')
      .where('uid', '==', req.user.uid).limit(50).get();
    const warnings = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((warning) => warning.acknowledged !== true)
      .sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
    res.json({ warnings });
  });

  router.post('/:id/acknowledge', async (req, res) => {
    const ref = admin.firestore().collection('user_warnings').doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== req.user.uid) {
      return res.status(404).json({ error: 'Warning not found.' });
    }
    await ref.set({
      acknowledged: true,
      acknowledgedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ ok: true });
  });

  app.use('/api/warnings', router);
}
