import 'dotenv/config';
import admin from 'firebase-admin';

const MIGRATION_COLLECTION = 'systemMigrations';
const MIGRATION_DOC = 'resetDebateRatings20260814b';
const RATINGS_COLLECTION = 'userRatings';

function initFirebaseAdmin() {
  if (admin.apps?.length) return;

  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (raw) {
    const decoded = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(decoded)) });
    return;
  }

  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function resetDebateRatingsOnce() {
  initFirebaseAdmin();
  const db = admin.firestore();
  const markerRef = db.collection(MIGRATION_COLLECTION).doc(MIGRATION_DOC);
  const marker = await markerRef.get();

  if (marker.exists) {
    console.log('[rating-reset] Migration already completed; nothing to do.');
    return;
  }

  let deleted = 0;
  while (true) {
    const snapshot = await db.collection(RATINGS_COLLECTION).limit(400).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const document of snapshot.docs) {
      batch.delete(document.ref);
      deleted += 1;
    }
    await batch.commit();

    if (snapshot.size < 400) break;
  }

  await markerRef.set({
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    deleted,
    purpose: 'Second one-time reset to guarantee a clean debate-rating relaunch.',
  });

  console.log(`[rating-reset] Completed one-time reset; deleted ${deleted} debate ratings.`);
}

try {
  await resetDebateRatingsOnce();
} catch (error) {
  console.error('[rating-reset] Failed:', error?.message ?? error);
  process.exitCode = 1;
} finally {
  try {
    await admin.app().delete();
  } catch {
    // Ignore cleanup errors.
  }
}
