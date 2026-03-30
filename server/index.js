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
import admin from 'firebase-admin';
import { persistChatMessage, persistMatchSession } from './persistence.js';
import { attachModerationRoutes } from './moderationApi.js';

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
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

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
    if (decoded.email_verified !== true) {
      return next(
        new Error('Verify your email before joining debates. Check your inbox for the link.')
      );
    }
    socket.data.uid = decoded.uid;
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
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/rtc-config', (_req, res) => {
  res.json(getRtcConfigForClient());
});

app.use(express.json({ limit: '64kb' }));
attachModerationRoutes(app, { isAdminReady: () => firebaseAdminReady });

if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    // Let Socket.IO HTTP transport and other /api routes bypass SPA fallback.
    if (req.path.startsWith('/socket.io')) return next();
    if (req.path.startsWith('/api/')) return next();
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
    .filter((g) => g.joinMode === 'open' && !g.activeRoomId)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map((g) => ({
      roomCode: g.roomCode,
      statement: g.statement,
      joinMode: g.joinMode,
      createdAtMs: g.createdAtMs,
    }));
}

function cleanupStaleCustomLobbies() {
  const now = Date.now();
  let changed = false;
  const removedOrphaned = [];
  const removedExpired = [];
  const recoveredActive = [];

  for (const [roomCode, game] of customGames.entries()) {
    if (!isSocketConnected(game.createdBy)) {
      customGames.delete(roomCode);
      customQueues.delete(roomCode);
      changed = true;
      removedOrphaned.push(roomCode);
      continue;
    }

    if (!game.activeRoomId && now - game.createdAtMs > customLobbyTtlMs) {
      customGames.delete(roomCode);
      customQueues.delete(roomCode);
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

process.on('SIGINT', () => logMetricsOnShutdown('SIGINT'));
process.on('SIGTERM', () => logMetricsOnShutdown('SIGTERM'));

io.on('connection', (socket) => {
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

  const clearRoom = () => {
    socket.data.roomId = null;
  };

  const clearMatchmaking = () => {
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
        customGames.delete(socket.data.customRoomCode);
      }
      emitCustomGamesUpdate();
    }
    socket.data.matchType = null;
    socket.data.topicId = null;
    socket.data.side = null;
    socket.data.customRoomCode = null;
    clearRoom();
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

  socket.on('join-queue', async ({ topicId, side }) => {
    metrics.quickJoinAttempts += 1;
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
    if (!joinQueueLimiter(ip)) {
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
    socket.data.topicId = topicId;
    socket.data.side = side;

    const q = getQueue(topicId);
    const opposite = side === 'agree' ? 'disagree' : 'agree';
    const oppositeList = q[opposite];

    while (oppositeList.length > 0) {
      const peerId = oppositeList.shift();
      const peerSocket = io.sockets.sockets.get(peerId);
      if (!peerSocket) {
        continue;
      }
      const roomId = `${topicId}-${socket.id}-${peerId}`;

      socket.data.roomId = roomId;
      socket.join(roomId);

      peerSocket.data.roomId = roomId;
      peerSocket.join(roomId);

      const agreeUidQuick =
        socket.data.side === 'agree' ? socket.data.uid ?? null : peerSocket.data.uid ?? null;
      const disagreeUidQuick =
        socket.data.side === 'disagree' ? socket.data.uid ?? null : peerSocket.data.uid ?? null;
      await persistMatchSession(firebaseAdminReady, {
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
      });

      socket.emit('matched', {
        roomId,
        isOfferer: true,
        topicId,
        yourSide: side,
        peerUid: peerSocket.data.uid ?? null,
      });
      metrics.matches += 1;
      return;
    }

    const myList = side === 'agree' ? q.agree : q.disagree;
    if (!myList.includes(socket.id)) myList.push(socket.id);
    socket.emit('queued', { topicId, side });
  });

  socket.on('create-custom-game', ({ statement, joinMode }) => {
    metrics.customCreateAttempts += 1;
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
    if (!joinQueueLimiter(ip)) {
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
    });

    socket.data.matchType = 'custom';
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
  });

  socket.on('join-custom-room', async ({ side, roomCode }) => {
    metrics.customJoinAttempts += 1;
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
    if (!joinQueueLimiter(ip)) {
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
    if (game.activeRoomId) {
      metrics.queueErrors += 1;
      socket.emit('queue-error', { message: 'This lobby is currently in an active debate.' });
      return;
    }

    clearMatchmaking();

    socket.data.matchType = 'custom';
    socket.data.topicId = null;
    socket.data.side = side;
    socket.data.customRoomCode = normalizedRoomCode;

    const q = getCustomQueue(normalizedRoomCode);
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
      await persistMatchSession(firebaseAdminReady, {
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
      });
      metrics.matches += 1;
      game.activeRoomId = roomId;
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
  });

  socket.on('leave-queue', () => {
    clearMatchmaking();
  });

  socket.on('kick-peer', ({ roomId }) => {
    if (!roomId || roomId !== socket.data.roomId) return;
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
    socket.data.roomId = null;
    game.activeRoomId = null;
    queueHostForCustomLobby(game);
    metrics.peerKicks += 1;

    socket.emit('custom-lobby-waiting', {
      roomCode: game.roomCode,
      statement: game.statement,
    });
    emitCustomGamesUpdate();
  });

  socket.on('leave-debate', () => {
    metrics.leaveDebate += 1;
    const rid = socket.data.roomId;
    if (!rid) {
      // Custom host waiting alone (no WebRTC room yet) — still must remove lobby + queue state
      if (socket.data.matchType === 'custom' && socket.data.customRoomCode) {
        const game = customGames.get(socket.data.customRoomCode);
        if (game && game.createdBy === socket.id) {
          customGames.delete(socket.data.customRoomCode);
        }
        clearMatchmaking();
        emitCustomGamesUpdate();
      }
      return;
    }

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
        customGames.delete(socket.data.customRoomCode);
        clearMatchmaking();
      } else if (game) {
        queueHostForCustomLobby(game);
        const hostSocket = io.sockets.sockets.get(game.createdBy);
        if (hostSocket) {
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

  socket.on('signal', ({ roomId, type, payload }) => {
    if (!roomId || roomId !== socket.data.roomId) return;
    socket.to(roomId).emit('signal', { type, payload, from: socket.id });
  });

  socket.on('debate-chat', async ({ roomId, text }) => {
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

  socket.on('disconnect', () => {
    debateChatRate.delete(socket.id);
    const rid = socket.data.roomId;
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
        customGames.delete(gameCode);
      } else if (game) {
        queueHostForCustomLobby(game);
        const hostSocket = io.sockets.sockets.get(game.createdBy);
        if (hostSocket) {
          hostSocket.emit('custom-lobby-waiting', {
            roomCode: game.roomCode,
            statement: game.statement,
          });
        }
      }
      emitCustomGamesUpdate();
    }
    clearMatchmaking();
    if (rid && !handledCustomDisconnect) {
      socket.to(rid).emit('peer-left');
      metrics.peerLeftEvents += 1;
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  const authMode = REQUIRE_FIREBASE_TOKEN ? 'enforced' : firebaseAdminReady ? 'optional' : 'off';
  console.log(
    `Server http://127.0.0.1:${PORT} (health: /health, rtc: /api/rtc-config, socketAuth: ${authMode})`
  );
  console.log(`[metrics] logging every ${Math.round(metricsLogEveryMs / 1000)}s`);
});
