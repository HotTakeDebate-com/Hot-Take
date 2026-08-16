import { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from './firebase.js';
import {
  networkDecideDirectMessage,
  networkDirectConversations,
  networkDirectMessages,
  networkSendDirectMessage,
} from './networkApi.js';
import GenericAvatar from './GenericAvatar.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import './DebateNetwork.css';

function displayTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function DirectMessageCenter({ socket }) {
  const [conversations, setConversations] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const myUid = auth?.currentUser?.uid || '';
  const pendingCount = conversations.filter((item) => item.pendingForRecipient).length;

  const loadConversations = useCallback(async () => {
    try {
      const result = await networkDirectConversations();
      setConversations(result.conversations || []);
    } catch { /* The shared header remains usable if inbox loading fails. */ }
  }, []);

  const loadThread = useCallback(async (conversation) => {
    if (!conversation?.otherUid) return;
    setLoading(true);
    setError('');
    try {
      const result = await networkDirectMessages(conversation.otherUid);
      setThread(result);
    } catch (requestError) {
      setError(requestError.message || 'This conversation could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => {
      void loadConversations();
      if (active) void loadThread(active);
    };
    socket.on('direct-message', refresh);
    socket.on('dm-request', refresh);
    socket.on('dm-request-decided', refresh);
    return () => {
      socket.off('direct-message', refresh);
      socket.off('dm-request', refresh);
      socket.off('dm-request-decided', refresh);
    };
  }, [active, loadConversations, loadThread, socket]);
  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [thread?.messages]);

  const chooseConversation = (conversation) => {
    setActive(conversation);
    setThread(null);
    setText('');
    setOpen(false);
    void loadThread(conversation);
  };

  const decide = async (decision) => {
    if (!active?.otherUid) return;
    setBusy(true);
    setError('');
    try {
      await networkDecideDirectMessage(active.otherUid, decision);
      await loadConversations();
      if (decision === 'accept') await loadThread({ ...active, status: 'accepted', pendingForRecipient: false });
      else { setActive(null); setThread(null); }
    } catch (requestError) {
      setError(requestError.message || 'The message request could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const send = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message || !active?.otherUid) return;
    setBusy(true);
    setError('');
    try {
      await networkSendDirectMessage(active.otherUid, message);
      setText('');
      await Promise.all([loadThread(active), loadConversations()]);
    } catch (requestError) {
      setError(requestError.message || 'Your message could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const profile = active?.otherProfile || {};
  const isPendingRecipient = Boolean(thread?.pendingForRecipient || active?.pendingForRecipient);
  const isPendingSender = !isPendingRecipient && (thread?.conversation?.status === 'pending' || active?.status === 'pending');
  const deleted = profile.deleted === true;

  return <div className="dm-center" ref={rootRef}>
    <button type="button" className="dm-center-trigger" aria-label="Direct messages" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.8 9.8 0 0 1-3.8-.8L3 21l1.7-4.4A8 8 0 0 1 3 11.5C3 6.8 7 3 12 3s9 3.8 9 8.5Z"/><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"/></svg>
      {pendingCount > 0 && <span>{pendingCount > 9 ? '9+' : pendingCount}</span>}
    </button>

    {open && <section className="dm-center-panel" aria-label="Direct message inbox">
      <header><div><small>Private conversations</small><h3>Messages</h3></div><button type="button" onClick={loadConversations}>Refresh</button></header>
      {conversations.length ? <div className="dm-center-list">
        {conversations.map((conversation) => {
          const member = conversation.otherProfile || {};
          return <button type="button" key={conversation.id} className={conversation.pendingForRecipient ? 'is-request' : ''} onClick={() => chooseConversation(conversation)}>
            <span className={`dm-center-avatar${member.avatarUrl ? ' has-image' : ''}`}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span>
            <span className="dm-center-preview"><b>{member.displayName || 'Deleted account'} <IdentityBadges compact verified={member.verifiedDebater} premium={member.premium} role={member.role} /></b><em>{conversation.pendingForRecipient ? 'New message request' : (conversation.lastMessage || 'Open conversation')}</em></span>
            <time>{displayTime(conversation.updatedAtMs)}</time>
          </button>;
        })}
      </div> : <p className="dm-center-empty">No conversations yet. Visit a member&apos;s profile to send a message.</p>}
    </section>}

    {active && <section className="public-profile-messages dm-center-drawer" aria-label={`Messages with ${profile.displayName || 'member'}`}>
      <header>
        <span className={`dm-center-avatar${profile.avatarUrl ? ' has-image' : ''}`}>{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <GenericAvatar />}</span>
        <div><span>Direct messages</span><h2>{profile.displayName || 'Deleted account'} <IdentityBadges compact verified={profile.verifiedDebater} premium={profile.premium} role={profile.role} /></h2><small>{deleted ? 'Account deleted · conversation retained' : 'Private conversation'}</small></div>
        <button type="button" className="public-profile-message-close" aria-label="Close messages" onClick={() => { setActive(null); setThread(null); }}>&times;</button>
      </header>
      {isPendingRecipient ? <div className="dm-center-request">
        <small>Message request</small><h3>Accept DMs from {profile.displayName || 'this user'}?</h3><p>The first message is hidden until you approve this conversation.</p>
        {error && <p className="dm-center-error">{error}</p>}
        <div><button type="button" onClick={() => decide('decline')} disabled={busy}>Decline</button><button type="button" className="is-accept" onClick={() => decide('accept')} disabled={busy}>{busy ? 'Updating…' : 'Accept DMs'}</button></div>
      </div> : <>
        <div className="public-profile-message-list" ref={listRef}>
          {loading ? <p className="public-profile-message-empty">Loading conversation…</p> : (thread?.messages || []).length ? thread.messages.map((message) => <article key={message.id} className={message.senderUid === myUid ? 'is-mine' : ''}><p>{message.text}</p><time>{displayTime(message.createdAtMs)}</time></article>) : <p className="public-profile-message-empty">No messages yet.</p>}
        </div>
        <form onSubmit={send}>
          {isPendingSender && <p className="dm-center-notice">Waiting for {profile.displayName || 'this member'} to accept your message request.</p>}
          {deleted && <p className="dm-center-notice">This account was deleted. Existing messages remain available, but new messages cannot be sent.</p>}
          {error && <p className="dm-center-error">{error}</p>}
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} placeholder="Write a private message…" disabled={busy || isPendingSender || deleted} />
          <div><small>{text.length}/1000</small><button type="submit" disabled={busy || isPendingSender || deleted || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button></div>
        </form>
      </>}
    </section>}
  </div>;
}

