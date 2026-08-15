import admin from 'firebase-admin';

/**
 * Server-owned operational analytics. No IP addresses, emails, chat text, or
 * display names are stored. Firebase Admin writes bypass client rules, keeping
 * these counters tamper-resistant.
 */
export function createAnalyticsTracker({ io, queues, customQueues, isAdminReady }) {
  let snapshotTimer = null;
  let periodicTimer = null;

  const firestore = () => admin.firestore();

  const safeWrite = async (label, operation) => {
    if (!isAdminReady()) return;
    try {
      await operation();
    } catch (error) {
      console.warn(`[analytics] ${label}`, error?.message ?? error);
    }
  };

  const buildLiveSnapshot = () => {
    const onlineUids = new Set();
    const activeRooms = new Set();
    let connectedSockets = 0;
    let searchingUsers = 0;

    for (const socket of io.sockets.sockets.values()) {
      connectedSockets += 1;
      if (socket.data.uid) onlineUids.add(socket.data.uid);
      if (socket.data.roomId) {
        activeRooms.add(socket.data.roomId);
      } else if (socket.data.matchType === 'quick' || socket.data.matchType === 'custom') {
        searchingUsers += 1;
      }
    }

    let quickQueueEntries = 0;
    for (const queue of queues.values()) {
      quickQueueEntries += queue.agree.length + queue.disagree.length;
    }

    let customQueueEntries = 0;
    for (const queue of customQueues.values()) {
      customQueueEntries += queue.agree.length + queue.disagree.length;
    }

    return {
      onlineUsers: onlineUids.size,
      connectedSockets,
      searchingUsers,
      activeDebates: activeRooms.size,
      quickQueueEntries,
      customQueueEntries,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  };

  const flushSnapshot = () => {
    snapshotTimer = null;
    return safeWrite('current snapshot', () =>
      firestore().collection('analytics').doc('current').set(buildLiveSnapshot(), { merge: true })
    );
  };

  const scheduleSnapshot = () => {
    if (!isAdminReady() || snapshotTimer) return;
    snapshotTimer = setTimeout(() => {
      void flushSnapshot();
    }, 750);
    snapshotTimer.unref?.();
  };

  const recordQueueJoin = (topicId, side, matchMode = 'quick') => {
    if (!isAdminReady()) return;
    const increments = {
      queueJoins: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (side === 'agree') increments.agreeSelections = admin.firestore.FieldValue.increment(1);
    if (side === 'disagree') increments.disagreeSelections = admin.firestore.FieldValue.increment(1);

    void safeWrite('queue join', async () => {
      const batch = firestore().batch();
      batch.set(
        firestore().collection('analytics').doc('overview'),
        {
          totalQueueJoins: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const topicKey = matchMode === 'custom' ? 'custom' : String(topicId || 'unknown');
      batch.set(
        firestore().collection('topicAnalytics').doc(topicKey),
        { ...increments, topicId: topicId ?? null, matchMode },
        { merge: true }
      );
      await batch.commit();
    });
    scheduleSnapshot();
  };

  const recordMatch = (topicId, matchMode = 'quick') => {
    if (!isAdminReady()) return;
    void safeWrite('match', async () => {
      const batch = firestore().batch();
      batch.set(
        firestore().collection('analytics').doc('overview'),
        {
          totalMatches: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      const topicKey = matchMode === 'custom' ? 'custom' : String(topicId || 'unknown');
      batch.set(
        firestore().collection('topicAnalytics').doc(topicKey),
        {
          topicId: topicId ?? null,
          matchMode,
          matches: admin.firestore.FieldValue.increment(1),
          lastMatchedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
    });
    scheduleSnapshot();
  };

  io.on('connection', (socket) => {
    scheduleSnapshot();
    socket.on('disconnect', scheduleSnapshot);
  });

  periodicTimer = setInterval(scheduleSnapshot, 30_000);
  periodicTimer.unref?.();
  scheduleSnapshot();

  return {
    recordQueueJoin,
    recordMatch,
    scheduleSnapshot,
    async shutdown() {
      if (snapshotTimer) clearTimeout(snapshotTimer);
      if (periodicTimer) clearInterval(periodicTimer);
      await flushSnapshot();
    },
  };
}
