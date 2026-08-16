import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  fetchPublicProfile,
  savePublicProfile,
  userProfileDocId,
} from './chitChatFirestore.js';
import { auth } from './firebase.js';
import { sendHotTakePasswordResetEmail } from './firebaseEmailVerification.js';
import ProfileEmailVerification from './ProfileEmailVerification.jsx';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import { prepareProfileImage } from './profileImage.js';
import GenericAvatar from './GenericAvatar.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import { networkFollow, networkFollowStatus, networkIdentity, networkUnfollow } from './networkApi.js';
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
  onBack,
  onHome,
  onAbout,
  onQuickMatch,
  onFaq,
  onSupport,
  onSignOut,
  onPickLegal,
  onDeleted,
}) {
  const own = targetEmail == null;
  const resolvedEmail =
    own && auth.currentUser?.email
      ? userProfileDocId(auth.currentUser)
      : String(targetEmail ?? '').toLowerCase();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [rating, setRating] = useState({ average: null, count: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [networkIdentityState, setNetworkIdentityState] = useState({ uid: '', role: 'user', verifiedDebater: false });
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const providerLabel = useMemo(() => {
    const providers = auth.currentUser?.providerData?.map((item) => item.providerId) ?? [];
    if (providers.includes('google.com')) return 'Google';
    if (providers.includes('apple.com')) return 'Apple';
    return 'Email and password';
  }, []);

  const load = useCallback(async () => {
    if (!resolvedEmail) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const prof = await fetchPublicProfile(resolvedEmail);
      const fromAuth = own ? auth.currentUser?.displayName?.trim() ?? '' : '';
      setDisplayName(prof?.displayName?.trim() || fromAuth);
      setBio(prof?.bio ?? '');
      setAvatarUrl(prof?.avatarUrl ?? '');
      const ratingUid = own ? auth.currentUser?.uid : prof?.uid;
      setRating(await fetchLiveRatingSummary(ratingUid));
      if (!own && prof?.uid) {
        const [{ identity }, follow] = await Promise.all([networkIdentity(prof.uid), networkFollowStatus(prof.uid)]);
        setNetworkIdentityState(identity || { uid: prof.uid, role: 'user', verifiedDebater: false });
        setFollowing(follow.following === true);
      } else if (own && auth.currentUser?.uid) {
        const { identity } = await networkIdentity(auth.currentUser.uid);
        setNetworkIdentityState(identity || { uid: auth.currentUser.uid, role: 'user', verifiedDebater: false });
      }
    } catch (loadError) {
      setError(loadError?.message ?? 'Could not load account.');
    } finally {
      setLoading(false);
    }
  }, [resolvedEmail, own]);

  useEffect(() => {
    load();
  }, [load]);

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
      await savePublicProfile({ displayName, bio, avatarUrl });
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
      setAvatarUrl(await prepareProfileImage(file));
      setSavedMsg('Photo ready. Select Save changes to publish it.');
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
        await networkUnfollow(networkIdentityState.uid);
        setFollowing(false);
      } else {
        await networkFollow(networkIdentityState.uid);
        setFollowing(true);
      }
    } catch (followError) {
      setError(followError?.message ?? 'Could not update follow.');
    } finally {
      setFollowBusy(false);
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

  if (!resolvedEmail) {
    return <div className="account-page">{sharedHeader}<main className="account-empty"><p>Could not resolve this account.</p><button type="button" onClick={onBack}>Back</button></main></div>;
  }

  if (!own) {
    return <div className="account-page">
      {sharedHeader}
      <main className="account-shell account-public-shell">
        <button type="button" className="account-back" onClick={onBack}>← Back</button>
        <section className="account-card account-public-card">
          <p className="account-eyebrow">Community profile</p>
          {loading ? <p>Loading profile…</p> : <>
            <div className={'account-avatar' + (avatarUrl ? ' has-image' : '')}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <GenericAvatar />}</div>
            <h1>{displayName || 'Hot Take member'} <IdentityBadges verified={networkIdentityState.verifiedDebater} role={networkIdentityState.role} /></h1>
            <p>{bio || 'No bio yet.'}</p>
            <div style={{ margin: '1.25rem 0', padding: '1rem 1.1rem', border: '1px solid rgba(255,255,255,.12)', borderRadius: '14px', background: 'rgba(255,255,255,.025)' }}>
              <div style={{ fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Debate rating</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '.45rem', marginTop: '.25rem' }}>
                <strong style={{ fontSize: '1.8rem' }}>{ratingDisplay}</strong>
                <span style={{ color: '#ff2b2b', fontSize: '1.1rem' }}>★</span>
                <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{ratingCountLabel}</span>
              </div>
            </div>
            <button type="button" className="account-secondary-button" onClick={toggleFollow} disabled={followBusy}>
              {followBusy ? 'Updating…' : following ? 'Unfollow' : 'Follow'}
            </button>
          </>}
          {error && <div className="account-alert account-alert--error">{error}</div>}
        </section>
      </main>
      <SiteFooter onHome={onHome || onBack} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />
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
          <a href="#account-overview"><AccountIcon type="user" />Overview</a>
          <a href="#account-profile"><AccountIcon type="user" />Public profile</a>
          <a href="#account-security"><AccountIcon type="lock" />Security</a>
          <a href="#account-danger" className="account-nav-danger"><AccountIcon type="trash" />Delete account</a>
        </aside>

        <div className="account-content">
          {error && <div className="account-alert account-alert--error" role="alert">{error}</div>}
          {savedMsg && <div className="account-alert account-alert--success" role="status">{savedMsg}</div>}

          <section id="account-overview" className="account-card account-overview">
            <div className={'account-avatar' + (avatarUrl ? ' has-image' : '')}>{avatarUrl ? <img src={avatarUrl} alt="" /> : <GenericAvatar />}</div>
            <div>
              <p className="account-section-label">Signed in as</p>
              <h2>{displayName || 'Hot Take member'}</h2>
              <p>{resolvedEmail}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.38rem', marginTop: '.65rem', fontSize: '.95rem' }} aria-label={rating.count ? `Debate rating ${ratingDisplay} out of 5 from ${ratingCountLabel}` : 'No debate ratings yet'}>
                <span style={{ color: '#ff2b2b', lineHeight: 1 }} aria-hidden="true">★</span>
                <strong style={{ color: '#f4f4f6', fontSize: '.95rem' }}>{ratingDisplay}</strong>
                {rating.count > 0 && <span style={{ color: '#777781', fontSize: '.75rem' }}>({rating.count})</span>}
              </div>
            </div>
            <span className={`account-status ${auth.currentUser?.emailVerified ? 'verified' : ''}`}>
              {auth.currentUser?.emailVerified ? 'Verified' : 'Verification required'}
            </span>
          </section>

          {loading ? <section className="account-card"><p>Loading your account…</p></section> : <>
            <section id="account-profile" className="account-card">
              <div className="account-card-heading">
                <span><AccountIcon type="user" /></span>
                <div><h2>Public profile</h2><p>This information is visible to other Hot Take members.</p></div>
              </div>
              <form className="account-form" onSubmit={onSave}>
                <div className="account-avatar-editor">
                  <div className={'account-avatar account-avatar-preview' + (avatarUrl ? ' has-image' : '')}>{avatarUrl ? <img src={avatarUrl} alt="Profile preview" /> : <GenericAvatar />}</div>
                  <div>
                    <strong>Profile picture</strong>
                    <p>JPG, PNG, or WebP. Your image is cropped to a square before it is saved.</p>
                    <div className="account-avatar-actions">
                      <label className="account-secondary-button account-file-button">
                        {avatarBusy ? 'Preparing…' : 'Choose image'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={avatarBusy || saving} onChange={onAvatarSelected} />
                      </label>
                      {avatarUrl && <button type="button" className="account-secondary-button" disabled={avatarBusy || saving} onClick={() => setAvatarUrl('')}>Remove</button>}
                    </div>
                  </div>
                </div>
                <label htmlFor="account-display-name">Display name</label>
                <input id="account-display-name" type="text" maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                <label htmlFor="account-bio">Bio</label>
                <textarea id="account-bio" rows={4} maxLength={500} placeholder="Tell people what you care to debate or discuss." value={bio} onChange={(event) => setBio(event.target.value)} />
                <div className="account-form-footer"><span>{bio.length}/500</span><button type="submit" className="account-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
              </form>
            </section>

            <section id="account-security" className="account-card">
              <div className="account-card-heading">
                <span><AccountIcon type="shield" /></span>
                <div><h2>Security</h2><p>Control account verification and sign-in recovery.</p></div>
              </div>
              <div className="account-setting-row"><div><strong>Email verification</strong><p>Verified accounts can access debates and protected community features.</p></div><ProfileEmailVerification /></div>
              <div className="account-setting-row"><div><strong>Sign-in method</strong><p>{providerLabel}</p></div><span className="account-setting-value">{providerLabel}</span></div>
              <div className="account-setting-row"><div><strong>Password recovery</strong><p>Send secure reset instructions to {resolvedEmail}.</p></div><button type="button" className="account-secondary-button" onClick={sendPasswordReset} disabled={resetBusy}>{resetBusy ? 'Sending…' : 'Send reset email'}</button></div>
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
    <SiteFooter onHome={onHome || onBack} onAbout={onAbout} onFaq={onFaq} onSupport={onSupport} onPickLegal={onPickLegal} />
  </div>;
}

