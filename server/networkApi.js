import express from 'express';
import admin from 'firebase-admin';

const OWNER_EMAIL = (process.env.HOT_TAKE_OWNER_EMAIL || 'justinself88@gmail.com').trim().toLowerCase();
const STAFF_ROLES = new Set(['moderator', 'admin', 'owner']);

function roleFromClaims(claims = {}) {
  if (String(claims.email || '').toLowerCase() === OWNER_EMAIL) return 'owner';
  const role = String(claims.role || 'user');
  return STAFF_ROLES.has(role) ? role : 'user';
}

async function requireUser(req, res, next) {
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign-in required.' });
  try {
    const claims = await admin.auth().verifyIdToken(match[1].trim(), true);
    req.networkUser = {
      uid: claims.uid,
      email: String(claims.email || '').toLowerCase(),
      role: roleFromClaims(claims),
      verifiedDebater: claims.verifiedDebater === true,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Your session could not be verified.' });
  }
}

function serializeTime(value) {
  return value?.toMillis?.() || null;
}

async function publicIdentity(uid) {
  const user = await admin.auth().getUser(uid);
  const email = String(user.email || '').toLowerCase();
  const role = email === OWNER_EMAIL ? 'owner' : String(user.customClaims?.role || 'user');
  let profile = {};
  if (email) {
    const snap = await admin.firestore().collection('publicProfiles').doc(email).get();
    if (snap.exists) profile = snap.data() || {};
  }
  return {
    uid,
    displayName: String(profile.displayName || user.displayName || email.split('@')[0] || 'Hot Take member'),
    avatarUrl: String(profile.avatarUrl || ''),
    bio: String(profile.bio || ''),
    role: STAFF_ROLES.has(role) ? role : 'user',
    premium: user.customClaims?.premium === true,
    verifiedDebater: user.customClaims?.verifiedDebater === true,
  };
}

export function attachNetworkRoutes(app, { isAdminReady, io }) {
  const router = express.Router();
  const activityForUid = (uid) => {
    const sockets = Array.from(io?.sockets?.sockets?.values?.() || []).filter((socket) => socket.data?.uid === uid);
    if (!sockets.length) return { key: 'offline', label: 'Offline' };
    if (sockets.some((socket) => socket.data?.roomId)) return { key: 'debating', label: 'In a debate' };
    if (sockets.some((socket) => socket.data?.matchType === 'quick' && socket.data?.side)) {
      return { key: 'quick_match', label: 'Searching for a Quick Match' };
    }
    if (sockets.some((socket) => socket.data?.matchType === 'custom' && socket.data?.customRoomCode && socket.data?.side === 'agree')) {
      return { key: 'hosting_room', label: 'Hosting a public debate room' };
    }
    if (sockets.some((socket) => socket.data?.matchType === 'custom' && socket.data?.customRoomCode)) {
      return { key: 'joining_room', label: 'Joining a custom debate' };
    }
    return { key: 'online', label: 'Online' };
  };
  router.use((req, res, next) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'The debate network is temporarily unavailable.' });
    next();
  });
  router.use(requireUser);

  router.get('/me', async (req, res) => {
    const identity = await publicIdentity(req.networkUser.uid);
    const application = await admin.firestore().collection('verification_applications').doc(req.networkUser.uid).get();
    res.json({ identity, application: application.exists ? { ...application.data(), submittedAtMs: serializeTime(application.data()?.submittedAt), updatedAtMs: serializeTime(application.data()?.updatedAt) } : null });
  });

  router.get('/identity/:uid', async (req, res) => {
    try {
      const uid = String(req.params.uid);
      res.json({ identity: await publicIdentity(uid), activity: activityForUid(uid) });
    }
    catch { res.status(404).json({ error: 'Member not found.' }); }
  });

  router.get('/messages/:uid', async (req, res) => {
    const otherUid = String(req.params.uid || '').trim();
    if (!otherUid || otherUid === req.networkUser.uid) return res.status(400).json({ error: 'Choose another member.' });
    try {
      const conversationId = [req.networkUser.uid, otherUid].sort().join('__');
      const conversationRef = admin.firestore().collection('direct_conversations').doc(conversationId);
      const [conversation, snap] = await Promise.all([
        conversationRef.get(),
        conversationRef.collection('messages').orderBy('createdAt', 'desc').limit(100).get(),
      ]);
      const conversationData = conversation.exists ? conversation.data() : null;
      const pendingForRecipient = conversationData?.status === 'pending'
        && conversationData?.requestedRecipientUid === req.networkUser.uid;
      const messages = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAtMs: serializeTime(doc.data()?.createdAt),
      })).reverse();
      res.json({
        conversationId,
        conversation: conversationData,
        pendingForRecipient,
        messages: pendingForRecipient ? [] : messages,
      });
    } catch {
      res.status(404).json({ error: 'Conversation not found.' });
    }
  });

  router.post('/messages/:uid', async (req, res) => {
    const otherUid = String(req.params.uid || '').trim();
    const text = String(req.body?.text || '').trim();
    if (!otherUid || otherUid === req.networkUser.uid) return res.status(400).json({ error: 'Choose another member.' });
    if (!text || text.length > 1000) return res.status(400).json({ error: 'Messages must be between 1 and 1,000 characters.' });
    try {
      await admin.auth().getUser(otherUid);
      const db = admin.firestore();
      const conversationId = [req.networkUser.uid, otherUid].sort().join('__');
      const conversationRef = db.collection('direct_conversations').doc(conversationId);
      const existingConversation = await conversationRef.get();
      const existingData = existingConversation.exists ? existingConversation.data() : null;
      if (existingData?.status === 'pending') {
        return res.status(409).json({ error: 'This member must accept your message request before you can send another message.' });
      }
      if (existingData?.status === 'declined') {
        return res.status(403).json({ error: 'This member is not accepting messages from you.' });
      }
      const messageRef = conversationRef.collection('messages').doc();
      const [senderIdentity, recipientIdentity] = await Promise.all([
        publicIdentity(req.networkUser.uid),
        publicIdentity(otherUid),
      ]);
      const batch = db.batch();
      batch.set(conversationRef, {
        participants: [req.networkUser.uid, otherUid],
        participantProfiles: [senderIdentity, recipientIdentity].map((identity) => ({
          uid: identity.uid,
          displayName: identity.displayName || 'Hot Take member',
          avatarUrl: identity.avatarUrl || '',
        })),
        lastMessage: text.slice(0, 180),
        lastSenderUid: req.networkUser.uid,
        status: existingConversation.exists ? (existingData?.status || 'accepted') : 'pending',
        requestedByUid: existingConversation.exists ? (existingData?.requestedByUid || null) : req.networkUser.uid,
        requestedRecipientUid: existingConversation.exists ? (existingData?.requestedRecipientUid || null) : otherUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(messageRef, {
        senderUid: req.networkUser.uid,
        recipientUid: otherUid,
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (!existingConversation.exists) {
        const notificationRef = db.collection('user_notifications').doc(otherUid).collection('items').doc();
        batch.set(notificationRef, {
          type: 'dm_request',
          fromUid: req.networkUser.uid,
          conversationId,
          hostDisplayName: senderIdentity.displayName || 'A Hot Take member',
          hostAvatarUrl: senderIdentity.avatarUrl || '',
          hostVerified: senderIdentity.verifiedDebater === true,
          hostRole: senderIdentity.role || 'user',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      io?.to(`user:${otherUid}`).emit(existingConversation.exists ? 'direct-message' : 'dm-request', {
        fromUid: req.networkUser.uid,
        conversationId,
        hostDisplayName: senderIdentity.displayName || 'A Hot Take member',
        hostAvatarUrl: senderIdentity.avatarUrl || '',
        hostVerified: senderIdentity.verifiedDebater === true,
        hostRole: senderIdentity.role || 'user',
      });
      res.status(201).json({ id: messageRef.id, conversationId });
    } catch {
      res.status(404).json({ error: 'That member could not be messaged.' });
    }
  });

  router.post('/messages/:uid/decision', async (req, res) => {
    const otherUid = String(req.params.uid || '').trim();
    const decision = String(req.body?.decision || '').trim().toLowerCase();
    if (!['accept', 'decline'].includes(decision)) return res.status(400).json({ error: 'Choose accept or decline.' });
    const conversationId = [req.networkUser.uid, otherUid].sort().join('__');
    const ref = admin.firestore().collection('direct_conversations').doc(conversationId);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;
    if (!data || data.status !== 'pending' || data.requestedRecipientUid !== req.networkUser.uid) {
      return res.status(404).json({ error: 'That message request is no longer pending.' });
    }
    const status = decision === 'accept' ? 'accepted' : 'declined';
    const notificationSnap = await admin.firestore().collection('user_notifications').doc(req.networkUser.uid).collection('items')
      .where('conversationId', '==', conversationId).get();
    const batch = admin.firestore().batch();
    batch.set(ref, { status, decidedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    notificationSnap.docs.forEach((doc) => batch.set(doc.ref, { read: true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
    io?.to(`user:${otherUid}`).emit('dm-request-decided', { byUid: req.networkUser.uid, conversationId, status });
    res.json({ ok: true, status });
  });

  router.get('/follow/:uid', async (req, res) => {
    const snap = await admin.firestore().collection('followers').doc(String(req.params.uid)).collection('members').doc(req.networkUser.uid).get();
    res.json({ following: snap.exists });
  });

  router.post('/follow/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '');
    if (!targetUid || targetUid === req.networkUser.uid) return res.status(400).json({ error: 'You cannot follow yourself.' });
    await admin.auth().getUser(targetUid);
    const db = admin.firestore();
    const batch = db.batch();
    batch.set(db.collection('followers').doc(targetUid).collection('members').doc(req.networkUser.uid), {
      followerUid: req.networkUser.uid,
      followerEmail: req.networkUser.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.set(db.collection('following').doc(req.networkUser.uid).collection('members').doc(targetUid), {
      targetUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    res.json({ following: true });
  });

  router.delete('/follow/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '');
    const db = admin.firestore();
    const batch = db.batch();
    batch.delete(db.collection('followers').doc(targetUid).collection('members').doc(req.networkUser.uid));
    batch.delete(db.collection('following').doc(req.networkUser.uid).collection('members').doc(targetUid));
    await batch.commit();
    res.json({ following: false });
  });

  router.get('/notifications', async (req, res) => {
    const snap = await admin.firestore().collection('user_notifications').doc(req.networkUser.uid).collection('items').orderBy('createdAt', 'desc').limit(50).get();
    res.json({ notifications: snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAtMs: serializeTime(doc.data()?.createdAt) })) });
  });

  router.post('/notifications/:id/read', async (req, res) => {
    await admin.firestore().collection('user_notifications').doc(req.networkUser.uid).collection('items').doc(String(req.params.id)).set({ read: true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.json({ ok: true });
  });

  router.post('/notification-preferences', async (req, res) => {
    const roomAlerts = req.body?.roomAlerts !== false;
    const browserAlerts = req.body?.browserAlerts === true;
    await admin.firestore().collection('notification_preferences').doc(req.networkUser.uid).set({ roomAlerts, browserAlerts, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.json({ roomAlerts, browserAlerts });
  });

  router.post('/verification-applications', async (req, res) => {
    if (req.networkUser.verifiedDebater) return res.status(409).json({ error: 'This account is already verified.' });
    const platform = String(req.body?.platform || '').trim().slice(0, 80);
    const profileUrl = String(req.body?.profileUrl || '').trim().slice(0, 500);
    const followerCount = Math.max(0, Number(req.body?.followerCount) || 0);
    const supportingLinks = Array.isArray(req.body?.supportingLinks) ? req.body.supportingLinks.map((v) => String(v).trim().slice(0, 500)).filter(Boolean).slice(0, 5) : [];
    const explanation = String(req.body?.explanation || '').trim().slice(0, 2000);
    if (!platform || !/^https?:\/\//i.test(profileUrl) || explanation.length < 20 || req.body?.controlsAccount !== true) {
      return res.status(400).json({ error: 'Platform, a valid profile URL, account confirmation, and a short explanation are required.' });
    }
    const ref = admin.firestore().collection('verification_applications').doc(req.networkUser.uid);
    const current = await ref.get();
    if (current.exists && ['pending', 'info_requested'].includes(current.data()?.status)) return res.status(409).json({ error: 'You already have an active application.' });
    await ref.set({ uid: req.networkUser.uid, email: req.networkUser.email, platform, profileUrl, followerCount, supportingLinks, explanation, controlsAccount: true, status: 'pending', submittedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    io?.to?.('staff:verification')?.emit?.('verification-application-created');
    res.json({ ok: true, status: 'pending' });
  });

  app.use('/api/network', router);
}

export async function notifyFollowersRoomCreated({ isAdminReady, io, hostUid, roomCode, statement, joinMode }) {
  if (!isAdminReady() || !hostUid || joinMode !== 'open') return;
  try {
    const db = admin.firestore();
    const host = await publicIdentity(hostUid);
    const followers = await db.collection('followers').doc(hostUid).collection('members').limit(10000).get();
    const writes = [];
    followers.docs.forEach((follower) => {
      const followerUid = follower.id;
      const ref = db.collection('user_notifications').doc(followerUid).collection('items').doc();
      const payload = { type: 'room_live', hostUid, hostDisplayName: host.displayName, hostAvatarUrl: host.avatarUrl, hostRole: host.role, hostVerified: host.verifiedDebater, roomCode, statement: String(statement || '').slice(0, 240), read: false, createdAt: admin.firestore.FieldValue.serverTimestamp() };
      writes.push(ref.set(payload));
      io?.to?.(`user:${followerUid}`)?.emit?.('network-notification', { id: ref.id, ...payload, createdAt: null });
    });
    await Promise.all(writes);
  } catch (error) {
    console.warn('[network] follower notification failed', error?.message ?? error);
  }
}

