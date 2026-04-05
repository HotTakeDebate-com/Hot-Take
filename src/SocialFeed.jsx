import { useCallback, useEffect, useState } from 'react';
import { createPost, deletePost, fetchFollowingEmails, fetchPostsForFeed } from './chitChatFirestore.js';
import { auth } from './firebase.js';

function formatPostTime(ts) {
  if (!ts?.toDate) return '';
  try {
    return ts.toDate().toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

export default function SocialFeed({ onBack, onOpenProfile }) {
  const [feedTab, setFeedTab] = useState('global');
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fol = await fetchFollowingEmails();
      setFollowing(fol);
      const rows = await fetchPostsForFeed({
        feedMode: feedTab,
        followingEmails: fol,
        maxPosts: 80,
      });
      setPosts(rows);
    } catch (e) {
      setError(e?.message ?? 'Could not load feed.');
    } finally {
      setLoading(false);
    }
  }, [feedTab]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmitPost = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (text.length < 1) return;
    setPosting(true);
    setError(null);
    try {
      await createPost(text);
      setDraft('');
      await load();
    } catch (err) {
      setError(err?.message ?? 'Could not post.');
    } finally {
      setPosting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    setError(null);
    try {
      await deletePost(id);
      await load();
    } catch (err) {
      setError(err?.message ?? 'Could not delete.');
    }
  };

  return (
    <div className="panel social-feed">
      <h2>Feed</h2>
      <p className="social-feed-lead">
        Share a take between rounds—Quick match and custom debates stay on the home screen.
      </p>

      <form className="social-composer" onSubmit={onSubmitPost}>
        <label className="auth-label" htmlFor="social-post-draft">
          New post
        </label>
        <textarea
          id="social-post-draft"
          className="auth-input social-composer-input"
          rows={3}
          maxLength={2000}
          placeholder="What’s on your mind?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="social-composer-footer">
          <span className="social-char-count">{draft.length}/2000</span>
          <button type="submit" className="btn btn-primary" disabled={posting || draft.trim().length < 1}>
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>

      <div className="social-feed-tabs" role="tablist" aria-label="Feed scope">
        <button
          type="button"
          role="tab"
          aria-selected={feedTab === 'global'}
          className={`social-tab ${feedTab === 'global' ? 'social-tab--active' : ''}`}
          onClick={() => setFeedTab('global')}
        >
          Everyone
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={feedTab === 'following'}
          className={`social-tab ${feedTab === 'following' ? 'social-tab--active' : ''}`}
          onClick={() => setFeedTab('following')}
        >
          Following ({following.length})
        </button>
      </div>

      {feedTab === 'following' && following.length === 0 && (
        <p className="social-empty-hint">
          You are not following anyone yet. Open a profile from a post (author name) and tap Follow.
        </p>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="social-panel-loading" role="status" aria-live="polite">
          <div className="spinner" aria-hidden />
          <p className="social-loading">Loading posts…</p>
        </div>
      ) : (
        <ul className="social-post-list">
          {posts.length === 0 ? (
            <li className="social-post-empty">No posts to show yet. Be the first.</li>
          ) : (
            posts.map((p) => {
              const isMine = p.authorUid === auth.currentUser?.uid;
              const author = p.authorEmail ?? 'unknown';
              return (
                <li key={p.id} className="social-post-card">
                  <div className="social-post-meta">
                    <button
                      type="button"
                      className="social-author-link"
                      onClick={() => onOpenProfile(author)}
                    >
                      {author}
                    </button>
                    <span className="social-post-time">{formatPostTime(p.createdAt)}</span>
                    {isMine && (
                      <button type="button" className="social-delete-btn" onClick={() => onDelete(p.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="social-post-text">{p.text}</p>
                </li>
              );
            })
          )}
        </ul>
      )}

      <button type="button" className="back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
