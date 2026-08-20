import admin from 'firebase-admin';

const blockRef = (ownerUid, targetUid) => admin.firestore().collection('user_blocks').doc(ownerUid).collection('blocked').doc(targetUid);

export async function blockRelationship(uid, otherUid) {
  if (!uid || !otherUid || uid === otherUid || !admin.apps?.length) return { blocked: false, youBlocked: false, blockedYou: false };
  const [outgoing, incoming] = await Promise.all([blockRef(uid, otherUid).get(), blockRef(otherUid, uid).get()]);
  return { blocked: outgoing.exists || incoming.exists, youBlocked: outgoing.exists, blockedYou: incoming.exists };
}

export async function usersHaveBlock(uid, otherUid) {
  try { return (await blockRelationship(uid, otherUid)).blocked; }
  catch (error) {
    console.warn('[blocks] relationship check failed; preventing match', error?.message || error);
    return true;
  }
}

export { blockRef };
