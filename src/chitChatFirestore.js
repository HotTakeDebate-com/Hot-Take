import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase.js';

/**
 * Firestore profile document id: normalized email (must match `request.auth.token.email` in rules).
 * Lowercased so it matches Firebase Auth’s normalized email and Firestore security checks.
 */
export function userProfileDocId(user) {
  if (!user?.email?.trim()) return null;
  return user.email.trim().toLowerCase();
}

/** Heartbeat for the signed-in user. Safe to call often. */
export async function syncUserPresence() {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return;
  const u = auth.currentUser;
  const profileId = userProfileDocId(u);
  if (!profileId) return;
  try {
    await setDoc(
      doc(db, 'users', profileId),
      {
        app: 'chit-chat',
        lastSeenAt: serverTimestamp(),
        uid: u.uid,
        email: u.email ?? null,
      },
      { merge: true }
    );
  } catch (e) {
    const code = e?.code ?? e?.message;
    console.error('[chit-chat] syncUserPresence failed', code, e);
  }
}

/**
 * Records one side’s view of a completed debate (for history / analytics).
 * Fails quietly so UI never breaks.
 */
export async function logDebateSessionEnd({
  topicId,
  yourSide,
  roomId,
  startedAtMs,
  reason,
  connectionState,
  peerUid,
  matchMode,
  roomCode,
  statement,
}) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return;
  if (!topicId || !yourSide || !startedAtMs) return;
  const uid = auth.currentUser.uid;
  const endedAtMs = Date.now();
  const row = {
    uid,
    topicId,
    yourSide,
    roomId: roomId ?? null,
    startedAtMs,
    endedAtMs,
    durationSec: Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000)),
    reason,
    connectionState: connectionState ?? null,
    createdAt: serverTimestamp(),
  };
  if (peerUid) row.peerUid = peerUid;
  if (matchMode === 'quick' || matchMode === 'custom') row.matchMode = matchMode;
  if (roomCode) row.roomCode = String(roomCode).slice(0, 32);
  if (statement) row.statement = String(statement).slice(0, 500);
  const profileId = userProfileDocId(auth.currentUser);
  if (!profileId) return;
  try {
    await addDoc(collection(db, 'users', profileId, 'debates'), row);
  } catch (e) {
    const code = e?.code ?? e?.message;
    console.error('[chit-chat] logDebateSessionEnd failed', code, e);
  }
}

/**
 * Loads recent debate rows: users/{email}/debates plus legacy top-level debates, merged.
 * Sorted newest first.
 */
export async function fetchRecentDebates(max = 40) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return [];
  const uid = auth.currentUser.uid;
  const profileId = userProfileDocId(auth.currentUser);
  if (!profileId) return [];

  try {
    const perPath = Math.max(1, Math.ceil(max / 2));
    const [nestedSnap, legacySnap] = await Promise.all([
      getDocs(query(collection(db, 'users', profileId, 'debates'), limit(perPath))),
      getDocs(query(collection(db, 'debates'), where('uid', '==', uid), limit(perPath))),
    ]);
    const map = new Map();
    for (const d of nestedSnap.docs) {
      map.set(`n:${d.id}`, { id: d.id, ...d.data() });
    }
    for (const d of legacySnap.docs) {
      map.set(`l:${d.id}`, { id: d.id, ...d.data() });
    }
    const rows = [...map.values()];
    rows.sort((a, b) => (b.endedAtMs ?? 0) - (a.endedAtMs ?? 0));
    return rows.slice(0, max);
  } catch (e) {
    console.warn('[chit-chat] fetchRecentDebates', e);
    return [];
  }
}

const REPORT_COOLDOWN_MS = 90_000;
const REPORT_COOLDOWN_STORAGE_KEY = 'chitchat:lastReportAt';

function getReportCooldownRemainingMs() {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  const raw = window.localStorage.getItem(REPORT_COOLDOWN_STORAGE_KEY);
  if (!raw) return 0;
  const last = parseInt(raw, 10);
  if (Number.isNaN(last)) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, REPORT_COOLDOWN_MS - elapsed);
}

function markReportSubmitted() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(REPORT_COOLDOWN_STORAGE_KEY, String(Date.now()));
}

/** User-submitted moderation report (review in Firebase Console). */
export async function submitReport({
  topicId,
  roomId,
  yourSide,
  category,
  details,
  peerUid,
  matchMode,
}) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) {
    throw new Error('Not signed in.');
  }
  const remaining = getReportCooldownRemainingMs();
  if (remaining > 0) {
    const sec = Math.max(1, Math.ceil(remaining / 1000));
    throw new Error(`Please wait ${sec} seconds before sending another report.`);
  }
  const reporterUid = auth.currentUser.uid;
  const text = (details ?? '').trim().slice(0, 2000);
  if (!text) {
    throw new Error('Please add a short description.');
  }
  const doc = {
    reporterUid,
    topicId: topicId ?? '',
    roomId: roomId ?? null,
    yourSide: yourSide === 'disagree' ? 'disagree' : 'agree',
    category,
    details: text,
    createdAt: serverTimestamp(),
  };
  if (peerUid && typeof peerUid === 'string') {
    doc.peerUid = peerUid.slice(0, 128);
  }
  if (matchMode === 'quick' || matchMode === 'custom') {
    doc.matchMode = matchMode;
  }
  await addDoc(collection(db, 'reports'), doc);
  markReportSubmitted();
}
