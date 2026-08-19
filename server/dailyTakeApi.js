import express from 'express';
import admin from 'firebase-admin';
import { ALLOWED_TOPIC_IDS, TOPICS } from '../shared/topics.js';

const DEFAULT_TAKE = {
  statement: TOPICS[3].label,
  topicId: TOPICS[3].id,
  version: 'launch-god-is-real',
  agreeVotes: 0,
  disagreeVotes: 0,
};

async function optionalUser(req) {
  const match = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try { return await admin.auth().verifyIdToken(match[1].trim()); }
  catch { return null; }
}

export function attachDailyTakeRoutes(app, { isAdminReady }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Daily Take is temporarily unavailable.' });
    try {
      const ref = admin.firestore().collection('daily_take').doc('current');
      let snap = await ref.get();
      if (!snap.exists) {
        await ref.set({ ...DEFAULT_TAKE, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        snap = await ref.get();
      }
      const take = snap.data() || DEFAULT_TAKE;
      const user = await optionalUser(req);
      let viewerVote = null;
      if (user) {
        const vote = await admin.firestore().collection('daily_take_votes').doc(user.uid).get();
        if (vote.exists && vote.data()?.version === take.version) viewerVote = vote.data()?.side || null;
      }
      res.set('Cache-Control', 'no-store');
      res.json({
        statement: take.statement,
        topicId: take.topicId,
        version: take.version,
        agreeVotes: Math.max(0, Number(take.agreeVotes) || 0),
        disagreeVotes: Math.max(0, Number(take.disagreeVotes) || 0),
        viewerVote,
      });
    } catch (error) {
      console.warn('[daily-take] load failed', error?.message ?? error);
      res.status(500).json({ error: 'Daily Take could not be loaded.' });
    }
  });

  router.post('/vote', async (req, res) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Voting is temporarily unavailable.' });
    const user = await optionalUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in to vote.' });
    if (user.email_verified !== true) return res.status(403).json({ error: 'Verify your email address before voting.' });
    const side = String(req.body?.side || '');
    if (!['agree', 'disagree'].includes(side)) return res.status(400).json({ error: 'Choose agree or disagree.' });
    try {
      const db = admin.firestore();
      const takeRef = db.collection('daily_take').doc('current');
      const voteRef = db.collection('daily_take_votes').doc(user.uid);
      const result = await db.runTransaction(async (transaction) => {
        const [takeSnap, voteSnap] = await Promise.all([transaction.get(takeRef), transaction.get(voteRef)]);
        if (!takeSnap.exists) throw new Error('Daily Take is not available yet.');
        const take = takeSnap.data();
        const previous = voteSnap.exists && voteSnap.data()?.version === take.version ? voteSnap.data()?.side : null;
        const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (previous !== side) {
          if (previous) updates[previous + 'Votes'] = admin.firestore.FieldValue.increment(-1);
          updates[side + 'Votes'] = admin.firestore.FieldValue.increment(1);
          transaction.set(takeRef, updates, { merge: true });
          transaction.set(voteRef, { version: take.version, side, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        return {
          viewerVote: side,
          agreeVotes: Math.max(0, Number(take.agreeVotes || 0) + (previous === 'agree' && side !== 'agree' ? -1 : previous !== 'agree' && side === 'agree' ? 1 : 0)),
          disagreeVotes: Math.max(0, Number(take.disagreeVotes || 0) + (previous === 'disagree' && side !== 'disagree' ? -1 : previous !== 'disagree' && side === 'disagree' ? 1 : 0)),
        };
      });
      res.json(result);
    } catch (error) {
      console.warn('[daily-take] vote failed', error?.message ?? error);
      res.status(500).json({ error: error?.message || 'Your vote could not be saved.' });
    }
  });

  app.use('/api/daily-take', router);
}

export function validateDailyTakeInput(body) {
  const statement = String(body?.statement || '').trim().replace(/\s+/g, ' ');
  const topicId = String(body?.topicId || '').trim();
  if (statement.length < 10 || statement.length > 280) throw new Error('Statement must be between 10 and 280 characters.');
  if (!ALLOWED_TOPIC_IDS.has(topicId)) throw new Error('Choose a valid Quick Match topic.');
  return { statement, topicId };
}
