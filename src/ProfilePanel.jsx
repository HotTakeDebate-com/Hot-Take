import { useCallback, useEffect, useState } from 'react';
import {
  fetchPublicProfile,
  followUser,
  isFollowingUser,
  savePublicProfile,
  unfollowUser,
  userProfileDocId,
} from './chitChatFirestore.js';
import { auth } from './firebase.js';

/**
 * @param {string | null} targetEmail — null = signed-in user’s profile (edit). Otherwise view that user.
 */
export default function ProfilePanel({ targetEmail, onBack }) {
  const own = targetEmail == null;
  const resolvedEmail =
    own && auth.currentUser?.email ? userProfileDocId(auth.currentUser) : String(targetEmail ?? '').toLowerCase();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState(null);

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
      if (!own) {
        setFollowing(await isFollowingUser(resolvedEmail));
      }
    } catch (e) {
      setError(e?.message ?? 'Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [resolvedEmail, own]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await savePublicProfile({ displayName, bio });
      setSavedMsg('Profile saved.');
      await load();
    } catch (err) {
      setError(err?.message ?? 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const toggleFollow = async () => {
    setFollowBusy(true);
    setError(null);
    try {
      if (following) {
        await unfollowUser(resolvedEmail);
        setFollowing(false);
      } else {
        await followUser(resolvedEmail);
        setFollowing(true);
      }
    } catch (err) {
      setError(err?.message ?? 'Could not update follow.');
    } finally {
      setFollowBusy(false);
    }
  };

  if (!resolvedEmail) {
    return (
      <div className="panel">
        <p>Could not resolve profile.</p>
        <button type="button" className="back-btn" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="panel social-profile">
      <h2>{own ? 'My profile' : 'Profile'}</h2>
      <p className="social-profile-email">{resolvedEmail}</p>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {savedMsg && (
        <p className="auth-success" role="status">
          {savedMsg}
        </p>
      )}

      {loading ? (
        <div className="social-panel-loading" role="status" aria-live="polite">
          <div className="spinner" aria-hidden />
          <p className="social-loading">Loading profile…</p>
        </div>
      ) : own ? (
        <form className="social-profile-form" onSubmit={onSave}>
          <label className="auth-label" htmlFor="prof-display">
            Display name
          </label>
          <input
            id="prof-display"
            className="auth-input"
            type="text"
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <label className="auth-label" htmlFor="prof-bio">
            Bio
          </label>
          <textarea
            id="prof-bio"
            className="auth-input social-bio-input"
            rows={4}
            maxLength={500}
            placeholder="Tell others what you care to debate or discuss."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="social-char-count">{bio.length}/500</p>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      ) : (
        <div className="social-profile-readonly">
          <h3 className="social-profile-display">{displayName || '(No display name)'}</h3>
          <p className="social-profile-bio">{bio || 'No bio yet.'}</p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={toggleFollow}
            disabled={followBusy}
          >
            {followBusy
              ? following
                ? 'Unfollowing…'
                : 'Following…'
              : following
                ? 'Unfollow'
                : 'Follow'}
          </button>
        </div>
      )}

      <button type="button" className="back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
