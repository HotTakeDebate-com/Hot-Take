import admin from 'firebase-admin';

export async function releaseDisplayNameClaim(uid, firestore = admin.firestore()) {
  const ownerRef = firestore.collection('display_name_owners').doc(uid);
  await firestore.runTransaction(async (transaction) => {
    const owner = await transaction.get(ownerRef);
    const claimKey = owner.data()?.key;
    if (claimKey) {
      const claimRef = firestore.collection('display_name_claims').doc(claimKey);
      const claim = await transaction.get(claimRef);
      if (claim.data()?.uid === uid) transaction.delete(claimRef);
    }
    transaction.delete(ownerRef);
  });
}

export async function removeStaleDisplayNameClaim(claimRef, requestingUid, firestore = admin.firestore()) {
  const claim = await claimRef.get();
  const claimedUid = claim.data()?.uid;
  if (!claimedUid || claimedUid === requestingUid) return;
  try {
    await admin.auth().getUser(claimedUid);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    await firestore.runTransaction(async (transaction) => {
      const staleOwnerRef = firestore.collection('display_name_owners').doc(claimedUid);
      const [current, staleOwner] = await Promise.all([transaction.get(claimRef), transaction.get(staleOwnerRef)]);
      if (current.data()?.uid === claimedUid) transaction.delete(claimRef);
      if (staleOwner.data()?.key === claimRef.id) transaction.delete(staleOwnerRef);
    });
  }
}
