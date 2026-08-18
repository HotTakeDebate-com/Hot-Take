import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { networkUpdateDisplayName } from './networkApi.js';
import { auth, db, isFirebaseConfigured } from './firebase.js';
import { sanitizeProfileInterests } from './profileInterests.js';

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
        app: 'hot-take',
        lastSeenAt: serverTimestamp(),
        uid: u.uid,
        email: u.email ?? null,
        ...(u.displayName?.trim() ? { displayName: u.displayName.trim().slice(0, 100) } : {}),
      },
      { merge: true }
    );
    await setDoc(
      doc(db, 'publicProfiles', profileId),
      {
        uid: u.uid,
        ...(u.displayName?.trim() ? { displayName: u.displayName.trim().slice(0, 100) } : {}),
      },
      { merge: true }
    );
  } catch (e) {
    const code = e?.code ?? e?.message;
    console.error('[hot-take] syncUserPresence failed', code, e);
  }
}

function debateCreatedAtDocumentId(timestampMs) {
  // Firestore document IDs cannot use "/" but support the rest of ISO-8601.
  // Replace colons so the Firebase Console shows a clean, sortable timestamp.
  return new Date(timestampMs).toISOString().replace(/:/g, '-');
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
    createdAtIso: new Date(endedAtMs).toISOString(),
  };
  if (peerUid) row.peerUid = peerUid;
  if (matchMode === 'quick' || matchMode === 'custom') row.matchMode = matchMode;
  if (roomCode) row.roomCode = String(roomCode).slice(0, 32);
  if (statement) row.statement = String(statement).slice(0, 500);
  const profileId = userProfileDocId(auth.currentUser);
  if (!profileId) return;
  try {
    const debateId = debateCreatedAtDocumentId(endedAtMs);
    await setDoc(doc(db, 'users', profileId, 'debates', debateId), row);
  } catch (e) {
    const code = e?.code ?? e?.message;
    console.error('[hot-take] logDebateSessionEnd failed', code, e);
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
    console.warn('[hot-take] fetchRecentDebates', e);
    return [];
  }
}

/**
 * Persist a user's 1–5 star rating of the opponent from a completed debate.
 * The deterministic document id prevents a second rating for the same opponent/room.
 */
export async function submitDebateRating({ ratedUid, rating, roomId }) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return false;
  const raterUid = auth.currentUser.uid;
  const targetUid = String(ratedUid ?? '').trim();
  const score = Number(rating);
  const room = String(roomId ?? '').trim();
  if (!targetUid || targetUid === raterUid || !Number.isInteger(score) || score < 1 || score > 5 || !room) {
    throw new Error('Invalid debate rating.');
  }
  const ratingId = `${targetUid}_${raterUid}_${room}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 500);
  await setDoc(doc(db, 'userRatings', ratingId), {
    ratedUid: targetUid,
    raterUid,
    rating: score,
    roomId: room.slice(0, 128),
    createdAt: serverTimestamp(),
  });
  return true;
}

/** Fetch the decimal average and count for a user. */
export async function fetchRatingSummary(uid) {
  if (!isFirebaseConfigured || !db) return { average: null, count: 0 };
  const targetUid = String(uid ?? '').trim();
  if (!targetUid) return { average: null, count: 0 };
  try {
    const snap = await getDocs(
      query(collection(db, 'userRatings'), where('ratedUid', '==', targetUid), limit(500))
    );
    const scores = snap.docs
      .map((d) => Number(d.data()?.rating))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);
    if (!scores.length) return { average: null, count: 0 };
    const average = scores.reduce((sum, n) => sum + n, 0) / scores.length;
    return { average: Number(average.toFixed(2)), count: scores.length };
  } catch (e) {
    console.warn('[hot-take] fetchRatingSummary', e);
    return { average: null, count: 0 };
  }
}

const REPORT_COOLDOWN_MS = 90_000;
const REPORT_COOLDOWN_STORAGE_KEY = 'hottake:lastReportAt';
/** Legacy key from pre-rebrand builds; still honored for cooldown until it ages out. */
const REPORT_COOLDOWN_LEGACY_KEY = 'chitchat:lastReportAt';

function cooldownRemainingFromRaw(raw) {
  if (!raw) return 0;
  const last = parseInt(raw, 10);
  if (Number.isNaN(last)) return 0;
  const elapsed = Date.now() - last;
  return Math.max(0, REPORT_COOLDOWN_MS - elapsed);
}

function getReportCooldownRemainingMs() {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  const a = cooldownRemainingFromRaw(window.localStorage.getItem(REPORT_COOLDOWN_STORAGE_KEY));
  const b = cooldownRemainingFromRaw(window.localStorage.getItem(REPORT_COOLDOWN_LEGACY_KEY));
  return Math.max(a, b);
}

function markReportSubmitted() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const now = String(Date.now());
  window.localStorage.setItem(REPORT_COOLDOWN_STORAGE_KEY, now);
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
    status: 'open',
    staffResponse: null,
    respondedAt: null,
    createdAt: serverTimestamp(),
  };
  if (peerUid && typeof peerUid === 'string') {
    doc.peerUid = peerUid.slice(0, 128);
  }
  if (matchMode === 'quick' || matchMode === 'custom') {
    doc.matchMode = matchMode;
  }
  const reportRef = await addDoc(collection(db, 'reports'), doc);
  markReportSubmitted();
  return reportRef.id;
}

// --- Social: public profiles, follows, feed posts ---

const MAX_POST_CHARS = 2000;
const MAX_BIO_CHARS = 500;

/** @returns {Promise<{ email: string, displayName: string, bio: string, uid?: string, updatedAt?: import('firebase/firestore').Timestamp } | null>} */
export async function fetchPublicProfile(profileEmail) {
  if (!isFirebaseConfigured || !db) return null;
  const key = String(profileEmail ?? '').trim().toLowerCase();
  if (!key) return null;
  const snap = await getDoc(doc(db, 'publicProfiles', key));
  if (!snap.exists()) {
    return { email: key, displayName: '', bio: '', avatarUrl: '', interests: [], uid: null, updatedAt: null };
  }
  const d = snap.data();
  return {
    email: key,
    displayName: typeof d.displayName === 'string' ? d.displayName : '',
    bio: typeof d.bio === 'string' ? d.bio : '',
    avatarUrl: typeof d.avatarUrl === 'string' ? d.avatarUrl : '',
    interests: sanitizeProfileInterests(d.interests),
    uid: typeof d.uid === 'string' ? d.uid : null,
    updatedAt: d.updatedAt ?? null,
  };
}

export async function savePublicProfile({ displayName, bio, avatarUrl = '', interests = [] }) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser?.email) {
    throw new Error('Not signed in.');
  }
  const key = userProfileDocId(auth.currentUser);
  if (!key) throw new Error('No email on account.');
  const dn = String(displayName ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 40);
  const b = String(bio ?? '').trim().slice(0, MAX_BIO_CHARS);
  const avatar = String(avatarUrl ?? '').trim().slice(0, 250000);
  const selectedInterests = sanitizeProfileInterests(interests);
  await networkUpdateDisplayName(dn);
  await setDoc(
    doc(db, 'publicProfiles', key),
    {
      uid: auth.currentUser.uid,
      displayName: dn,
      bio: b,
      avatarUrl: avatar,
      interests: selectedInterests,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  try {
    await updateProfile(auth.currentUser, { displayName: dn || auth.currentUser.displayName || '' });
  } catch {
    /* optional */
  }
  await syncUserPresence();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hot-take-profile-updated', { detail: { avatarUrl: avatar } }));
  }
}

export async function fetchFollowingEmails() {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return [];
  const key = userProfileDocId(auth.currentUser);
  if (!key) return [];
  const snap = await getDocs(collection(db, 'users', key, 'following'));
  return snap.docs.map((d) => d.id);
}

export async function followUser(targetEmail) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) throw new Error('Not signed in.');
  const myKey = userProfileDocId(auth.currentUser);
  const targetKey = String(targetEmail ?? '').trim().toLowerCase();
  if (!myKey || !targetKey) throw new Error('Invalid profile.');
  if (targetKey === myKey) throw new Error('You cannot follow yourself.');
  await setDoc(doc(db, 'users', myKey, 'following', targetKey), {
    createdAt: serverTimestamp(),
  });
}

export async function unfollowUser(targetEmail) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) throw new Error('Not signed in.');
  const myKey = userProfileDocId(auth.currentUser);
  const targetKey = String(targetEmail ?? '').trim().toLowerCase();
  if (!myKey || !targetKey) return;
  await deleteDoc(doc(db, 'users', myKey, 'following', targetKey));
}

export async function isFollowingUser(targetEmail) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return false;
  const myKey = userProfileDocId(auth.currentUser);
  const targetKey = String(targetEmail ?? '').trim().toLowerCase();
  if (!myKey || !targetKey || targetKey === myKey) return false;
  const snap = await getDoc(doc(db, 'users', myKey, 'following', targetKey));
  return snap.exists();
}

export async function createPost(text) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser?.email) throw new Error('Not signed in.');
  const u = auth.currentUser;
  const key = userProfileDocId(u);
  const raw = String(text ?? '').trim();
  if (raw.length < 1 || raw.length > MAX_POST_CHARS) {
    throw new Error(`Post must be 1–${MAX_POST_CHARS} characters.`);
  }
  await addDoc(collection(db, 'posts'), {
    authorUid: u.uid,
    authorEmail: key,
    text: raw,
    createdAt: serverTimestamp(),
  });
}

export async function deletePost(postId) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) throw new Error('Not signed in.');
  const ref = doc(db, 'posts', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Post not found.');
  if (snap.data()?.authorUid !== auth.currentUser.uid) throw new Error('Not your post.');
  await deleteDoc(ref);
}

/**
 * Loads recent posts (newest first). Following mode filters to `followingEmails` client-side (MVP).
 */
export async function fetchPostsForFeed({ feedMode, followingEmails = [], maxPosts = 80 }) {
  if (!isFirebaseConfigured || !db) return [];
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(maxPosts));
  const snap = await getDocs(q);
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (feedMode === 'following' && followingEmails.length > 0) {
    const set = new Set(followingEmails.map((e) => String(e).toLowerCase()));
    rows = rows.filter((r) => r.authorEmail && set.has(String(r.authorEmail).toLowerCase()));
  }
  return rows;
}

/**
 * Prefix match on publicProfiles.displayName (case-sensitive). Requires displayName field on docs.
 */
export async function searchPublicProfilesByDisplayPrefix(prefix, maxResults = 25) {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return [];
  const p = String(prefix ?? '').trim();
  if (p.length < 2) return [];
  const cap = Math.min(50, Math.max(1, maxResults));
  const qy = query(
    collection(db, 'publicProfiles'),
    where('displayName', '>=', p),
    where('displayName', '<=', `${p}\uf8ff`),
    limit(cap)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      email: d.id,
      displayName: typeof x.displayName === 'string' ? x.displayName : '',
      bio: typeof x.bio === 'string' ? x.bio : '',
      uid: typeof x.uid === 'string' ? x.uid : null,
      updatedAt: x.updatedAt ?? null,
    };
  });
}

// Keep the existing review UI untouched while making its Submit button persist the selected score.
// The debate page stores the current opponent context before it unmounts.
if (typeof document !== 'undefined' && !window.__hotTakeRatingListenerInstalled) {
  window.__hotTakeRatingListenerInstalled = true;
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target || target.textContent?.trim() !== 'Submit rating') return;
    const contextRaw = window.localStorage?.getItem('hottake:ratingContext');
    if (!contextRaw) return;
    let context;
    try {
      context = JSON.parse(contextRaw);
    } catch {
      return;
    }
    const stars = Array.from(document.querySelectorAll('.debate-rating-star--active')).length;
    if (!context?.peerUid || !context?.roomId || stars < 1 || stars > 5) return;
    void submitDebateRating({ ratedUid: context.peerUid, rating: stars, roomId: context.roomId })
      .catch((e) => console.error('[hot-take] submitDebateRating failed', e));
    window.localStorage.removeItem('hottake:ratingContext');
  });
}

