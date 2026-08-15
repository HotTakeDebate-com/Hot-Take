import admin from 'firebase-admin';

/**
 * Match + chat persistence (Firebase Admin only). All paths under:
 *   users/{email}/debates/{roomId}           — session row (merge)
 *   users/{email}/debates/{roomId}/chat_messages — one doc per line (both users)
 *
 * Session rows use agreeUid / disagreeUid (arguing for vs against the statement).
 */

export async function persistMatchSession(adminReady, payload) {
  if (!adminReady || !payload?.roomId) return;
  const {
    roomId,
    agreeUid,
    disagreeUid,
    topicId,
    matchMode,
    roomCode,
    statement,
  } = payload;

  const db = admin.firestore();
  const [agreeEmail, disagreeEmail] = await Promise.all([
    authUidToUserDocEmail(agreeUid),
    authUidToUserDocEmail(disagreeUid),
  ]);

  const row = {
    roomId,
    sessionKind: 'match',
    agreeUid: agreeUid ?? null,
    disagreeUid: disagreeUid ?? null,
    topicId: topicId ?? null,
    matchMode: matchMode === 'custom' ? 'custom' : 'quick',
    roomCode: roomCode ?? null,
    statement: typeof statement === 'string' ? statement.slice(0, 500) : null,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const tasks = [];
  if (agreeEmail) {
    tasks.push(
      db
        .collection('users')
        .doc(agreeEmail)
        .collection('debates')
        .doc(roomId)
        .set(row, { merge: true })
    );
  }
  if (disagreeEmail && disagreeEmail !== agreeEmail) {
    tasks.push(
      db
        .collection('users')
        .doc(disagreeEmail)
        .collection('debates')
        .doc(roomId)
        .set(row, { merge: true })
    );
  }

  try {
    await Promise.all(tasks);
  } catch (e) {
    console.warn('[persist] users/.../debates session', roomId, e?.message ?? e);
  }
}

async function authUidToUserDocEmail(uid) {
  if (!uid) return null;
  try {
    const rec = await admin.auth().getUser(uid);
    return rec.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

export async function markMatchSessionReported(adminReady, payload) {
  if (!adminReady || !payload?.roomId || !payload?.reportId || !payload?.reporterUid) return false;
  const { roomId, reportId, reporterUid, agreeUid, disagreeUid } = payload;
  try {
    const db = admin.firestore();
    const reportSnap = await db.collection('reports').doc(reportId).get();
    if (!reportSnap.exists) return false;
    const report = reportSnap.data();
    if (
      report?.reporterUid !== reporterUid ||
      report?.roomId !== roomId ||
      (report?.peerUid !== agreeUid && report?.peerUid !== disagreeUid)
    ) {
      return false;
    }

    const [agreeEmail, disagreeEmail] = await Promise.all([
      authUidToUserDocEmail(agreeUid),
      authUidToUserDocEmail(disagreeUid),
    ]);
    const emails = [...new Set([agreeEmail, disagreeEmail].filter(Boolean))];
    const marker = {
      reported: true,
      moderationStatus: '🔴 REPORTED',
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
      reportCount: admin.firestore.FieldValue.increment(1),
      latestReportId: reportId,
      latestReportCategory: String(report.category || 'other').slice(0, 100),
      latestReportDetails: String(report.details || '').slice(0, 2000),
      latestReportStatus: String(report.status || 'open').slice(0, 50),
      latestReporterUid: reporterUid,
      latestReportedUserUid: String(report.peerUid || '').slice(0, 128),
      latestReportCreatedAt: report.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    };
    await Promise.all(
      emails.map((email) =>
        db.collection('users').doc(email).collection('debates').doc(roomId).set(marker, { merge: true })
      )
    );
    return true;
  } catch (e) {
    console.warn('[persist] mark reported debate', roomId, e?.message ?? e);
    return false;
  }
}

export async function persistChatMessage(adminReady, payload) {
  if (!adminReady || !payload?.roomId || !payload.text) return;
  const { roomId, authorUid, authorSocketId, text, sentAtMs, agreeUid, disagreeUid } = payload;

  const agreeEmail = await authUidToUserDocEmail(agreeUid);
  const disagreeEmail = await authUidToUserDocEmail(disagreeUid);
  if (!agreeEmail || !disagreeEmail) {
    console.warn('[persist] chat_messages missing participant emails', roomId, {
      agreeUid,
      disagreeUid,
      agreeEmail,
      disagreeEmail,
    });
    return;
  }

  const msg = {
    authorUid: authorUid ?? null,
    authorSocketId: authorSocketId ?? null,
    text: String(text).slice(0, 4000),
    sentAtMs: typeof sentAtMs === 'number' ? sentAtMs : Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const db = admin.firestore();
  const paths = agreeEmail === disagreeEmail ? [agreeEmail] : [agreeEmail, disagreeEmail];
  try {
    await Promise.all(
      paths.map((email) =>
        db
          .collection('users')
          .doc(email)
          .collection('debates')
          .doc(roomId)
          .collection('chat_messages')
          .add(msg)
      )
    );
  } catch (e) {
    console.warn('[persist] chat_messages', roomId, e?.message ?? e);
  }
}
