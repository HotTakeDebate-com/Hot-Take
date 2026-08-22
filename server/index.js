import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { ALLOWED_TOPIC_IDS } from '../shared/topics.js';
import { getRtcConfigForClient } from './rtcConfig.js';
import { createRateLimiter, getClientIp } from './rateLimit.js';
import { setupRedisIfConfigured, allowJoinQueueIp, shutdownRedisClients } from './redisOptional.js';
import admin from 'firebase-admin';
import { markMatchSessionReported, persistChatMessage, persistMatchSession } from './persistence.js';
import { attachModerationRoutes } from './moderationApi.js';
import { attachStaffRoutes } from './staffApi.js';
import { attachWarningRoutes } from './warningApi.js';
import { attachNetworkRoutes, notifyFollowersRoomCreated } from './networkApi.js';
import { createAnalyticsTracker } from './analytics.js';
import { attachDailyTakeRoutes } from './dailyTakeApi.js';
import { releaseDisplayNameClaim } from './displayNameClaims.js';
import { blockRelationship, usersHaveBlock } from './blocks.js';
import { createCallSessions } from './callSessions.js';
import { cleanupDeletedUserRelationships } from './accountRelationshipCleanup.js';

const joinQueueWindowMs = Math.max(
  5000,
  parseInt(process.env.RATE_LIMIT_JOIN_QUEUE_WINDOW_MS || '60000', 10) || 60000
);
const joinQueueMax = Math.max(
  1,
  parseInt(process.env.RATE_LIMIT_JOIN_QUEUE_MAX || '40', 10) || 40
);
const joinQueueLimiter = createRateLimiter({
  windowMs: joinQueueWindowMs,
  max: joinQueueMax,
});

const emailValidationWindowMs = Math.max(
  10_000,
  parseInt(process.env.EMAIL_VALIDATION_WINDOW_MS || '60000', 10) || 60_000
);
const emailValidationMax = Math.max(
  1,
  parseInt(process.env.EMAIL_VALIDATION_MAX || '10', 10) || 10
);
const emailValidationLimiter = createRateLimiter({
  windowMs: emailValidationWindowMs,
  max: emailValidationMax,
});

function cleanDisplayName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 100);
  return name || null;
}

/** Set true when REDIS_URL connects (Socket.IO adapter + shared join RL). */
const runtimeFlags = { redis: false };
let redisJoinClient = null;

async function allowJoinQueueAttempt(ip) {
  return allowJoinQueueIp(redisJoinClient, ip, joinQueueWindowMs, joinQueueMax, joinQueueLimiter);
}
const customLobbyTtlMs = Math.max(
  60_000,
  parseInt(process.env.CUSTOM_LOBBY_TTL_MS || '1800000', 10) || 1_800_000
);
const metricsLogEveryMs = Math.max(
  60_000,
  parseInt(process.env.METRICS_LOG_EVERY_MS || '300000', 10) || 300_000
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = join(__dirname, '..');
const dist = join(root, 'dist');

const app = express();
/** Trust first proxy hop (Railway, Render, etc.) so rate limits use real client IPs, not the proxy’s. Set TRUST_PROXY=0 if Node is exposed directly without a trusted reverse proxy. */
if (process.env.TRUST_PROXY !== '0') {
  app.set('trust proxy', 1);
}
const httpServer = createServer(app);
const serverStartedAt = Date.now();

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});
const callSessions = createCallSessions(io);

// --- Firebase Admin (Socket.IO auth binding) ---
let firebaseAdminReady = false;
let firebaseAdminVerifyUnavailable = false;
const REQUIRE_FIREBASE_TOKEN = process.env.REQUIRE_FIREBASE_TOKEN === 'true';

function tryInitFirebaseAdmin() {
  if (firebaseAdminReady) return;
  if (admin.apps?.length) {
    firebaseAdminReady = true;
    return;
  }

  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (raw) {
    try {
      // Accept either JSON string or base64-encoded JSON string.
      const decoded =
        raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseAdminReady = true;
      return;
    } catch (e) {
      console.warn('[socket.io] Firebase admin init failed (service account).', e?.message ?? e);
    }
  }

  // Fall back to Application Default Credentials if available.
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    firebaseAdminReady = true;
  } catch {
    /* ignore */
  }
}

tryInitFirebaseAdmin();

/**
 * When Admin SDK is up, every matchmaking / debate action must have `socket.data.uid` from a verified ID token.
 * Stops the “optional verification” hole where bad/missing tokens still connected.
 */
function rejectIfSocketUnverified(socket) {
  if (!firebaseAdminReady) return false;
  if (socket.data.uid && socket.data.emailVerified === true) return false;
  metrics.queueErrors += 1;
  if (!socket.data.uidRejectNotified) {
    socket.data.uidRejectNotified = true;
    socket.emit('queue-error', {
      code: socket.data.uid ? 'email_unverified' : 'auth_required',
      message: socket.data.uid
        ? 'Verify your email address before using matchmaking or creating a debate room.'
        : 'Could not verify your account. Refresh the page and sign in again.',
    });
  }
  return true;
}

if (REQUIRE_FIREBASE_TOKEN && !firebaseAdminReady) {
  console.error(
    '[socket.io] REQUIRE_FIREBASE_TOKEN=true but Firebase Admin is not configured. Refusing to start.'
  );
  process.exit(1);
}

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    if (REQUIRE_FIREBASE_TOKEN) return next(new Error('Missing Firebase auth token.'));
    // Dev mode: allow without verification.
    return next();
  }

  if (!firebaseAdminReady || firebaseAdminVerifyUnavailable) {
    if (REQUIRE_FIREBASE_TOKEN) return next(new Error('Firebase admin not configured.'));
    console.warn('[socket.io] Firebase admin not configured; skipping token verification.');
    return next();
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.email && decoded.email_verified !== true) {
      return next(new Error('Verify your email before using matchmaking.'));
    }
    const banRef = admin.firestore().collection('user_bans').doc(decoded.uid);
    const banSnap = await banRef.get();
    if (banSnap.exists) {
      const ban = banSnap.data() || {};
      const banUntilMs = ban.banUntil?.toMillis?.() || 0;
      const active = ban.active === true && (ban.permanent === true || banUntilMs > Date.now());
      if (active) {
        return next(new Error(ban.permanent === true
          ? 'This account is permanently banned.'
          : 'This account is temporarily banned.'));
      }
      if (ban.active === true && ban.permanent !== true) await banRef.delete().catch(() => {});
    }
    socket.data.uid = decoded.uid;
    socket.data.role = new Set([(process.env.HOT_TAKE_OWNER_EMAIL || 'justinself88@gmail.com').trim().toLowerCase(), 'andrewbarless@gmail.com']).has(decoded.email?.toLowerCase())
      ? 'owner' : String(decoded.role || 'user');
    socket.data.verifiedDebater = decoded.verifiedDebater === true;
    socket.data.premium = decoded.premium === true;
    socket.data.emailVerified = decoded.email_verified === true;
    socket.data.displayName = cleanDisplayName(decoded.name);
    socket.data.avatarUrl = '';
    if (decoded.email) {
      const profileSnap = await admin.firestore().collection('publicProfiles').doc(decoded.email.toLowerCase()).get();
      const profile = profileSnap.exists ? profileSnap.data() || {} : {};
      socket.data.avatarUrl = String(profile.avatarUrl || '');
      socket.data.displayName = cleanDisplayName(profile.displayName) ?? socket.data.displayName;
    }
    return next();
  } catch (e) {
    const msg = String(e?.message ?? e ?? '');
    if (!REQUIRE_FIREBASE_TOKEN && msg.toLowerCase().includes('project id')) {
      firebaseAdminVerifyUnavailable = true;
      console.warn(
        '[socket.io] Firebase Admin cannot verify tokens in this environment; disabling verification in optional mode.'
      );
      return next();
    }
    if (REQUIRE_FIREBASE_TOKEN) return next(new Error('Invalid Firebase auth token.'));
    console.warn('[socket.io] Invalid Firebase auth token; skipping verification.', e?.message ?? e);
    return next();
  }
});

/** @type {Map<string, { agree: string[], disagree: string[] }>} */
const queues = new Map();
/** @type {Map<string, { agree: string[], disagree: string[] }>} */
const customQueues = new Map();
/** @type {Map<string, { roomCode: string, statement: string, joinMode: 'open' | 'code', createdAtMs: number, createdBy: string, activeRoomId: string | null }>} */
const customGames = new Map();
/** Prevent overlapping queue/create/join operations for the same signed-in account. */
const activeMatchmakingOperations = new Set();
const analytics = createAnalyticsTracker({
  io,
  queues,
  customQueues,
  isAdminReady: () => firebaseAdminReady,
});

// Public, anonymous activity pulse for the homepage. This deliberately exposes
// aggregate counts only—never identities, topics, room codes, or socket IDs.
app.get('/api/live-stats', (_req, res) => {
  const snapshot = analytics.getLiveSnapshot();
  res.set('Cache-Control', 'no-store');
  res.json({
    onlineUsers: snapshot.onlineUsers,
    activeDebates: snapshot.activeDebates,
    searchingUsers: snapshot.searchingUsers,
    updatedAt: new Date().toISOString(),
  });
});
/** Keep periodic timer handle for stale custom lobby cleanup. */
let customLobbyCleanupTimer = null;
let metricsLogTimer = null;
const metrics = {
  quickJoinAttempts: 0,
  customCreateAttempts: 0,
  customJoinAttempts: 0,
  matches: 0,
  leaveDebate: 0,
  peerKicks: 0,
  peerLeftEvents: 0,
  queueErrors: 0,
  cleanupOrphaned: 0,
  cleanupExpired: 0,
  cleanupRecovered: 0,
};

const debateChatMaxLen = Math.min(
  4000,
  Math.max(500, parseInt(process.env.DEBATE_CHAT_MAX_LEN || '2000', 10) || 2000)
);
const debateChatPerMinute = Math.max(
  10,
  parseInt(process.env.DEBATE_CHAT_MAX_PER_MIN || '30', 10) || 30
);
/** Rate limit debate chat per socket id (rolling 60s window). */
const debateChatRate = new Map();

function logMetrics(reason = 'interval') {
  console.log(
    `[metrics:${reason}] quickJoin=${metrics.quickJoinAttempts} customCreate=${metrics.customCreateAttempts} customJoin=${metrics.customJoinAttempts} matches=${metrics.matches} leaveDebate=${metrics.leaveDebate} peerKicks=${metrics.peerKicks} peerLeft=${metrics.peerLeftEvents} queueErrors=${metrics.queueErrors} cleanup(orphaned=${metrics.cleanupOrphaned},expired=${metrics.cleanupExpired},recovered=${metrics.cleanupRecovered})`
  );
}

let shutdownMetricsLogged = false;
function logMetricsOnShutdown(signal) {
  if (shutdownMetricsLogged) return;
  shutdownMetricsLogged = true;
  logMetrics(`shutdown:${signal}`);
}

function getQueue(topicId) {
  if (!queues.has(topicId)) {
    queues.set(topicId, { agree: [], disagree: [] });
  }
  return queues.get(topicId);
}

function getCustomQueue(roomCode) {
  if (!customQueues.has(roomCode)) {
    customQueues.set(roomCode, { agree: [], disagree: [] });
  }
  return customQueues.get(roomCode);
}

function removeFromQueue(socketId, topicId, side) {
  const q = queues.get(topicId);
  if (!q) return;
  const arr = side === 'agree' ? q.agree : q.disagree;
  const i = arr.indexOf(socketId);
  if (i !== -1) arr.splice(i, 1);
  if (q.agree.length === 0 && q.disagree.length === 0) queues.delete(topicId);
}

/** Remove sockets that disconnected, changed queues, or already entered a room. */
function pruneQuickQueue(topicId) {
  const q = queues.get(topicId);
  if (!q) return;
  for (const side of ['agree', 'disagree']) {
    q[side] = q[side].filter((socketId) => {
      const queuedSocket = io.sockets.sockets.get(socketId);
      return !!queuedSocket &&
        queuedSocket.connected &&
        queuedSocket.data.matchType === 'quick' &&
        queuedSocket.data.topicId === topicId &&
        queuedSocket.data.side === side &&
        !queuedSocket.data.roomId;
    });
  }
  if (q.agree.length === 0 && q.disagree.length === 0) queues.delete(topicId);
}

app.get('/health', (_req, res) => {
  const socketAuth = REQUIRE_FIREBASE_TOKEN ? 'enforced' : firebaseAdminReady ? 'optional' : 'off';
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    uptimeSec: Math.floor((Date.now() - serverStartedAt) / 1000),
    socketAuth,
    firebaseAdmin: firebaseAdminReady,
    redis: runtimeFlags.redis,
  });
});

app.get('/api/rtc-config', async (_req, res) => {
  res.json(await getRtcConfigForClient());
});

// Profile pictures are cropped and compressed in the browser, then sent as a data URL.
// Keep this bounded above the 250 KB avatar limit so staff updates are accepted.
app.use(express.json({ limit: '384kb' }));

/**
 * Google can replace Firebase Auth's displayName when it is linked to an
 * existing password account. Restore the display name that Hot Take already
 * reserved for this UID instead of trusting the provider profile name.
 */
app.post('/api/auth/restore-display-name', async (req, res) => {
  if (!firebaseAdminReady) return res.status(503).json({ error: 'Account profiles are temporarily unavailable.' });
  const match = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return res.status(401).json({ error: 'Sign-in required.' });
  try {
    const claims = await admin.auth().verifyIdToken(match[1].trim(), true);
    const owner = await admin.firestore().collection('display_name_owners').doc(claims.uid).get();
    const displayName = String(owner.data()?.displayName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!displayName) return res.json({ ok: true, restored: false, displayName: '' });

    const user = await admin.auth().getUser(claims.uid);
    if (user.displayName !== displayName) await admin.auth().updateUser(claims.uid, { displayName });
    const email = String(user.email || claims.email || '').trim().toLowerCase();
    if (email) {
      await admin.firestore().collection('publicProfiles').doc(email).set({
        uid: claims.uid,
        displayName,
        displayNameNormalized: displayName.toLocaleLowerCase(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    res.json({ ok: true, restored: user.displayName !== displayName, displayName });
  } catch {
    res.status(401).json({ error: 'Your account name could not be verified.' });
  }
});

/**
 * Check mailbox deliverability before the browser creates a Firebase email/password account.
 * The provider key stays server-side in Railway. Firebase email verification remains the
 * separate proof that the registrant controls the mailbox.
 */
app.post('/api/auth/validate-email', async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (!emailValidationLimiter(ip)) {
    return res.status(429).json({
      ok: false,
      code: 'rate_limited',
      message: 'Too many email checks. Please wait a minute and try again.',
    });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json({
      ok: false,
      code: 'invalid_format',
      message: 'Enter a valid email address.',
    });
  }

  const apiKey = process.env.EMAILABLE_API_KEY;
  if (!apiKey) {
    console.error('[email-validation] EMAILABLE_API_KEY is not configured.');
    return res.status(503).json({
      ok: false,
      code: 'validation_unavailable',
      message: 'Email validation is temporarily unavailable. Please try again later.',
    });
  }

  try {
    const url = new URL('https://api.emailable.com/v1/verify');
    url.searchParams.set('email', email);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('smtp', 'true');
    url.searchParams.set('accept_all', 'true');
    url.searchParams.set('timeout', '8');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error('[email-validation] Provider error:', response.status);
      return res.status(503).json({
        ok: false,
        code: 'validation_unavailable',
        message: 'Email validation is temporarily unavailable. Please try again later.',
      });
    }

    const result = await response.json();
    const deliverable =
      result?.state === 'deliverable' &&
      result?.disposable !== true &&
      result?.accept_all !== true &&
      result?.mailbox_full !== true;

    if (!deliverable) {
      return res.status(422).json({
        ok: false,
        code: result?.disposable === true ? 'disposable_email' : 'email_not_deliverable',
        message:
          result?.disposable === true
            ? 'Temporary or disposable email addresses are not allowed.'
            : 'This email address could not be confirmed as a working mailbox. Check it or use Google sign-in.',
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[email-validation] Check failed:', error?.message ?? error);
    return res.status(503).json({
      ok: false,
      code: 'validation_unavailable',
      message: 'Email validation is temporarily unavailable. Please try again later.',
    });
  }
});


/**
 * Permanently delete the signed-in Firebase account and app-owned data.
 * A recently issued credential is required so a stolen long-lived browser session
 * cannot delete the account without the owner signing in again.
 */
app.delete('/api/account', async (req, res) => {
  if (!firebaseAdminReady) {
    return res.status(503).json({
      ok: false,
      message: 'Account deletion is temporarily unavailable. Please try again later.',
    });
  }

  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ ok: false, message: 'Sign in again before deleting your account.' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token, true);
    const authenticatedAt = Number(decoded.auth_time || 0);
    const credentialAgeSeconds = Math.floor(Date.now() / 1000) - authenticatedAt;
    if (!authenticatedAt || credentialAgeSeconds > 10 * 60) {
      return res.status(401).json({
        ok: false,
        code: 'recent_sign_in_required',
        message: 'For security, sign out and sign back in, then try deleting your account again.',
      });
    }

    const uid = decoded.uid;
    const emailKey = String(decoded.email || '').trim().toLowerCase();
    const firestore = admin.firestore();

    const deleteMatchingDocuments = async (collectionName, field, value) => {
      while (true) {
        const snapshot = await firestore
          .collection(collectionName)
          .where(field, '==', value)
          .limit(200)
          .get();
        if (snapshot.empty) break;
        const batch = firestore.batch();
        snapshot.docs.forEach((document) => batch.delete(document.ref));
        await batch.commit();
        if (snapshot.size < 200) break;
      }
    };

    // Remove private nested data first, then public/social and moderation records.
    if (emailKey) {
      const userRef = firestore.collection('users').doc(emailKey);
      await firestore.recursiveDelete(userRef);
      await firestore.collection('publicProfiles').doc(emailKey).delete().catch(() => {});
    }
    await deleteMatchingDocuments('posts', 'authorUid', uid);
    await deleteMatchingDocuments('reports', 'reporterUid', uid);
    await deleteMatchingDocuments('debates', 'uid', uid);
    const { followerCounts } = await cleanupDeletedUserRelationships(uid, firestore);
    followerCounts.forEach((followerCount, affectedUid) => {
      io.emit('follower-count-updated', { uid: affectedUid, followerCount, updatedAtMs: Date.now() });
    });
    await releaseDisplayNameClaim(uid, firestore);

    // Authentication is removed last so a partial Firestore failure can be retried safely.
    await admin.auth().deleteUser(uid);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[account-delete] Failed:', error?.message ?? error);
    if (error?.code === 'auth/id-token-revoked' || error?.code === 'auth/user-not-found') {
      return res.status(401).json({ ok: false, message: 'Sign in again before deleting your account.' });
    }
    return res.status(500).json({
      ok: false,
      message: 'We could not finish deleting your account. Please try again or contact support.',
    });
  }
});

attachModerationRoutes(app, { isAdminReady: () => firebaseAdminReady });
attachDailyTakeRoutes(app, { isAdminReady: () => firebaseAdminReady });
attachStaffRoutes(app, { isAdminReady: () => firebaseAdminReady, io, customGames });
attachWarningRoutes(app, { isAdminReady: () => firebaseAdminReady });
attachNetworkRoutes(app, { isAdminReady: () => firebaseAdminReady, io });

if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })
  );
  app.get('*', (req, res, next) => {
    // Let Socket.IO HTTP transport and other /api routes bypass SPA fallback.
    if (req.path.startsWith('/socket.io')) return next();
    if (req.path.startsWith('/api/')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(dist, 'index.html'));
  });
}

function removeFromCustomQueue(socketId, side, roomCode) {
  const q = customQueues.get(roomCode);
  if (!q) return;
  const arr = side === 'agree' ? q.agree : q.disagree;
  const i = arr.indexOf(socketId);
  if (i !== -1) arr.splice(i, 1);
  if (q.agree.length === 0 && q.disagree.length === 0) {
    customQueues.delete(roomCode);
  }
}

function activeCustomWaiters(roomCode) {
  const q = customQueues.get(roomCode);
  if (!q) return [];
  q.disagree = q.disagree.filter((socketId) => {
    const queuedSocket = io.sockets.sockets.get(socketId);
    return !!queuedSocket && queuedSocket.connected &&
      queuedSocket.data.matchType === 'custom' &&
      queuedSocket.data.customRoomCode === roomCode &&
      queuedSocket.data.side === 'disagree' &&
      !queuedSocket.data.roomId;
  });
  return q.disagree;
}

function emitCustomQueuePositions(roomCode) {
  const waiters = activeCustomWaiters(roomCode);
  const game = customGames.get(roomCode);
  const hostSocket = game ? io.sockets.sockets.get(game.createdBy) : null;
  hostSocket?.emit('custom-queue-count', {
    roomCode,
    queueLength: waiters.length,
  });
  waiters.forEach((socketId, index) => {
    io.sockets.sockets.get(socketId)?.emit('custom-queue-status', {
      roomCode,
      position: index + 1,
      totalWaiting: waiters.length,
    });
  });
}

function closeCustomWaitingLine(roomCode, message = 'This debate room has closed.') {
  const q = customQueues.get(roomCode);
  for (const socketId of q?.disagree || []) {
    const queuedSocket = io.sockets.sockets.get(socketId);
    if (!queuedSocket || queuedSocket.data.roomId) continue;
    queuedSocket.emit('queue-error', { code: 'room_closed', message });
    queuedSocket.data.matchType = null;
    queuedSocket.data.topicId = null;
    queuedSocket.data.side = null;
    queuedSocket.data.customRoomCode = null;
  }
  customQueues.delete(roomCode);
}

async function matchCustomChallenger(game, challengerSocket) {
  const hostSocket = io.sockets.sockets.get(game.createdBy);
  if (!hostSocket?.connected || !challengerSocket?.connected || hostSocket.data.roomId || challengerSocket.data.roomId) return false;
  if (firebaseAdminReady && await usersHaveBlock(hostSocket.data.uid, challengerSocket.data.uid)) return false;
  const roomId = `custom-${game.roomCode}-${challengerSocket.id}-${hostSocket.id}`;
  hostSocket.data.matchType = 'custom';
  hostSocket.data.side = 'agree';
  hostSocket.data.customRoomCode = game.roomCode;
  hostSocket.data.roomId = roomId;
  hostSocket.join(roomId);
  challengerSocket.data.roomId = roomId;
  challengerSocket.join(roomId);
  game.activeRoomId = roomId;
  void persistMatchSession(firebaseAdminReady, { roomId, agreeUid: hostSocket.data.uid ?? null, disagreeUid: challengerSocket.data.uid ?? null, topicId: 'custom', matchMode: 'custom', roomCode: game.roomCode, statement: game.statement });
  hostSocket.emit('matched', { roomId, isOfferer: false, topicId: null, yourSide: 'agree', matchMode: 'custom', roomCode: game.roomCode, statement: game.statement, peerUid: challengerSocket.data.uid ?? null, peerDisplayName: challengerSocket.data.displayName ?? null, peerAvatarUrl: challengerSocket.data.avatarUrl ?? '', peerRole: challengerSocket.data.role ?? 'user', peerVerified: challengerSocket.data.verifiedDebater === true, peerPremium: challengerSocket.data.premium === true });
  challengerSocket.emit('matched', { roomId, isOfferer: true, topicId: null, yourSide: 'disagree', matchMode: 'custom', roomCode: game.roomCode, statement: game.statement, peerUid: hostSocket.data.uid ?? null, peerDisplayName: hostSocket.data.displayName ?? game.creatorDisplayName ?? null, peerAvatarUrl: hostSocket.data.avatarUrl ?? game.creatorAvatarUrl ?? '', peerRole: hostSocket.data.role ?? game.creatorRole ?? 'user', peerVerified: hostSocket.data.verifiedDebater === true || game.creatorVerified === true, peerPremium: hostSocket.data.premium === true || game.creatorPremium === true });
  metrics.matches += 1;
  analytics.recordMatch('custom', 'custom', roomId);
  emitCustomQueuePositions(game.roomCode);
  io.emit('custom-games-updated', listCustomGames());
  return true;
}

async function promoteNextCustomChallenger(game) {
  if (!game || game.activeRoomId) return false;
  const waiters = activeCustomWaiters(game.roomCode);
  while (waiters.length) {
    const nextSocket = io.sockets.sockets.get(waiters.shift());
    if (nextSocket && await matchCustomChallenger(game, nextSocket)) return true;
  }
  emitCustomQueuePositions(game.roomCode);
  return false;
}

function queueHostForCustomLobby(game) {
  const hostSocket = io.sockets.sockets.get(game.createdBy);
  if (!hostSocket) return false;
  hostSocket.data.matchType = 'custom';
  hostSocket.data.side = 'agree';
  hostSocket.data.customRoomCode = game.roomCode;
  hostSocket.data.topicId = null;
  hostSocket.data.roomId = null;
  const q = getCustomQueue(game.roomCode);
  if (!q.agree.includes(hostSocket.id)) q.agree.push(hostSocket.id);
  return true;
}

function roomCodeOk(roomCode) {
  return /^[A-Z0-9_-]{3,24}$/.test(roomCode);
}

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function isSocketConnected(id) {
  return io.sockets.sockets.has(id);
}

function listCustomGames() {
  return Array.from(customGames.values())
    .filter((g) => g.joinMode === 'open')
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map((g) => {
      const creator = io.sockets.sockets.get(g.createdBy);
      return {
        roomCode: g.roomCode,
        statement: g.statement,
        joinMode: g.joinMode,
        createdAtMs: g.createdAtMs,
        creatorUid: g.creatorUid || creator?.data?.uid || null,
        creatorDisplayName: g.creatorDisplayName || creator?.data?.displayName || 'Hot Take member',
        creatorAvatarUrl: g.creatorAvatarUrl || creator?.data?.avatarUrl || '',
        creatorRole: g.creatorRole || creator?.data?.role || 'user',
        creatorPremium: g.creatorPremium === true || creator?.data?.premium === true,
        creatorVerified: g.creatorVerified === true || creator?.data?.verifiedDebater === true,
        active: Boolean(g.activeRoomId),
        queueLength: activeCustomWaiters(g.roomCode).length,
      };
    });
}

function cleanupStaleCustomLobbies() {
  const now = Date.now();
  let changed = false;
  const removedOrphaned = [];
  const removedExpired = [];
  const recoveredActive = [];

  for (const [roomCode, game] of customGames.entries()) {
    if (!isSocketConnected(game.createdBy)) {
      closeCustomWaitingLine(roomCode, 'The host left this debate room.');
      customGames.delete(roomCode);
      changed = true;
      removedOrphaned.push(roomCode);
      continue;
    }

    if (!game.activeRoomId && now - game.createdAtMs > customLobbyTtlMs) {
      closeCustomWaitingLine(roomCode, 'This debate room expired.');
      customGames.delete(roomCode);
      changed = true;
      removedExpired.push(roomCode);
      continue;
    }

    if (game.activeRoomId) {
      const room = io.sockets.adapter.rooms.get(game.activeRoomId);
      if (!room || room.size < 2) {
        game.activeRoomId = null;
        changed = true;
        recoveredActive.push(roomCode);
      }
    }
  }

  if (changed) {
    metrics.cleanupOrphaned += removedOrphaned.length;
    metrics.cleanupExpired += removedExpired.length;
    metrics.cleanupRecovered += recoveredActive.length;
    const summary = [
      removedOrphaned.length > 0 ? `orphaned=${removedOrphaned.length}` : null,
      removedExpired.length > 0 ? `expired=${removedExpired.length}` : null,
      recoveredActive.length > 0 ? `recovered=${recoveredActive.length}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`[custom-lobby-cleanup] ${summary || 'changes=0'}`);
    if (removedOrphaned.length > 0) {
      console.log(`[custom-lobby-cleanup] orphaned codes: ${removedOrphaned.join(', ')}`);
    }
    if (removedExpired.length > 0) {
      console.log(`[custom-lobby-cleanup] expired codes: ${removedExpired.join(', ')}`);
    }
    if (recoveredActive.length > 0) {
      console.log(`[custom-lobby-cleanup] recovered codes: ${recoveredActive.join(', ')}`);
    }
    io.emit('custom-games-updated', listCustomGames());
  }
}

if (!customLobbyCleanupTimer) {
  // Sweep stale lobbies every minute.
  customLobbyCleanupTimer = setInterval(cleanupStaleCustomLobbies, 60_000);
  // Do not keep process alive solely for cleanup timer.
  customLobbyCleanupTimer.unref?.();
}

if (!metricsLogTimer) {
  metricsLogTimer = setInterval(() => logMetrics('interval'), metricsLogEveryMs);
  metricsLogTimer.unref?.();
}

io.on('connection', (socket) => {
  if (socket.data.uid) socket.join(`user:${socket.data.uid}`);
  if (['moderator', 'admin', 'owner'].includes(socket.data.role)) socket.join('staff:verification');
  const hasConcurrentSessionForUid = () => {
    const uid = socket.data.uid;
    if (!uid) return false;
    for (const other of io.sockets.sockets.values()) {
      if (other.id === socket.id) continue;
      if (other.data.uid !== uid) continue;
      if (other.data.matchType || other.data.roomId) return true;
    }
    return false;
  };

  const emitCustomGamesUpdate = () => {
    io.emit('custom-games-updated', listCustomGames());
  };

  const normalizeSocketPayload = (payload) => (
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  );

  const reportSocketHandlerError = (eventName, error) => {
    console.error(`[socket:${eventName}]`, error?.stack || error?.message || error);
    metrics.queueErrors += 1;
    if (socket.connected && eventName !== 'disconnect') {
      socket.emit('queue-error', {
        code: 'server_error',
        message: 'The server could not complete that request. Please try again.',
      });
    }
  };

  const onSafe = (eventName, handler, { rawPayload = false } = {}) => {
    socket.on(eventName, (...args) => {
      const payload = rawPayload ? args[0] : normalizeSocketPayload(args[0]);
      Promise.resolve().then(() => handler(payload, ...args.slice(1))).catch((error) => {
        reportSocketHandlerError(eventName, error);
      });
    });
  };

  const onMatchmaking = (eventName, handler) => {
    onSafe(eventName, async (payload) => {
      const operationKey = socket.data.uid ? `uid:${socket.data.uid}` : `socket:${socket.id}`;
      if (activeMatchmakingOperations.has(operationKey)) {
        metrics.queueErrors += 1;
        socket.emit('queue-error', {
          code: 'operation_in_progress',
          message: 'Your previous matchmaking request is still processing. Please wait a moment.',
        });
        return;
      }
      activeMatchmakingOperations.add(operationKey);
      try {
        await handler(payload);
      } finally {
        activeMatchmakingOperations.delete(operationKey);
      }
    });
  };

  const clearRoom = () => {
    socket.data.roomId = null;
  };

  const clearMatchmaking = () => {
    const customCode = socket.data.customRoomCode;
    if (socket.data.matchType === 'quick' && socket.data.topicId && socket.data.side) {
      removeFromQueue(socket.id, socket.data.topicId, socket.data.side);
    }
    if (
      socket.data.matchType === 'custom' &&
      socket.data.side &&
      socket.data.customRoomCode
    ) {
      removeFromCustomQueue(socket.id, socket.data.side, socket.data.customRoomCode);
      const game = customGames.get(socket.data.customRoomCode);
      if (game && game.createdBy === socket.id) {
        closeCustomWaitingLine(socket.data.customRoomCode, 'The host closed this debate room.');
        customGames.delete(socket.data.customRoomCode);
      }
      emitCustomGamesUpdate();
    }
    socket.data.matchType = null;
    socket.data.topicId = null;
    socket.data.side = null;
    socket.data.customRoomCode = null;
    clearRoom();
    if (customCode) emitCustomQueuePositions(customCode);
  };

  socket.emit('custom-games-updated', listCustomGames());

  const getRoomAgreeDisagreeUids = (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return { agreeUid: null, disagreeUid: null };
    let agreeUid = null;
    let disagreeUid = null;
    for (const sid of room) {
      const s = io.sockets.sockets.get(sid);
      if (!s?.data) continue;
      if (s.data.side === 'agree') agreeUid = s.data.uid ?? null;
      if (s.data.side === 'disagree') disagreeUid = s.data.uid ?? null;
    }
    return { agreeUid, disagreeUid };
  };

  onMatchmaking('join-queue', async ({ topicId, side, displayName }) => {
    metrics.quickJoinAttempts += 1;
    if (rejectIfSocketUnverified(socket)) return;
    if (hasConcurrentSessionForUid()) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'already_active',
        message:
          'You already have an active debate or queue in another tab/window. End it before joining again.',
      });
      return;
    }

    const ip = getClientIp(socket);
    if (!(await allowJoinQueueAttempt(ip))) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'rate_limited',
        message:
          'Too many matchmaking attempts from this network. Please wait a bit and try again.',
      });
      return;
    }

    if (!topicId || !ALLOWED_TOPIC_IDS.has(topicId) || (side !== 'agree' && side !== 'disagree')) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', { message: 'Invalid topic or side.' });
      return;
    }

    clearMatchmaking();

    socket.data.matchType = 'quick';
    socket.data.displayName = cleanDisplayName(displayName) ?? socket.data.displayName;
    socket.data.topicId = topicId;
    socket.data.side = side;
    analytics.recordQueueJoin(topicId, side, 'quick');

    pruneQuickQueue(topicId);
    const q = getQueue(topicId);
    const opposite = side === 'agree' ? 'disagree' : 'agree';
    const oppositeList = q[opposite];
    const blockedPeers = [];

    while (oppositeList.length > 0) {
      const peerId = oppositeList.shift();
      const peerSocket = io.sockets.sockets.get(peerId);
      if (
        !peerSocket ||
        !peerSocket.connected ||
        peerSocket.data.matchType !== 'quick' ||
        peerSocket.data.topicId !== topicId ||
        peerSocket.data.side !== opposite ||
        peerSocket.data.roomId
      ) {
        continue;
      }
      if (firebaseAdminReady && await usersHaveBlock(socket.data.uid, peerSocket.data.uid)) {
        blockedPeers.push(peerId);
        continue;
      }
      oppositeList.unshift(...blockedPeers);
      const roomId = `${topicId}-${socket.id}-${peerId}`;

      socket.data.roomId = roomId;
      socket.join(roomId);

      peerSocket.data.roomId = roomId;
      peerSocket.join(roomId);

      const agreeUidQuick =
        socket.data.side === 'agree' ? socket.data.uid ?? null : peerSocket.data.uid ?? null;
      const disagreeUidQuick =
        socket.data.side === 'disagree' ? socket.data.uid ?? null : peerSocket.data.uid ?? null;
      void persistMatchSession(firebaseAdminReady, {
        roomId,
        agreeUid: agreeUidQuick,
        disagreeUid: disagreeUidQuick,
        topicId,
        matchMode: 'quick',
        roomCode: null,
        statement: null,
      });

      peerSocket.emit('matched', {
        roomId,
        isOfferer: false,
        topicId,
        yourSide: peerSocket.data.side,
        peerUid: socket.data.uid ?? null,
        peerDisplayName: socket.data.displayName ?? null,
        peerAvatarUrl: socket.data.avatarUrl ?? '',
        peerRole: socket.data.role ?? 'user',
        peerVerified: socket.data.verifiedDebater === true,
        peerPremium: socket.data.premium === true,
      });

      socket.emit('matched', {
        roomId,
        isOfferer: true,
        topicId,
        yourSide: side,
        peerUid: peerSocket.data.uid ?? null,
        peerDisplayName: peerSocket.data.displayName ?? null,
        peerAvatarUrl: peerSocket.data.avatarUrl ?? '',
        peerRole: peerSocket.data.role ?? 'user',
        peerVerified: peerSocket.data.verifiedDebater === true,
        peerPremium: peerSocket.data.premium === true,
      });
      metrics.matches += 1;
      analytics.recordMatch(topicId, 'quick', roomId);
      return;
    }
    oppositeList.unshift(...blockedPeers);

    const myList = side === 'agree' ? q.agree : q.disagree;
    if (!myList.includes(socket.id)) myList.push(socket.id);
    socket.emit('queued', { topicId, side });
  });

  onMatchmaking('create-custom-game', async ({ statement, joinMode, displayName }) => {
    metrics.customCreateAttempts += 1;
    if (rejectIfSocketUnverified(socket)) return;
    if (hasConcurrentSessionForUid()) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'already_active',
        message:
          'You already have an active debate or queue in another tab/window. End it before creating another lobby.',
      });
      return;
    }

    const ip = getClientIp(socket);
    if (!(await allowJoinQueueAttempt(ip))) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'rate_limited',
        message:
          'Too many matchmaking attempts from this network. Please wait a bit and try again.',
      });
      return;
    }

    const cleanStatement = String(statement || '').trim().replace(/\s+/g, ' ').slice(0, 240);
    if (cleanStatement.length < 8) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', { message: 'Add a statement with at least 8 characters.' });
      return;
    }
    const normalizedJoinMode = joinMode === 'code' ? 'code' : 'open';

    clearMatchmaking();

    let roomCode = createRoomCode();
    while (customGames.has(roomCode)) {
      roomCode = createRoomCode();
    }

    customGames.set(roomCode, {
      roomCode,
      statement: cleanStatement,
      joinMode: normalizedJoinMode,
      createdAtMs: Date.now(),
      createdBy: socket.id,
      activeRoomId: null,
      creatorUid: socket.data.uid ?? null,
      creatorDisplayName: socket.data.displayName ?? cleanDisplayName(displayName),
      creatorAvatarUrl: socket.data.avatarUrl ?? '',
      creatorRole: socket.data.role ?? 'user',
      creatorPremium: socket.data.premium === true,
      creatorVerified: socket.data.verifiedDebater === true,
    });

    socket.data.matchType = 'custom';
    socket.data.displayName = cleanDisplayName(displayName) ?? socket.data.displayName;
    socket.data.side = 'agree';
    socket.data.customRoomCode = roomCode;

    const q = getCustomQueue(roomCode);
    if (!q.agree.includes(socket.id)) q.agree.push(socket.id);

    socket.emit('custom-game-created', {
      roomCode,
      statement: cleanStatement,
      joinMode: normalizedJoinMode,
    });
    socket.emit('queued', {
      side: 'agree',
      roomCode,
      matchMode: 'custom',
    });
    emitCustomGamesUpdate();
    void notifyFollowersRoomCreated({
      isAdminReady: () => firebaseAdminReady,
      io,
      hostUid: socket.data.uid,
      roomCode,
      statement: cleanStatement,
      joinMode: normalizedJoinMode,
    });
  });

  onMatchmaking('join-custom-room', async ({ side, roomCode, displayName }) => {
    metrics.customJoinAttempts += 1;
    if (rejectIfSocketUnverified(socket)) return;
    if (hasConcurrentSessionForUid()) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'already_active',
        message:
          'You already have an active debate or queue in another tab/window. End it before joining again.',
      });
      return;
    }

    const ip = getClientIp(socket);
    if (!(await allowJoinQueueAttempt(ip))) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'rate_limited',
        message:
          'Too many matchmaking attempts from this network. Please wait a bit and try again.',
      });
      return;
    }

    const normalizedRoomCode = String(roomCode || '').trim().toUpperCase();
    if ((side !== 'agree' && side !== 'disagree') || !roomCodeOk(normalizedRoomCode)) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        message: 'Invalid side or room code. Use 3-24 letters/numbers.',
      });
      return;
    }

    const game = customGames.get(normalizedRoomCode);
    if (!game) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', { message: 'That custom game is no longer available.' });
      return;
    }
    if (firebaseAdminReady && game.creatorUid && socket.data.uid) {
      const relationship = await blockRelationship(socket.data.uid, game.creatorUid);
      if (relationship.blocked) {
        metrics.queueErrors += 1;
        socket.emit('queue-error', {
          code: 'blocked_user',
          message: relationship.youBlocked
            ? 'You have this user blocked and are unable to join or queue for their room.'
            : 'You are unable to join or queue for this room.',
        });
        return;
      }
    }
    clearMatchmaking();

    socket.data.matchType = 'custom';
    socket.data.displayName = cleanDisplayName(displayName) ?? socket.data.displayName;
    socket.data.topicId = null;
    socket.data.side = side;
    socket.data.customRoomCode = normalizedRoomCode;

    const q = getCustomQueue(normalizedRoomCode);
    if (game.activeRoomId) {
      if (!q.disagree.includes(socket.id)) q.disagree.push(socket.id);
      emitCustomQueuePositions(normalizedRoomCode);
      socket.emit('queued', { side: 'disagree', roomCode: normalizedRoomCode, matchMode: 'custom', queuedForHost: true });
      emitCustomGamesUpdate();
      return;
    }
    const opposite = side === 'agree' ? 'disagree' : 'agree';
    const oppositeList = q[opposite];

    while (oppositeList.length > 0) {
      const peerId = oppositeList.shift();
      const peerSocket = io.sockets.sockets.get(peerId);
      if (!peerSocket) {
        continue;
      }
      const roomId = `custom-${normalizedRoomCode}-${socket.id}-${peerId}`;

      socket.data.roomId = roomId;
      socket.join(roomId);

      peerSocket.data.roomId = roomId;
      peerSocket.join(roomId);

      const agreeUidCustom =
        socket.data.side === 'agree' ? socket.data.uid ?? null : peerSocket.data.uid ?? null;
      const disagreeUidCustom =
        socket.data.side === 'disagree' ? socket.data.uid ?? null : peerSocket.data.uid ?? null;
      void persistMatchSession(firebaseAdminReady, {
        roomId,
        agreeUid: agreeUidCustom,
        disagreeUid: disagreeUidCustom,
        topicId: 'custom',
        matchMode: 'custom',
        roomCode: normalizedRoomCode,
        statement: game.statement,
      });

      peerSocket.emit('matched', {
        roomId,
        isOfferer: false,
        topicId: null,
        yourSide: peerSocket.data.side,
        matchMode: 'custom',
        roomCode: normalizedRoomCode,
        statement: game.statement,
        peerUid: socket.data.uid ?? null,
        peerDisplayName: socket.data.displayName ?? null,
        peerAvatarUrl: socket.data.avatarUrl ?? '',
        peerRole: socket.data.role ?? 'user',
        peerVerified: socket.data.verifiedDebater === true,
        peerPremium: socket.data.premium === true,
      });

      socket.emit('matched', {
        roomId,
        isOfferer: true,
        topicId: null,
        yourSide: side,
        matchMode: 'custom',
        roomCode: normalizedRoomCode,
        statement: game.statement,
        peerUid: peerSocket.data.uid ?? null,
        peerDisplayName: peerSocket.data.displayName ?? null,
        peerAvatarUrl: peerSocket.data.avatarUrl ?? '',
        peerRole: peerSocket.data.role ?? 'user',
        peerVerified: peerSocket.data.verifiedDebater === true,
        peerPremium: peerSocket.data.premium === true,
      });
      metrics.matches += 1;
      game.activeRoomId = roomId;
      emitCustomQueuePositions(normalizedRoomCode);
      emitCustomGamesUpdate();
      return;
    }

    const myList = side === 'agree' ? q.agree : q.disagree;
    if (!myList.includes(socket.id)) myList.push(socket.id);
    socket.emit('queued', {
      side,
      roomCode: normalizedRoomCode,
      matchMode: 'custom',
    });
    emitCustomQueuePositions(normalizedRoomCode);
    emitCustomGamesUpdate();
  });

  socket.on('leave-queue', () => {
    clearMatchmaking();
  });

  onSafe('kick-peer', async ({ roomId }) => {
    if (rejectIfSocketUnverified(socket)) return;
    if (!roomId || roomId !== socket.data.roomId) return;
    callSessions.removeSocket(socket, roomId);
    if (socket.data.matchType !== 'custom' || !socket.data.customRoomCode) return;

    const game = customGames.get(socket.data.customRoomCode);
    if (!game || game.createdBy !== socket.id) return;

    const members = io.sockets.adapter.rooms.get(roomId);
    if (!members) return;

    for (const memberId of members) {
      if (memberId === socket.id) continue;
      const peerSocket = io.sockets.sockets.get(memberId);
      if (!peerSocket) continue;
      peerSocket.emit('peer-kicked');
      peerSocket.leave(roomId);
      peerSocket.data.roomId = null;
      peerSocket.data.matchType = null;
      peerSocket.data.topicId = null;
      peerSocket.data.side = null;
      peerSocket.data.customRoomCode = null;
    }

    socket.leave(roomId);
    analytics.recordMatchEnd(roomId);
    socket.data.roomId = null;
    game.activeRoomId = null;
    queueHostForCustomLobby(game);
    metrics.peerKicks += 1;

    const promoted = await promoteNextCustomChallenger(game);
    if (!promoted) socket.emit('custom-lobby-waiting', { roomCode: game.roomCode, statement: game.statement });
    emitCustomGamesUpdate();
  });

  onSafe('leave-debate', async () => {
    metrics.leaveDebate += 1;
    const rid = socket.data.roomId;
    if (!rid) {
      // Custom host waiting alone (no WebRTC room yet) — still must remove lobby + queue state
      if (socket.data.matchType === 'custom' && socket.data.customRoomCode) {
        const game = customGames.get(socket.data.customRoomCode);
        if (game && game.createdBy === socket.id) {
          closeCustomWaitingLine(socket.data.customRoomCode, 'The host closed this debate room.');
          customGames.delete(socket.data.customRoomCode);
        }
        clearMatchmaking();
        emitCustomGamesUpdate();
      }
      return;
    }

    callSessions.removeSocket(socket, rid);

    analytics.recordMatchEnd(rid);

    if (socket.data.matchType === 'custom' && socket.data.customRoomCode) {
      const game = customGames.get(socket.data.customRoomCode);
      const isHost = !!game && game.createdBy === socket.id;
      socket.to(rid).emit('peer-left');
      metrics.peerLeftEvents += 1;
      socket.leave(rid);
      clearRoom();

      if (game && game.activeRoomId === rid) {
        game.activeRoomId = null;
      }
      if (isHost && game) {
        closeCustomWaitingLine(socket.data.customRoomCode, 'The host ended this debate room.');
        customGames.delete(socket.data.customRoomCode);
        clearMatchmaking();
      } else if (game) {
        queueHostForCustomLobby(game);
        const hostSocket = io.sockets.sockets.get(game.createdBy);
        const promoted = await promoteNextCustomChallenger(game);
        if (hostSocket && !promoted) {
          hostSocket.emit('custom-lobby-waiting', {
            roomCode: game.roomCode,
            statement: game.statement,
          });
        }
      }
      emitCustomGamesUpdate();
      return;
    }

    socket.to(rid).emit('peer-left');
    metrics.peerLeftEvents += 1;
    socket.leave(rid);
    clearRoom();
  });

  onSafe('call-ready', ({ roomId }) => {
    if (rejectIfSocketUnverified(socket)) return;
    callSessions.ready(socket, String(roomId || ''));
  });

  onSafe('call-signal', (message) => {
    if (rejectIfSocketUnverified(socket)) return;
    callSessions.signal(socket, message);
  });

  onSafe('call-connected', ({ roomId, sessionId }) => {
    callSessions.connected(socket, String(roomId || ''), String(sessionId || ''));
  });

  onSafe('staff-watch-debate', ({ roomId }) => {
    if (!['moderator', 'admin', 'owner'].includes(socket.data.role)) return;
    const members = [...(io.sockets.adapter.rooms.get(String(roomId)) || [])]
      .map((id) => io.sockets.sockets.get(id))
      .filter((member) => member?.data?.roomId === roomId);
    if (members.length < 1) return socket.emit('staff-spectator-error', { message: 'That debate is no longer active.' });
    socket.data.watchingRoomId = roomId;
    members.forEach((member) => member.emit('staff-spectator-request', { watcherId: socket.id, roomId }));
  });

  onSafe('staff-spectator-signal', ({ watcherId, roomId, type, payload }) => {
    if (socket.data.roomId !== roomId) return;
    const watcher = io.sockets.sockets.get(String(watcherId));
    if (!watcher || watcher.data.watchingRoomId !== roomId || !['moderator', 'admin', 'owner'].includes(watcher.data.role)) return;
    watcher.emit('staff-spectator-signal', { participantId: socket.id, roomId, type, payload });
  });

  onSafe('staff-spectator-return-signal', ({ participantId, roomId, type, payload }) => {
    if (socket.data.watchingRoomId !== roomId || !['moderator', 'admin', 'owner'].includes(socket.data.role)) return;
    const participant = io.sockets.sockets.get(String(participantId));
    if (!participant || participant.data.roomId !== roomId) return;
    participant.emit('staff-spectator-return-signal', { watcherId: socket.id, roomId, type, payload });
  });

  socket.on('staff-leave-debate', () => {
    const roomId = socket.data.watchingRoomId;
    socket.data.watchingRoomId = null;
    if (!roomId) return;
    io.sockets.sockets.forEach((participant) => {
      if (participant.data.roomId === roomId) participant.emit('staff-spectator-left', { watcherId: socket.id });
    });
  });

  onSafe('mark-debate-reported', async ({ roomId, reportId }) => {
    if (rejectIfSocketUnverified(socket)) return;
    if (!roomId || roomId !== socket.data.roomId || !reportId) return;
    const { agreeUid, disagreeUid } = getRoomAgreeDisagreeUids(roomId);
    await markMatchSessionReported(firebaseAdminReady, {
      roomId,
      reportId: String(reportId).slice(0, 128),
      reporterUid: socket.data.uid,
      agreeUid,
      disagreeUid,
    });
  });

  onSafe('debate-chat', async ({ roomId, text }) => {
    if (rejectIfSocketUnverified(socket)) return;
    if (!roomId || roomId !== socket.data.roomId) return;
    const raw = String(text ?? '');
    const trimmed = raw.trim();
    if (!trimmed.length) return;
    if (trimmed.length > debateChatMaxLen) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', { message: `Message too long (max ${debateChatMaxLen} characters).` });
      return;
    }
    const now = Date.now();
    let entry = debateChatRate.get(socket.id);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + 60_000 };
    }
    entry.count += 1;
    debateChatRate.set(socket.id, entry);
    if (entry.count > debateChatPerMinute) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', {
        code: 'rate_limited',
        message: 'Too many chat messages. Please wait a moment.',
      });
      return;
    }
    const { agreeUid, disagreeUid } = getRoomAgreeDisagreeUids(roomId);
    await persistChatMessage(firebaseAdminReady, {
      roomId,
      authorUid: socket.data.uid ?? null,
      authorSocketId: socket.id,
      text: trimmed,
      sentAtMs: now,
      agreeUid,
      disagreeUid,
    });
    io.to(roomId).emit('debate-chat', {
      text: trimmed,
      from: socket.id,
      sentAtMs: now,
    });
  });

  onSafe('disconnect', async () => {
    debateChatRate.delete(socket.id);
    const rid = socket.data.roomId;
    if (rid) callSessions.removeSocket(socket, rid);
    if (rid) analytics.recordMatchEnd(rid);
    const gameCode = socket.data.customRoomCode;
    let handledCustomDisconnect = false;
    if (socket.data.matchType === 'custom' && rid && gameCode) {
      handledCustomDisconnect = true;
      const game = customGames.get(gameCode);
      const isHost = !!game && game.createdBy === socket.id;
      if (rid) socket.to(rid).emit('peer-left');
      if (rid) metrics.peerLeftEvents += 1;
      if (game && game.activeRoomId === rid) {
        game.activeRoomId = null;
      }
      if (isHost && game) {
        closeCustomWaitingLine(gameCode, 'The host disconnected from this debate room.');
        customGames.delete(gameCode);
      } else if (game) {
        queueHostForCustomLobby(game);
        const hostSocket = io.sockets.sockets.get(game.createdBy);
        const promoted = await promoteNextCustomChallenger(game);
        if (hostSocket && !promoted) {
          hostSocket.emit('custom-lobby-waiting', {
            roomCode: game.roomCode,
            statement: game.statement,
          });
        }
      }
      emitCustomGamesUpdate();
    }
    clearMatchmaking();
    if (gameCode) emitCustomQueuePositions(gameCode);
    if (rid && !handledCustomDisconnect) {
      socket.to(rid).emit('peer-left');
      metrics.peerLeftEvents += 1;
    }
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  let redisClients = null;
  try {
    redisClients = await setupRedisIfConfigured(io, runtimeFlags);
    redisJoinClient = redisClients?.joinClient ?? null;
  } catch (e) {
    console.error('[redis] REDIS_URL is set but connection or adapter setup failed:', e?.message ?? e);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    const authMode = REQUIRE_FIREBASE_TOKEN ? 'enforced' : firebaseAdminReady ? 'optional' : 'off';
    const redisNote = runtimeFlags.redis ? ' redis=on' : '';
    console.log(
      `Server http://127.0.0.1:${PORT} (health: /health, rtc: /api/rtc-config, socketAuth: ${authMode}${redisNote})`
    );
    console.log(`[metrics] logging every ${Math.round(metricsLogEveryMs / 1000)}s`);
  });

  const onShutdown = async (signal) => {
    logMetricsOnShutdown(signal);
    await analytics.shutdown();
    await shutdownRedisClients(redisClients);
    process.exit(0);
  };
  process.on('SIGINT', () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});

