import admin from 'firebase-admin';

/**
 * Remove every follow edge connected to a deleted Firebase user.
 * Firestore does not cascade-delete subcollections, so both sides of each
 * relationship must be removed explicitly before the account disappears.
 */
export async function cleanupDeletedUserRelationships(uid, firestore = admin.firestore()) {
  const userUid = String(uid || '').trim();
  if (!userUid) return { followerCounts: new Map() };

  const followersRoot = firestore.collection('followers').doc(userUid);
  const followingRoot = firestore.collection('following').doc(userUid);
  const [followers, following] = await Promise.all([
    followersRoot.collection('members').get(),
    followingRoot.collection('members').get(),
  ]);

  const followedUids = new Set();
  const writer = firestore.bulkWriter();

  followers.docs.forEach((member) => {
    const followerUid = String(member.data()?.followerUid || member.id || '').trim();
    if (followerUid) writer.delete(firestore.collection('following').doc(followerUid).collection('members').doc(userUid));
    writer.delete(member.ref);
  });

  following.docs.forEach((member) => {
    const targetUid = String(member.data()?.targetUid || member.id || '').trim();
    if (targetUid) {
      followedUids.add(targetUid);
      writer.delete(firestore.collection('followers').doc(targetUid).collection('members').doc(userUid));
    }
    writer.delete(member.ref);
  });

  await writer.close();
  await Promise.all([
    firestore.recursiveDelete(followersRoot),
    firestore.recursiveDelete(followingRoot),
  ]);

  const followerCounts = new Map();
  await Promise.all([...followedUids].map(async (targetUid) => {
    const count = await firestore.collection('followers').doc(targetUid).collection('members').count().get();
    followerCounts.set(targetUid, Number(count.data()?.count || 0));
  }));
  return { followerCounts };
}
