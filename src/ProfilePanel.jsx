import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  fetchPublicProfile,
  saveProfileInterests,
  savePublicProfile,
  userProfileDocId,
} from './chitChatFirestore.js';
import { auth } from './firebase.js';
import { sendHotTakePasswordResetEmail } from './firebaseEmailVerification.js';
import ProfileEmailVerification from './ProfileEmailVerification.jsx';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import { prepareProfileImage } from './profileImage.js';
import GenericAvatar from './GenericAvatar.jsx';
import { MAX_PROFILE_INTERESTS_PER_CATEGORY, PROFILE_INTEREST_GROUPS, sanitizeProfileInterests } from './profileInterests.js';
import IdentityBadges from './IdentityBadges.jsx';
import ProfileReportDialog from './ProfileReportDialog.jsx';
import { networkBlock, networkBlockedAccounts, networkBlockStatus, networkDecideDirectMessage, networkDirectMessages, networkFollow, networkFollowers, networkFollowing, networkFollowStatus, networkIdentity, networkMe, networkSendDirectMessage, networkUnblock, networkUnfollow, networkUpdatePresencePrivacy } from './networkApi.js';
import './DebateNetwork.css';
import './AccountPage.css';

async function fetchLiveRatingSummary(uid) {
  const targetUid = String(uid ?? '').trim();
  if (!targetUid || !auth?.currentUser) return { average: null, count: 0 };
  const token = await auth.currentUser.getIdToken(true);
  const response = await fetch(`/api/debate-ratings/${encodeURIComponent(targetUid)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error || 'Could not load the debate rating.');
  return {
    average: result?.average == null ? null : Number(result.average),
    count: Number(result?.count ?? 0),
  };
}

function AccountIcon({ type }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 22c0-6 3-9 8-9s8 3 8 9" /></>,
    shield: <><path d="M12 2 21 6v6c0 6-4 10-9 12-5-2-9-6-9-12V6l9-4Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    lock: <><rect x="4" y="10" width="16" height="12" rx="2" /><path d="M7 10V7a5 5 0 0 1 10 0v3" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 15h8l1-15M10 11v7M14 11v7" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

/**
 * targetEmail=null renders the signed-in user's Account settings.
 * A target email renders the public profile view used by Search and Feed.
 */
export default function ProfilePanel({
  targetEmail,
  hostedRoom = null,
  canJoinHostedRoom = true,
  onJoinHostedRoom,
  onBack,
  onHome,
  onAbout,
  onQuickMatch,
  onFaq,
  onSupport,
  onSignOut,
  onPickLegal,
  onDeleted,
  onOpenProfile,
  embedded = false,
}) {
  const own = targetEmail == null;
  const targetUid = !own && String(targetEmail ?? '').startsWith('uid:')
    ? String(targetEmail).slice(4)
    : '';
  const resolvedEmail =
    own && auth.currentUser?.email
      ? userProfileDocId(auth.currentUser)
      : targetUid ? '' : String(targetEmail ?? '').toLowerCase();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [interests, setInterests] = useState([]);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [rating, setRating] = useState({ average: null, count: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followerMembers, setFollowerMembers] = useState([]);
  const [followedMembers, setFollowedMembers] = useState([]);
  const [networkIdentityState, setNetworkIdentityState] = useState({ uid: '', role: 'user', premium: false, verifiedDebater: false });
  const [activity, setActivity] = useState({ key: 'offline', label: 'Offline' });
  const [directMessages, setDirectMessages] = useState([]);
  const [messageRequestPending, setMessageRequestPending] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [profileReportOpen, setProfileReportOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [appearOffline, setAppearOffline] = useState(false);
  const [followingPanelOpen, setFollowingPanelOpen] = useState(false);
  const [followersPanelOpen, setFollowersPanelOpen] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [blockState, setBlockState] = useState({ blocked: false, youBlocked: false, blockedYou: false });
  const [blockedMembers, setBlockedMembers] = useState([]);
  const [blockBusy, setBlockBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const liveTargetUid = targetUid || (!own ? networkIdentityState.uid : '');

  const providerLabel = useMemo(() => {
    const providers = auth.currentUser?.providerData?.map((item) => item.providerId) ?? [];
    if (providers.includes('google.com')) return 'Google';
    if (providers.includes('apple.com')) return 'Apple';
    return 'Email and password';
  }, []);

  const load = useCallback(async () => {
    if (!resolvedEmail && !targetUid) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    setFollowerMembers([]);
    setFollowedMembers([]);
    setFollowersPanelOpen(false);
    setFollowingPanelOpen(false);
    setBlockState({ blocked: false, youBlocked: false, blockedYou: false });
    try {
      if (!own && targetUid) {
        const [{ identity, activity: currentActivity, followerCount: currentFollowerCount }, follow, conversation, followersResult, followingResult, blocking] = await Promise.all([
          networkIdentity(targetUid),
          networkFollowStatus(targetUid),
          networkDirectMessages(targetUid),
          networkFollowers(targetUid),
          networkFollowing(targetUid),
          networkBlockStatus(targetUid),
        ]);
        setDisplayName(identity?.displayName?.trim() || 'Hot Take member');
        setBio(identity?.bio ?? '');
        setAvatarUrl(identity?.avatarUrl ?? '');
        setInterests(sanitizeProfileInterests(identity?.interests));
        setNetworkIdentityState(identity || { uid: targetUid, role: 'user', premium: false, verifiedDebater: false });
        setFollowing(follow.following === true);
        setFollowerCount(Number(currentFollowerCount || 0));
        setActivity(currentActivity || { key: 'offline', label: 'Offline' });
        setDirectMessages(conversation.messages || []);
        setMessageRequestPending(conversation.pendingForRecipient === true || conversation.declinedForRecipient === true);
        setBlockState(blocking);
        setFollowerMembers(followersResult.members || []);
        setFollowedMembers(followingResult.members || []);
        setRating(await fetchLiveRatingSummary(targetUid));
        return;
      }
      const prof = await fetchPublicProfile(resolvedEmail);
      const fromAuth = own ? auth.currentUser?.displayName?.trim() ?? '' : '';
      setDisplayName(prof?.displayName?.trim() || fromAuth);
      setBio(prof?.bio ?? '');
      setAvatarUrl(prof?.avatarUrl ?? '');
      setInterests(sanitizeProfileInterests(prof?.interests));
      const ratingUid = own ? auth.currentUser?.uid : prof?.uid;
      setRating(await fetchLiveRatingSummary(ratingUid));
      if (!own && prof?.uid) {
        const [{ identity, followerCount: currentFollowerCount }, follow, followersResult, followingResult, blocking] = await Promise.all([networkIdentity(prof.uid), networkFollowStatus(prof.uid), networkFollowers(prof.uid), networkFollowing(prof.uid), networkBlockStatus(prof.uid)]);
        setNetworkIdentityState(identity || { uid: prof.uid, role: 'user', premium: false, verifiedDebater: false });
        setFollowing(follow.following === true);
        setFollowerCount(Number(currentFollowerCount || 0));
        setFollowerMembers(followersResult.members || []);
        setFollowedMembers(followingResult.members || []);
        setBlockState(blocking);
      } else if (own && auth.currentUser?.uid) {
        const [meResult, followersResult, followingResult, blocksResult] = await Promise.all([
          networkMe(),
          networkFollowers(),
          networkFollowing(),
          networkBlockedAccounts(),
        ]);
        setNetworkIdentityState(meResult.identity || { uid: auth.currentUser.uid, role: 'user', premium: false, verifiedDebater: false });
        setFollowerCount(Number(meResult.followerCount || 0));
        setAppearOffline(meResult.privacy?.appearOffline === true);
        setFollowerMembers(followersResult.members || []);
        setFollowedMembers(followingResult.members || []);
        setBlockedMembers(blocksResult.members || []);
      }
    } catch (loadError) {
      setError(loadError?.message ?? 'Could not load account.');
    } finally {
      setLoading(false);
    }
  }, [resolvedEmail, targetUid, own]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setMessageOpen(false);
    setMessageDraft('');
  }, [targetUid, resolvedEmail]);

  useEffect(() => {
    if (own || !liveTargetUid) return undefined;
    const refreshLiveProfile = async () => {
      try {
        const [{ activity: currentActivity, followerCount: currentFollowerCount }, conversation, blocking] = await Promise.all([
          networkIdentity(liveTargetUid),
          networkDirectMessages(liveTargetUid),
          networkBlockStatus(liveTargetUid),
        ]);
        setActivity(currentActivity || { key: 'offline', label: 'Offline' });
        setFollowerCount(Number(currentFollowerCount || 0));
        setDirectMessages(conversation.messages || []);
        setMessageRequestPending(conversation.pendingForRecipient === true || conversation.declinedForRecipient === true);
        setBlockState(blocking);
        if (blocking.blocked) setMessageOpen(false);
      } catch {
        // Keep the last successful profile state during a brief network interruption.
      }
    };
    const timer = window.setInterval(refreshLiveProfile, 8000);
    return () => window.clearInterval(timer);
  }, [own, liveTargetUid]);

  useEffect(() => {
    if (!own || !auth.currentUser?.uid) return undefined;
    const socket = typeof window !== 'undefined' ? window.__hotTakeNetworkSocket : null;
    if (!socket) return undefined;
    const updateOwnFollowers = async (payload = {}) => {
      if (payload.uid !== auth.currentUser?.uid) return;
      setFollowerCount(Number(payload.followerCount || 0));
      try {
        const result = await networkFollowers();
        setFollowerMembers(result.members || []);
      } catch {
        // Keep the current list visible if a real-time refresh briefly fails.
      }
    };
    socket.on('follower-count-updated', updateOwnFollowers);
    return () => socket.off('follower-count-updated', updateOwnFollowers);
  }, [own]);

  useEffect(() => {
    if (own || !liveTargetUid) return undefined;
    const socket = typeof window !== 'undefined' ? window.__hotTakeNetworkSocket : null;
    if (!socket) return undefined;
    const updateFollowerCount = (payload = {}) => {
      if (payload.uid === liveTargetUid) setFollowerCount(Number(payload.followerCount || 0));
    };
    socket.on('follower-count-updated', updateFollowerCount);
    return () => socket.off('follower-count-updated', updateFollowerCount);
  }, [own, liveTargetUid]);

  useEffect(() => {
    const refresh = () => {
      if (own) void load();
    };
    window.addEventListener('hot-take:rating-updated', refresh);
    return () => window.removeEventListener('hot-take:rating-updated', refresh);
  }, [load, own]);

  const onSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await savePublicProfile({ displayName, bio, avatarUrl, interests });
      setSavedMsg('Account details saved.');
      setRating(await fetchLiveRatingSummary(auth.currentUser?.uid));
    } catch (saveError) {
      setError(saveError?.message ?? 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const onAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const nextAvatarUrl = await prepareProfileImage(file);
      setAvatarUrl(nextAvatarUrl);
      await savePublicProfile({ displayName, bio, avatarUrl: nextAvatarUrl, interests });
      setSavedMsg('Profile picture updated.');
    } catch (avatarError) {
      setError(avatarError?.message ?? 'Could not prepare that image.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!resolvedEmail) return;
    setResetBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      await sendHotTakePasswordResetEmail(resolvedEmail);
      setSavedMsg('Password reset instructions were sent to your email.');
    } catch (resetError) {
      setError(resetError?.message ?? 'Could not send password reset instructions.');
    } finally {
      setResetBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteText !== 'DELETE' || !auth.currentUser) return;
    setDeleteBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || 'Could not delete your account.');
      await signOut(auth).catch(() => {});
      onDeleted?.();
    } catch (deleteError) {
      setError(deleteError?.message ?? 'Could not delete your account.');
      setDeleteBusy(false);
    }
  };

  const toggleFollow = async () => {
    setFollowBusy(true);
    setError(null);
    try {
      if (following) {
        const result = await networkUnfollow(networkIdentityState.uid);
        setFollowing(false);
        setFollowerCount(Number(result.followerCount || 0));
      } else {
        const result = await networkFollow(networkIdentityState.uid);
        setFollowing(true);
        setFollowerCount(Number(result.followerCount || 0));
      }
      const followersResult = await networkFollowers(networkIdentityState.uid);
      setFollowerMembers(followersResult.members || []);
    } catch (followError) {
      setError(followError?.message ?? 'Could not update follow.');
    } finally {
      setFollowBusy(false);
    }
  };

  const toggleAppearOffline = async () => {
    const nextValue = !appearOffline;
    setPrivacyBusy(true);
    setError(null);
    try {
      const result = await networkUpdatePresencePrivacy(nextValue);
      setAppearOffline(result.appearOffline === true);
      setSavedMsg(result.appearOffline ? 'You now appear offline to other members.' : 'Your activity is visible again.');
    } catch (privacyError) {
      setError(privacyError?.message || 'Could not update your activity privacy.');
    } finally {
      setPrivacyBusy(false);
    }
  };

  const sendDirectMessage = async (event) => {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!text || !networkIdentityState.uid) return;
    setMessageBusy(true);
    setError(null);
    try {
      await networkSendDirectMessage(networkIdentityState.uid, text);
      setMessageDraft('');
      const conversation = await networkDirectMessages(networkIdentityState.uid);
      setDirectMessages(conversation.messages || []);
      setMessageRequestPending(conversation.pendingForRecipient === true || conversation.declinedForRecipient === true);
    } catch (messageError) {
      setError(messageError?.message || 'Could not send that message.');
    } finally {
      setMessageBusy(false);
    }
  };

  const decideMessageRequest = async (decision) => {
    if (!networkIdentityState.uid) return;
    setMessageBusy(true);
    setError(null);
    try {
      await networkDecideDirectMessage(networkIdentityState.uid, decision);
      setMessageRequestPending(false);
      if (decision === 'accept') {
        const conversation = await networkDirectMessages(networkIdentityState.uid);
        setDirectMessages(conversation.messages || []);
      } else {
        setMessageOpen(false);
        setDirectMessages([]);
      }
    } catch (requestError) {
      setError(requestError?.message || 'Could not update that message request.');
    } finally {
      setMessageBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!liveTargetUid || blockBusy || blockState.blockedYou && !blockState.youBlocked) return;
    const willBlock = !blockState.youBlocked;
    if (willBlock && !window.confirm(`Block ${displayName || 'this member'}? You will not be able to match, join rooms, follow, or message each other.`)) return;
    setBlockBusy(true);
    setError(null);
    try {
      const result = willBlock ? await networkBlock(liveTargetUid) : await networkUnblock(liveTargetUid);
      setBlockState(result);
      if (willBlock) {
        setFollowing(false);
        setMessageOpen(false);
        setDirectMessages([]);
        setMessageRequestPending(false);
      }
    } catch (blockError) {
      setError(blockError?.message || 'Could not update this block.');
    } finally {
      setBlockBusy(false);
    }
  };

  const unblockFromList = async (uid) => {
    setBlockBusy(true);
    setError(null);
    try {
      await networkUnblock(uid);
      setBlockedMembers((current) => current.filter((member) => member.uid !== uid));
    } catch (blockError) {
      setError(blockError?.message || 'Could not unblock this account.');
    } finally {
      setBlockBusy(false);
    }
  };

  const sharedHeader = <SiteHeader
    onHome={onHome || onBack}
    onAbout={onAbout}
    onTopics={onQuickMatch}
    onFaq={onFaq}
    onSupport={onSupport}
    isSignedIn
    onSignOut={onSignOut}
    onProfile={() => {}}
    onPickLegal={onPickLegal}
  />;

  const ratingDisplay = rating.average != null ? rating.average.toFixed(2) : '—';
  const ratingCountLabel = rating.count === 1 ? '1 debate rating' : `${rating.count} debate ratings`;
  const isStaffProfile = ['moderator', 'admin', 'owner'].includes(networkIdentityState.role);
  const openTags = () => {
    setTagDraft(interests);
    setTagsOpen(true);
  };
  const toggleDraftInterest = (interest) => {
    setTagDraft((current) => {
      if (current.includes(interest)) return current.filter((item) => item !== interest);
      const category = PROFILE_INTEREST_GROUPS.find((group) => group.options.includes(interest));
      const selectedInCategory = category?.options.filter((option) => current.includes(option)).length || 0;
      return selectedInCategory < MAX_PROFILE_INTERESTS_PER_CATEGORY ? [...current, interest] : current;
    });
  };
  const saveTags = async () => {
    setTagBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const savedInterests = await saveProfileInterests(tagDraft);
      setInterests(savedInterests);
      setTagsOpen(false);
      setSavedMsg('Profile tags saved.');
    } catch (tagError) {
      setError(tagError?.message ?? 'Could not update your profile tags.');
    } finally {
      setTagBusy(false);
    }
  };
  const interestBanner = (interests.length > 0 || isStaffProfile) && <div className="account-interest-banner" aria-label="Profile interests">
    {isStaffProfile && <span className="account-staff-tag">STAFF</span>}
    {interests.map((interest) => <span key={interest}>{interest}</span>)}
  </div>;
  const overviewInterestBanner = interests.length > 0 && <div className="account-overview-interests" aria-label="Your profile tags">
    <small>Profile tags</small>
    <div>{interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
  </div>;

  if (!resolvedEmail && !targetUid) {
    return <div className="account-page">{sharedHeader}<main className="account-empty"><p>Could not resolve this account.</p><button type="button" onClick={onBack}>Back</button></main></div>;
  }

  if (!own) {
    return <div className={`account-page${embedded ? ' account-page--embedded' : ''}`}>
      {!embedded && sharedHeader}
      <main className="account-shell account-public-shell">
        {!embedded && <button type="button" className="account-back" onClick={onBack}>← Back</button>}
        <section className="account-card account-public-card">
          {loading ? <p>Loading profile…</p> : <>
            <div className="public-profile-hero">
              <div className={'account-avatar' + (avatarUrl ? ' has-image' : '')}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <GenericAvatar />}</div>
              <div className="public-profile-identity">
                <p className="account-eyebrow">Community profile</p>
                <div className="public-profile-name-row"><h1>{displayName || 'Hot Take member'} <IdentityBadges premium={networkIdentityState.premium} verified={networkIdentityState.verifiedDebater} role={networkIdentityState.role} /></h1></div>
                {interestBanner}
                <section className="public-profile-bio-card" aria-label={`About ${displayName || 'this member'}`}>
                  <div><span aria-hidden="true" />About {displayName || 'this member'}</div>
                  <p>{bio || 'This member has not added a bio yet.'}</p>
                </section>
              </div>
              <div className="public-profile-actions">
                <button type="button" className="account-secondary-button" onClick={toggleFollow} disabled={followBusy || blockState.blocked}>{followBusy ? 'Updating…' : following ? 'Unfollow' : 'Follow'}</button>
                <button type="button" className="public-profile-message-button" disabled={blockState.blocked} onClick={() => setMessageOpen((open) => !open)} aria-expanded={messageOpen}>{blockState.blocked ? 'Messages unavailable' : messageOpen ? 'Close messages' : `Message ${displayName || 'member'}`}</button>
                <button type="button" className="public-profile-report-button" onClick={() => setProfileReportOpen(true)} disabled={!liveTargetUid}>Report profile</button>
                <button type="button" className={`public-profile-block-button${blockState.youBlocked ? ' is-blocked' : ''}`} onClick={toggleBlock} disabled={!liveTargetUid || blockBusy || (blockState.blockedYou && !blockState.youBlocked)}>{blockBusy ? 'Updating…' : blockState.youBlocked ? 'Unblock user' : blockState.blockedYou ? 'Interaction unavailable' : 'Block user'}</button>
              </div>
            </div>
            <label className="public-profile-mobile-network-picker">
              <span>Debate network</span>
              <select value={followersPanelOpen ? 'followers' : followingPanelOpen ? 'following' : ''} onChange={(event) => {
                const view = event.target.value;
                setFollowersPanelOpen(view === 'followers');
                setFollowingPanelOpen(view === 'following');
              }}>
                <option value="">View followers or following</option>
                <option value="followers">Followers ({followerCount.toLocaleString()})</option>
                <option value="following">Following ({followedMembers.length.toLocaleString()})</option>
              </select>
            </label>
            <div className="public-profile-dashboard" aria-label="Profile statistics">
              <button type="button" onClick={() => { setFollowersPanelOpen(true); setFollowingPanelOpen(false); }} className={`public-profile-network-stat ${followersPanelOpen ? 'is-active' : ''}`}><span>Followers</span><strong>{followerCount.toLocaleString()}</strong><small>View community <b>→</b></small></button>
              <button type="button" onClick={() => { setFollowingPanelOpen(true); setFollowersPanelOpen(false); }} className={`public-profile-network-stat ${followingPanelOpen ? 'is-active' : ''}`}><span>Following</span><strong>{followedMembers.length.toLocaleString()}</strong><small>View network <b>→</b></small></button>
              <section><span>Debate rating</span><div><strong>{ratingDisplay}</strong><b className="public-profile-rating-star">★</b></div><small>{ratingCountLabel}</small></section>
              <section className={`public-profile-dashboard-status public-profile-activity--${activity.key}`}><span>Current status</span><div><i aria-hidden="true" /><strong>{activity.label}</strong></div><small>Activity visibility</small></section>
            </div>
            {(followersPanelOpen || followingPanelOpen) && <section className="public-profile-network-panel" aria-label={followersPanelOpen ? `${displayName}'s followers` : `Accounts ${displayName} follows`}>
              <header>
                <div><span>DEBATE NETWORK</span><h2>{followersPanelOpen ? 'Followers' : 'Following'}</h2><p>{followersPanelOpen ? `People who follow ${displayName || 'this member'}.` : `Accounts ${displayName || 'this member'} follows.`}</p></div>
                <b>{(followersPanelOpen ? followerMembers : followedMembers).length}</b>
                <button type="button" onClick={() => { setFollowersPanelOpen(false); setFollowingPanelOpen(false); }} aria-label="Close network list">×</button>
              </header>
              {(followersPanelOpen ? followerMembers : followedMembers).length ? <div className="account-following-list">
                {(followersPanelOpen ? followerMembers : followedMembers).map((member) => <button type="button" key={member.uid} className="account-following-member" onClick={() => onOpenProfile?.(member.uid)}>
                  <span className={'account-following-avatar' + (member.avatarUrl ? ' has-image' : '')}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span>
                  <span className="account-following-identity"><strong>{member.displayName || 'Hot Take member'} <IdentityBadges compact premium={member.premium} verified={member.verifiedDebater} role={member.role} /></strong><small><i className={`is-${member.activity?.key || 'offline'}`} aria-hidden="true" />{member.activity?.label || 'Offline'}</small></span>
                  <span className="account-following-view">View profile <b aria-hidden="true">→</b></span>
                </button>)}
              </div> : <div className="account-following-empty"><strong>{followersPanelOpen ? 'No followers yet.' : 'Not following anyone yet.'}</strong><p>This list will update as connections are made.</p></div>}
            </section>}
            {hostedRoom && <section className="public-profile-live-room" aria-label="Live public debate room">
              <div className="public-profile-live-room-copy">
                <span className="public-profile-live-kicker"><i aria-hidden="true" /> Hosting now</span>
                <h2>{hostedRoom.statement}</h2>
                <p>A public opponent spot is open.</p>
              </div>
              {!blockState.blocked && canJoinHostedRoom && onJoinHostedRoom
                ? <button type="button" className="public-profile-join-room" onClick={() => onJoinHostedRoom(hostedRoom.roomCode)}>Join debate →</button>
                : <span className="public-profile-your-room">{blockState.blocked ? 'Unable to join' : 'Your room'}</span>}
            </section>}
            {messageOpen && <section className="public-profile-messages" aria-label="Direct messages" role="dialog" aria-modal="false">
              <header><div><span>Direct messages</span><h2>Message {displayName || 'this member'}</h2><small>Private conversation</small></div><button type="button" className="public-profile-message-close" onClick={() => setMessageOpen(false)} aria-label="Close messages">×</button></header>
              {messageRequestPending ? <div className="public-profile-message-request">
                <div className={'account-avatar' + (avatarUrl ? ' has-image' : '')}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <GenericAvatar />}</div>
                <span>Message request</span>
                <h3>Accept DMs from {displayName || 'this member'}?</h3>
                <p>The first message is hidden until you accept this request.</p>
                <div><button type="button" onClick={() => decideMessageRequest('decline')} disabled={messageBusy}>Decline</button><button type="button" className="is-accept" onClick={() => decideMessageRequest('accept')} disabled={messageBusy}>{messageBusy ? 'Updating…' : 'Accept DMs'}</button></div>
              </div> : <><div className="public-profile-message-list">
                {directMessages.length ? directMessages.map((message) => <article key={message.id} className={message.senderUid === auth.currentUser?.uid ? 'is-mine' : ''}>
                  <p>{message.text}</p><time>{message.createdAtMs ? new Date(message.createdAtMs).toLocaleString() : 'Just now'}</time>
                </article>) : <p className="public-profile-message-empty">No messages yet. Start the conversation.</p>}
              </div>
              <form onSubmit={sendDirectMessage}><textarea value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={1000} placeholder="Write a private message…" required /><div><small>{messageDraft.length}/1000</small><button type="submit" disabled={messageBusy || !messageDraft.trim()}>{messageBusy ? 'Sending…' : 'Send message'}</button></div></form></>}
            </section>}
          </>}
          {error && <div className="account-alert account-alert--error">{error}</div>}
        </section>
      </main>
      <ProfileReportDialog open={profileReportOpen} onClose={() => setProfileReportOpen(false)} profile={{ uid: liveTargetUid, displayName, bio, avatarUrl }} />
      {!embedded && <SiteFooter onHome={onHome || onBack} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />}
    </div>;
  }

  return <div className="account-page">
    {sharedHeader}
    <main className="account-shell">
      <section className="account-heading">
        <p className="account-eyebrow">Account settings</p>
        <h1>Your account<span>.</span></h1>
        <p>Manage your identity, public information, security, and account data.</p>
      </section>

      <div className="account-layout">
        <aside className="account-nav" aria-label="Account sections">
          <p className="account-nav-label">Account</p>
          <a href="#account-overview"><AccountIcon type="user" />Overview</a>
          <button type="button" onClick={() => { setFollowersPanelOpen(true); setFollowingPanelOpen(false); }}><AccountIcon type="user" />Followers</button>
          <button type="button" onClick={() => { setFollowingPanelOpen(true); setFollowersPanelOpen(false); }}><AccountIcon type="user" />Following</button>
          <a href="#account-profile"><AccountIcon type="user" />Public profile</a>
          <a href="#account-security"><AccountIcon type="lock" />Security</a>
          <a href="#account-danger" className="account-nav-danger"><AccountIcon type="trash" />Delete account</a>
        </aside>

        <div className="account-content">
          {error && <div className="account-alert account-alert--error" role="alert">{error}</div>}
          {savedMsg && <div className="account-alert account-alert--success" role="status">{savedMsg}</div>}

          <section id="account-overview" className="account-card account-overview">
            <label className="account-avatar-quick-edit" aria-label="Change profile picture">
              <span className={'account-avatar' + (avatarUrl ? ' has-image' : '')}>{avatarUrl ? <img src={avatarUrl} alt="Your profile" /> : <GenericAvatar />}</span>
              <span className="account-avatar-edit-badge" aria-hidden="true">Edit</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy || saving} onChange={onAvatarSelected} />
            </label>
            <div>
              <p className="account-section-label">Signed in as</p>
              <h2>{displayName || 'Hot Take member'} <IdentityBadges premium={networkIdentityState.premium} verified={networkIdentityState.verifiedDebater} role={networkIdentityState.role} /></h2>
              <p>{resolvedEmail}</p>
              <div className="account-overview-stats">
                <span className="account-overview-rating" aria-label={rating.count ? `Debate rating ${ratingDisplay} out of 5 from ${ratingCountLabel}` : 'No debate ratings yet'}>
                  <span aria-hidden="true">★</span><strong>{ratingDisplay}</strong>{rating.count > 0 && <small>({rating.count})</small>}
                </span>
                <button type="button" className="account-overview-followers" onClick={() => { setFollowersPanelOpen(true); setFollowingPanelOpen(false); }} aria-label={`${followerCount} ${followerCount === 1 ? 'follower' : 'followers'}. Open your followers.`}>
                  <strong>{followerCount.toLocaleString()}</strong> {followerCount === 1 ? 'follower' : 'followers'} <span aria-hidden="true">→</span>
                </button>
                <button type="button" className="account-overview-followers" onClick={() => { setFollowingPanelOpen(true); setFollowersPanelOpen(false); }} aria-label={`${followedMembers.length} following. Open accounts you follow.`}>
                  <strong>{followedMembers.length.toLocaleString()}</strong> following <span aria-hidden="true">→</span>
                </button>
              </div>
              {overviewInterestBanner}
            </div>
            <div className="account-overview-tools">
              <span className={`account-status ${auth.currentUser?.emailVerified ? 'verified' : ''}`}>
                {auth.currentUser?.emailVerified ? 'Verified' : 'Verification required'}
              </span>
              <button type="button" className="account-tags-button" onClick={openTags}>Tags <b aria-hidden="true">+</b></button>
            </div>
          </section>

          {loading ? <section className="account-card"><p>Loading your account…</p></section> : <>
            <section id="account-profile" className="account-card">
              <div className="account-card-heading">
                <span><AccountIcon type="user" /></span>
                <div><h2>Public profile</h2><p>This information is visible to other Hot Take members.</p></div>
              </div>
              <form className="account-form" onSubmit={onSave}>
                <label htmlFor="account-display-name">Display name</label>
                <input id="account-display-name" type="text" minLength={2} maxLength={40} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <label htmlFor="account-bio">Bio</label>
                <textarea id="account-bio" rows={4} maxLength={500} placeholder="Tell people what you care to debate or discuss." value={bio} onChange={(event) => setBio(event.target.value)} />
                <div className="account-form-footer"><span>{bio.length}/500</span><button type="submit" className="account-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
              </form>
            </section>

            {followersPanelOpen && <section id="account-followers" className="account-card account-following-card">
              <div className="account-card-heading">
                <span><AccountIcon type="user" /></span>
                <div><h2>Followers</h2><p>People who follow you on Hot Take.</p></div>
                <b className="account-following-count">{followerMembers.length}</b>
                <button type="button" className="account-following-close" onClick={() => setFollowersPanelOpen(false)} aria-label="Close Followers panel">×</button>
              </div>
              {followerMembers.length ? <div className="account-following-list">
                {followerMembers.map((member) => <button type="button" key={member.uid} className="account-following-member" onClick={() => onOpenProfile?.(member.uid)}>
                  <span className={'account-following-avatar' + (member.avatarUrl ? ' has-image' : '')}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span>
                  <span className="account-following-identity"><strong>{member.displayName || 'Hot Take member'} <IdentityBadges compact premium={member.premium} verified={member.verifiedDebater} role={member.role} /></strong><small><i className={`is-${member.activity?.key || 'offline'}`} aria-hidden="true" />{member.activity?.label || 'Offline'}</small></span>
                  <span className="account-following-view">View profile <b aria-hidden="true">→</b></span>
                </button>)}
              </div> : <div className="account-following-empty"><strong>You don’t have any followers yet.</strong><p>Your followers will appear here when people discover and follow your profile.</p></div>}
            </section>}

            {followingPanelOpen && <section id="account-following" className="account-card account-following-card">
              <div className="account-card-heading">
                <span><AccountIcon type="user" /></span>
                <div><h2>Following</h2><p>Accounts you follow across Hot Take.</p></div>
                <b className="account-following-count">{followedMembers.length}</b>
                <button type="button" className="account-following-close" onClick={() => setFollowingPanelOpen(false)} aria-label="Close Following panel">×</button>
              </div>
              {followedMembers.length ? <div className="account-following-list">
                {followedMembers.map((member) => <button type="button" key={member.uid} className="account-following-member" onClick={() => onOpenProfile?.(member.uid)}>
                  <span className={'account-following-avatar' + (member.avatarUrl ? ' has-image' : '')}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span>
                  <span className="account-following-identity"><strong>{member.displayName || 'Hot Take member'} <IdentityBadges compact premium={member.premium} verified={member.verifiedDebater} role={member.role} /></strong><small><i className={`is-${member.activity?.key || 'offline'}`} aria-hidden="true" />{member.activity?.label || 'Offline'}</small></span>
                  <span className="account-following-view">View profile <b aria-hidden="true">→</b></span>
                </button>)}
              </div> : <div className="account-following-empty"><strong>You aren’t following anyone yet.</strong><p>Search for debaters or open a community profile to follow them.</p></div>}
            </section>}

            <section id="account-security" className="account-card">
              <div className="account-card-heading">
                <span><AccountIcon type="shield" /></span>
                <div><h2>Security</h2><p>Control account verification and sign-in recovery.</p></div>
              </div>
              <div className="account-setting-row"><div><strong>Email verification</strong><p>Verified accounts can access debates and protected community features.</p></div><ProfileEmailVerification /></div>
              <div className="account-setting-row"><div><strong>Sign-in method</strong><p>{providerLabel}</p></div><span className="account-setting-value">{providerLabel}</span></div>
              <div className="account-setting-row"><div><strong>Activity privacy</strong><p>Appear offline to other members without signing out or disabling debates and messages.</p></div><button type="button" className={`account-privacy-toggle${appearOffline ? ' is-active' : ''}`} role="switch" aria-checked={appearOffline} onClick={toggleAppearOffline} disabled={privacyBusy}><span aria-hidden="true" />{privacyBusy ? 'Saving…' : appearOffline ? 'Appearing offline' : 'Activity visible'}</button></div>
              <div className="account-setting-row"><div><strong>Password recovery</strong><p>Send secure reset instructions to {resolvedEmail}.</p></div><button type="button" className="account-secondary-button" onClick={sendPasswordReset} disabled={resetBusy}>{resetBusy ? 'Sending…' : 'Send reset email'}</button></div>
              <div className="account-blocked-section"><div><strong>Blocked accounts</strong><p>Blocked accounts cannot match, join your rooms, follow, or message you.</p></div>{blockedMembers.length ? <div className="account-blocked-list">{blockedMembers.map((member) => <div key={member.uid}><span className={'account-following-avatar' + (member.avatarUrl ? ' has-image' : '')}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span><strong>{member.displayName || 'Hot Take member'}</strong><button type="button" onClick={() => unblockFromList(member.uid)} disabled={blockBusy}>Unblock</button></div>)}</div> : <small>You have not blocked anyone.</small>}</div>
            </section>

            <section id="account-danger" className="account-card account-danger">
              <div className="account-card-heading">
                <span><AccountIcon type="trash" /></span>
                <div><h2>Delete account</h2><p>Permanently remove your Hot Take account and associated data.</p></div>
              </div>
              <div className="account-danger-warning">
                <strong>This action cannot be undone.</strong>
                <p>Your public profile, debate history, posts, reports, and Firebase sign-in account will be deleted. For security, you may be asked to sign in again first.</p>
              </div>
              <label htmlFor="delete-confirmation">Type <b>DELETE</b> to confirm</label>
              <div className="account-delete-row">
                <input id="delete-confirmation" type="text" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" />
                <button type="button" className="account-delete-button" disabled={deleteText !== 'DELETE' || deleteBusy} onClick={deleteAccount}>{deleteBusy ? 'Deleting…' : 'Delete my account'}</button>
              </div>
            </section>
          </>}
        </div>
      </div>
    </main>
    {tagsOpen && <div className="account-tags-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !tagBusy) setTagsOpen(false); }}>
      <section className="account-tags-modal" role="dialog" aria-modal="true" aria-labelledby="profile-tags-title">
        <header>
          <div><p className="account-eyebrow">Personalize your profile</p><h2 id="profile-tags-title">Choose your tags<span>.</span></h2><small>Select up to {MAX_PROFILE_INTERESTS_PER_CATEGORY} interests from each category.</small></div>
          <button type="button" onClick={() => setTagsOpen(false)} disabled={tagBusy} aria-label="Close tags menu">×</button>
        </header>
        <div className="account-tags-selected"><strong>Your selections</strong><span>{tagDraft.length} selected</span><div>{tagDraft.length ? tagDraft.map((interest) => <button key={interest} type="button" onClick={() => toggleDraftInterest(interest)}>{interest} <b aria-hidden="true">×</b></button>) : <small>No tags selected yet.</small>}</div></div>
        <div className="account-tags-modal-content">
          {PROFILE_INTEREST_GROUPS.map((group) => {
            const selectedInGroup = group.options.filter((interest) => tagDraft.includes(interest)).length;
            return <section key={group.label}>
            <div><h3>{group.label} <span>{selectedInGroup}/{MAX_PROFILE_INTERESTS_PER_CATEGORY}</span></h3><p>{group.description}</p></div>
            <div className="account-tags-options">{group.options.map((interest) => {
              const selected = tagDraft.includes(interest);
              const disabled = !selected && selectedInGroup >= MAX_PROFILE_INTERESTS_PER_CATEGORY;
              return <button key={interest} type="button" className={selected ? 'selected' : ''} aria-pressed={selected} disabled={disabled || tagBusy} onClick={() => toggleDraftInterest(interest)}><span aria-hidden="true">{selected ? '✓' : '+'}</span>{interest}</button>;
            })}</div>
          </section>;})}
        </div>
        <footer><button type="button" className="account-tags-cancel" onClick={() => setTagsOpen(false)} disabled={tagBusy}>Cancel</button><button type="button" className="account-tags-save" onClick={saveTags} disabled={tagBusy}>{tagBusy ? 'Saving…' : 'Save selections'}</button></footer>
      </section>
    </div>}
    <SiteFooter onHome={onHome || onBack} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />
  </div>;
}

