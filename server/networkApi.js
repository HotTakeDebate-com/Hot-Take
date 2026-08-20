import express from 'express';
import admin from 'firebase-admin';
import { removeStaleDisplayNameClaim } from './displayNameClaims.js';
import { MAX_PROFILE_INTERESTS, sanitizeProfileInterests } from '../src/profileInterests.js';
import { blockRef, blockRelationship } from './blocks.js';

const OWNER_EMAILS = new Set([
  (process.env.HOT_TAKE_OWNER_EMAIL || 'justinself88@gmail.com').trim().toLowerCase(),
  'andrewbarless@gmail.com',
]);
const STAFF_ROLES = new Set(['moderator', 'admin', 'owner']);

function roleFromClaims(claims = {}) {
  if (OWNER_EMAILS.has(String(claims.email || '').toLowerCase())) return 'owner';
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
  const role = OWNER_EMAILS.has(email) ? 'owner' : String(user.customClaims?.role || 'user');
  let profile = {};
  if (email) {
    const snap = await admin.firestore().collection('publicProfiles').doc(email).get();
    if (snap.exists) profile = snap.data() || {};
  }
  return {
    uid,
    displayName: String(profile.displayName || user.displayName || 'Hot Take member'),
    avatarUrl: String(profile.avatarUrl || ''),
    bio: String(profile.bio || ''),
    interests: sanitizeProfileInterests(profile.interests).slice(0, MAX_PROFILE_INTERESTS),
    role: STAFF_ROLES.has(role) ? role : 'user',
    premium: user.customClaims?.premium === true,
    verifiedDebater: user.customClaims?.verifiedDebater === true,
  };
}

async function followerCountForUid(uid) {
  const snapshot = await admin.firestore().collection('followers').doc(uid).collection('members').count().get();
  return Number(snapshot.data()?.count || 0);
}

export function attachNetworkRoutes(app, { isAdminReady, io }) {
  const router = express.Router();
  router.put('/profile', requireUser, async (req, res) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Profile updates are temporarily unavailable.' });
    const email = String(req.networkUser.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Your account does not have an email address.' });
    const updates = { uid: req.networkUser.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'bio')) updates.bio = String(req.body.bio || '').trim().slice(0, 500);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl')) updates.avatarUrl = String(req.body.avatarUrl || '').trim().slice(0, 250000);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'interests')) updates.interests = sanitizeProfileInterests(req.body.interests);
    await admin.firestore().collection('publicProfiles').doc(email).set(updates, { merge: true });
    res.json({ ok: true, interests: updates.interests });
  });
  const activityForUid = async (uid) => {
    const privacy = await admin.firestore().collection('network_privacy').doc(uid).get();
    if (privacy.data()?.appearOffline === true) return { key: 'offline', label: 'Offline' };
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

  router.get('/members/search', async (req, res) => {
    const needle = String(req.query.q || '').normalize('NFKC').trim().toLocaleLowerCase();
    if (needle.length < 1) return res.status(400).json({ error: 'Enter a display name.' });
    try {
      const matches = [];
      let pageToken;
      do {
        const page = await admin.auth().listUsers(1000, pageToken);
        const identities = await Promise.all(page.users.map((user) => publicIdentity(user.uid).catch(() => null)));
        for (const identity of identities) {
          if (!identity || identity.uid === req.networkUser.uid) continue;
          if (identity.displayName.normalize('NFKC').toLocaleLowerCase().includes(needle)) matches.push(identity);
          if (matches.length >= 30) break;
        }
        pageToken = page.pageToken;
      } while (pageToken && matches.length < 30);
      matches.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
      res.json({ members: matches.slice(0, 30) });
    } catch {
      res.status(500).json({ error: 'Could not search members.' });
    }
  });

  router.put('/display-name', async (req, res) => {
    const displayName = String(req.body?.displayName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    const normalized = displayName.toLocaleLowerCase();
    if (displayName.length < 2 || displayName.length > 40) {
      return res.status(400).json({ error: 'Display name must be between 2 and 40 characters.' });
    }
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u.test(displayName)) {
      return res.status(400).json({ error: 'Use letters, numbers, spaces, periods, apostrophes, underscores, or hyphens.' });
    }
    try {
      let pageToken;
      do {
        const page = await admin.auth().listUsers(1000, pageToken);
        const conflict = page.users.find((user) => user.uid !== req.networkUser.uid && String(user.displayName || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalized);
        if (conflict) return res.status(409).json({ error: 'That display name is already taken.' });
        pageToken = page.pageToken;
      } while (pageToken);

      const db = admin.firestore();
      const claimRef = db.collection('display_name_claims').doc(encodeURIComponent(normalized));
      const ownerRef = db.collection('display_name_owners').doc(req.networkUser.uid);
      await removeStaleDisplayNameClaim(claimRef, req.networkUser.uid, db);
      await db.runTransaction(async (transaction) => {
        const [claim, owner] = await Promise.all([transaction.get(claimRef), transaction.get(ownerRef)]);
        if (claim.exists && claim.data()?.uid !== req.networkUser.uid) throw Object.assign(new Error('taken'), { code: 'name-taken' });
        const oldKey = owner.data()?.key;
        if (oldKey && oldKey !== claimRef.id) {
          const oldRef = db.collection('display_name_claims').doc(oldKey);
          const oldClaim = await transaction.get(oldRef);
          if (oldClaim.data()?.uid === req.networkUser.uid) transaction.delete(oldRef);
        }
        transaction.set(claimRef, { uid: req.networkUser.uid, displayName, normalized, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        transaction.set(ownerRef, { key: claimRef.id, displayName, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });
      await admin.auth().updateUser(req.networkUser.uid, { displayName });
      if (req.networkUser.email) await db.collection('publicProfiles').doc(req.networkUser.email).set({ uid: req.networkUser.uid, displayName, displayNameNormalized: normalized, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      res.json({ ok: true, displayName });
    } catch (error) {
      if (error?.code === 'name-taken') return res.status(409).json({ error: 'That display name is already taken.' });
      res.status(500).json({ error: 'Could not reserve that display name.' });
    }
  });

  router.get('/me', async (req, res) => {
    const [identity, followerCount, application, privacy] = await Promise.all([
      publicIdentity(req.networkUser.uid),
      followerCountForUid(req.networkUser.uid),
      admin.firestore().collection('verification_applications').doc(req.networkUser.uid).get(),
      admin.firestore().collection('network_privacy').doc(req.networkUser.uid).get(),
    ]);
    res.json({
      identity,
      followerCount,
      privacy: { appearOffline: privacy.data()?.appearOffline === true },
      application: application.exists ? { ...application.data(), submittedAtMs: serializeTime(application.data()?.submittedAt), updatedAtMs: serializeTime(application.data()?.updatedAt) } : null,
    });
  });

  router.put('/presence-privacy', async (req, res) => {
    const appearOffline = req.body?.appearOffline === true;
    await admin.firestore().collection('network_privacy').doc(req.networkUser.uid).set({
      appearOffline,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    io?.emit('member-activity-updated', {
      uid: req.networkUser.uid,
      activity: appearOffline ? { key: 'offline', label: 'Offline' } : await activityForUid(req.networkUser.uid),
    });
    res.json({ ok: true, appearOffline });
  });

  router.get('/identity/:uid', async (req, res) => {
    try {
      const uid = String(req.params.uid);
      const [identity, followerCount] = await Promise.all([publicIdentity(uid), followerCountForUid(uid)]);
      res.json({ identity, followerCount, activity: await activityForUid(uid) });
    }
    catch { res.status(404).json({ error: 'Member not found.' }); }
  });

  router.get('/messages', async (req, res) => {
    try {
      const snap = await admin.firestore().collection('direct_conversations')
        .where('participants', 'array-contains', req.networkUser.uid).limit(100).get();
      const visibleDocs = snap.docs.filter((doc) => doc.data()?.status !== 'blocked');
      const conversations = await Promise.all(visibleDocs.map(async (doc) => {
        const data = doc.data() || {};
        const otherUid = (data.participants || []).find((uid) => uid !== req.networkUser.uid) || '';
        let otherProfile = (data.participantProfiles || []).find((profile) => profile.uid === otherUid) || null;
        if (!otherProfile && otherUid) {
          try { otherProfile = await publicIdentity(otherUid); }
          catch { otherProfile = { uid: otherUid, displayName: 'Deleted account', avatarUrl: '', deleted: true }; }
        }
        const pendingForRecipient = data.status === 'pending' && data.requestedRecipientUid === req.networkUser.uid;
        const declinedForRecipient = data.status === 'declined' && data.requestedRecipientUid === req.networkUser.uid;
        return {
          id: doc.id,
          otherUid,
          otherProfile,
          status: data.status || 'accepted',
          pendingForRecipient,
          declinedForRecipient,
          // Message contents are intentionally omitted from inbox previews.
          // Members must open a conversation before its messages are returned.
          lastMessage: '',
          lastSenderUid: data.lastSenderUid || '',
          updatedAtMs: serializeTime(data.updatedAt),
        };
      }));
      conversations.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
      res.json({ conversations });
    } catch {
      res.status(500).json({ error: 'Could not load your inbox.' });
    }
  });

  router.get('/messages/:uid', async (req, res) => {
    const otherUid = String(req.params.uid || '').trim();
    if (!otherUid || otherUid === req.networkUser.uid) return res.status(400).json({ error: 'Choose another member.' });
    try {
      if ((await blockRelationship(req.networkUser.uid, otherUid)).blocked) return res.json({ blocked: true, messages: [], pendingForRecipient: false });
      const conversationId = [req.networkUser.uid, otherUid].sort().join('__');
      const conversationRef = admin.firestore().collection('direct_conversations').doc(conversationId);
      const [conversation, snap] = await Promise.all([
        conversationRef.get(),
        conversationRef.collection('messages').orderBy('createdAt', 'desc').limit(100).get(),
      ]);
      const conversationData = conversation.exists ? conversation.data() : null;
      const pendingForRecipient = conversationData?.status === 'pending'
        && conversationData?.requestedRecipientUid === req.networkUser.uid;
      const declinedForRecipient = conversationData?.status === 'declined'
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
        declinedForRecipient,
        messages: pendingForRecipient || declinedForRecipient ? [] : messages,
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
      if ((await blockRelationship(req.networkUser.uid, otherUid)).blocked) return res.status(403).json({ error: 'You cannot message this account because blocking is active.' });
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
      const startsNewRequest = !existingConversation.exists || existingData?.status === 'closed';
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
        status: startsNewRequest ? 'pending' : (existingData?.status || 'accepted'),
        requestedByUid: startsNewRequest ? req.networkUser.uid : (existingData?.requestedByUid || null),
        requestedRecipientUid: startsNewRequest ? otherUid : (existingData?.requestedRecipientUid || null),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      batch.set(messageRef, {
        senderUid: req.networkUser.uid,
        recipientUid: otherUid,
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (startsNewRequest) {
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
      io?.to(`user:${otherUid}`).emit(startsNewRequest ? 'dm-request' : 'direct-message', {
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
    const statusNow = String(data?.status || '').trim().toLowerCase();
    const participants = Array.isArray(data?.participants) ? data.participants : [];
    const isParticipant = participants.includes(req.networkUser.uid) && participants.includes(otherUid);
    const isRecipient = data?.requestedRecipientUid === req.networkUser.uid
      || (isParticipant && data?.requestedByUid && data.requestedByUid !== req.networkUser.uid);
    if (decision === 'accept' && isRecipient && statusNow === 'accepted') {
      return res.json({ ok: true, status: 'accepted' });
    }
    const canDecide = isRecipient
      && (statusNow === 'pending' || (statusNow === 'declined' && decision === 'accept'));
    if (!canDecide) {
      return res.status(404).json({ error: 'That message request is no longer pending.' });
    }
    const status = decision === 'accept' ? 'accepted' : 'declined';
    const notificationSnap = await admin.firestore().collection('user_notifications').doc(req.networkUser.uid).collection('items')
      .where('conversationId', '==', conversationId).get();
    const batch = admin.firestore().batch();
    batch.set(ref, { status, decidedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    notificationSnap.docs.forEach((doc) => batch.set(doc.ref, { read: true, readAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }));
    await batch.commit();
    const decisionEvent = { byUid: req.networkUser.uid, conversationId, status };
    io?.to(`user:${otherUid}`).emit('dm-request-decided', decisionEvent);
    io?.to(`user:${req.networkUser.uid}`).emit('dm-request-decided', decisionEvent);
    res.json({ ok: true, status });
  });

  router.get('/follow/:uid', async (req, res) => {
    const relationship = await blockRelationship(req.networkUser.uid, String(req.params.uid));
    if (relationship.blocked) return res.json({ following: false, ...relationship });
    const snap = await admin.firestore().collection('followers').doc(String(req.params.uid)).collection('members').doc(req.networkUser.uid).get();
    res.json({ following: snap.exists });
  });

  router.get('/blocks', async (req, res) => {
    const snap = await admin.firestore().collection('user_blocks').doc(req.networkUser.uid).collection('blocked').orderBy('createdAt', 'desc').get();
    const members = (await Promise.all(snap.docs.map(async (doc) => {
      try { return { ...(await publicIdentity(doc.id)), blockedAtMs: serializeTime(doc.data()?.createdAt) }; }
      catch { return null; }
    }))).filter(Boolean);
    res.json({ members });
  });

  router.get('/block/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '').trim();
    if (!targetUid || targetUid === req.networkUser.uid) return res.status(400).json({ error: 'Choose another account.' });
    res.json(await blockRelationship(req.networkUser.uid, targetUid));
  });

  router.post('/block/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '').trim();
    if (!targetUid || targetUid === req.networkUser.uid) return res.status(400).json({ error: 'You cannot block yourself.' });
    await admin.auth().getUser(targetUid);
    const db = admin.firestore();
    const conversationId = [req.networkUser.uid, targetUid].sort().join('__');
    const batch = db.batch();
    batch.set(blockRef(req.networkUser.uid, targetUid), { targetUid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    batch.delete(db.collection('followers').doc(targetUid).collection('members').doc(req.networkUser.uid));
    batch.delete(db.collection('following').doc(req.networkUser.uid).collection('members').doc(targetUid));
    batch.delete(db.collection('followers').doc(req.networkUser.uid).collection('members').doc(targetUid));
    batch.delete(db.collection('following').doc(targetUid).collection('members').doc(req.networkUser.uid));
    batch.set(db.collection('direct_conversations').doc(conversationId), { status: 'blocked', blockedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    const [targetFollowerCount, ownFollowerCount] = await Promise.all([followerCountForUid(targetUid), followerCountForUid(req.networkUser.uid)]);
    io?.emit?.('follower-count-updated', { uid: targetUid, followerCount: targetFollowerCount, updatedAtMs: Date.now() });
    io?.emit?.('follower-count-updated', { uid: req.networkUser.uid, followerCount: ownFollowerCount, updatedAtMs: Date.now() });
    io?.to(`user:${req.networkUser.uid}`).emit('user-blocked', { uid: targetUid });
    io?.to(`user:${targetUid}`).emit('user-blocked', { uid: req.networkUser.uid });
    res.json({ blocked: true, youBlocked: true, blockedYou: false });
  });

  router.delete('/block/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '').trim();
    await blockRef(req.networkUser.uid, targetUid).delete();
    const relationship = await blockRelationship(req.networkUser.uid, targetUid);
    if (!relationship.blocked) {
      const conversationId = [req.networkUser.uid, targetUid].sort().join('__');
      const conversationRef = admin.firestore().collection('direct_conversations').doc(conversationId);
      const conversation = await conversationRef.get();
      if (conversation.data()?.status === 'blocked') await conversationRef.set({ status: 'closed', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    res.json(relationship);
  });

  const networkMembers = async (uid, relationship) => {
    await admin.auth().getUser(uid);
    const collectionName = relationship === 'followers' ? 'followers' : 'following';
    const snap = await admin.firestore().collection(collectionName).doc(uid).collection('members').get();
    const members = (await Promise.all(snap.docs.map(async (member) => {
      const data = member.data() || {};
      const memberUid = String(relationship === 'followers' ? data.followerUid || member.id : data.targetUid || member.id).trim();
      if (!memberUid) return null;
      try {
        return {
          ...(await publicIdentity(memberUid)),
          followedAtMs: serializeTime(data.createdAt),
          activity: await activityForUid(memberUid),
        };
      } catch {
        return null;
      }
    }))).filter(Boolean);
    members.sort((a, b) => (b.followedAtMs || 0) - (a.followedAtMs || 0) || a.displayName.localeCompare(b.displayName));
    return members;
  };

  router.get('/following', async (req, res) => {
    try {
      res.json({ members: await networkMembers(req.networkUser.uid, 'following') });
    } catch {
      res.status(500).json({ error: 'Could not load the accounts you follow.' });
    }
  });

  router.get('/following/:uid', async (req, res) => {
    try { res.json({ members: await networkMembers(String(req.params.uid), 'following') }); }
    catch { res.status(404).json({ error: 'Could not load this member’s following list.' }); }
  });

  router.get('/followers', async (req, res) => {
    try {
      res.json({ members: await networkMembers(req.networkUser.uid, 'followers') });
    } catch {
      res.status(500).json({ error: 'Could not load your followers.' });
    }
  });

  router.get('/followers/:uid', async (req, res) => {
    try { res.json({ members: await networkMembers(String(req.params.uid), 'followers') }); }
    catch { res.status(404).json({ error: 'Could not load this member’s followers.' }); }
  });

  router.post('/follow/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '');
    if (!targetUid || targetUid === req.networkUser.uid) return res.status(400).json({ error: 'You cannot follow yourself.' });
    await admin.auth().getUser(targetUid);
    if ((await blockRelationship(req.networkUser.uid, targetUid)).blocked) return res.status(403).json({ error: 'You cannot follow this account because blocking is active.' });
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
    const followerCount = await followerCountForUid(targetUid);
    io?.emit?.('follower-count-updated', { uid: targetUid, followerCount, updatedAtMs: Date.now() });
    res.json({ following: true, followerCount });
  });

  router.delete('/follow/:uid', async (req, res) => {
    const targetUid = String(req.params.uid || '');
    const db = admin.firestore();
    const batch = db.batch();
    batch.delete(db.collection('followers').doc(targetUid).collection('members').doc(req.networkUser.uid));
    batch.delete(db.collection('following').doc(req.networkUser.uid).collection('members').doc(targetUid));
    await batch.commit();
    const followerCount = await followerCountForUid(targetUid);
    io?.emit?.('follower-count-updated', { uid: targetUid, followerCount, updatedAtMs: Date.now() });
    res.json({ following: false, followerCount });
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

