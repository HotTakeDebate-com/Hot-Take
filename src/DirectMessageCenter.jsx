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
    const requestDecided = () => refresh();
    const userBlocked = (event = {}) => {
      if (!event.uid) return;
      setConversations((current) => current.filter((item) => item.otherUid !== event.uid));
      setActive((current) => {
        if (current?.otherUid !== event.uid) return current;
        setThread(null);
        setText('');
        setError('');
        return null;
      });
    };
    socket.on('direct-message', refresh);
    socket.on('dm-request', refresh);
    socket.on('dm-request-decided', requestDecided);
    socket.on('user-blocked', userBlocked);
    return () => {
      socket.off('direct-message', refresh);
      socket.off('dm-request', refresh);
      socket.off('dm-request-decided', requestDecided);
      socket.off('user-blocked', userBlocked);
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
    const decidingConversation = active;
    setBusy(true);
    setError('');
    try {
      await networkDecideDirectMessage(decidingConversation.otherUid, decision);
      await loadConversations();
      if (decision === 'accept') await loadThread({ ...decidingConversation, status: 'accepted', pendingForRecipient: false });
      else {
        const declinedConversation = { ...decidingConversation, status: 'declined', pendingForRecipient: false, declinedForRecipient: true };
        setActive(declinedConversation);
        await loadThread(declinedConversation);
      }
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
  const isDeclinedRecipient = Boolean(thread?.declinedForRecipient || active?.declinedForRecipient);
  const isRequestRecipient = isPendingRecipient || isDeclinedRecipient;
  const isPendingSender = !isPendingRecipient && (thread?.conversation?.status === 'pending' || active?.status === 'pending');
  const isDeclinedSender = !isRequestRecipient && (thread?.conversation?.status === 'declined' || active?.status === 'declined');
  const deleted = profile.deleted === true;

  return <div className="dm-center" ref={rootRef}>
    <button type="button" className="dm-center-trigger" aria-label="Direct message inbox" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 4.5h15l2 10.5v4.5h-19V15l2-10.5Z"/><path d="M3 15h5l1.5 2h5l1.5-2h5"/></svg>
      {pendingCount > 0 && <span>{pendingCount > 9 ? '9+' : pendingCount}</span>}
    </button>

    {open && <section className="dm-center-panel" aria-label="Direct message inbox">
      <header><div><small>Private conversations</small><h3>Messages</h3></div><button type="button" onClick={loadConversations}>Refresh</button></header>
      {conversations.length ? <div className="dm-center-list">
        {conversations.map((conversation) => {
          const member = conversation.otherProfile || {};
          return <button type="button" key={conversation.id} className={conversation.pendingForRecipient ? 'is-request' : ''} onClick={() => chooseConversation(conversation)}>
            <span className={`dm-center-avatar${member.avatarUrl ? ' has-image' : ''}`}>{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : <GenericAvatar />}</span>
            <span className="dm-center-preview"><b>{member.displayName || 'Deleted account'} <IdentityBadges compact verified={member.verifiedDebater} premium={member.premium} role={member.role} /></b><em>{conversation.pendingForRecipient ? 'New message request' : conversation.declinedForRecipient ? 'Declined request · Accept anytime' : 'Open conversation to view messages'}</em></span>
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
      {isRequestRecipient ? <div className="dm-center-request">
        <small>{isDeclinedRecipient ? 'Declined message request' : 'Message request'}</small><h3>{isDeclinedRecipient ? `Accept DMs from ${profile.displayName || 'this user'} later?` : `Accept DMs from ${profile.displayName || 'this user'}?`}</h3><p>{isDeclinedRecipient ? 'This request remains here in case you decide to accept it later.' : 'The first message is hidden until you approve this conversation.'}</p>
        {error && <p className="dm-center-error">{error}</p>}
        <div>{!isDeclinedRecipient && <button type="button" onClick={() => decide('decline')} disabled={busy}>Decline</button>}<button type="button" className="is-accept" onClick={() => decide('accept')} disabled={busy}>{busy ? 'Updating…' : 'Accept DMs'}</button></div>
      </div> : <>
        <div className="public-profile-message-list" ref={listRef}>
          {loading ? <p className="public-profile-message-empty">Loading conversation…</p> : (thread?.messages || []).length ? thread.messages.map((message) => <article key={message.id} className={message.senderUid === myUid ? 'is-mine' : ''}><p>{message.text}</p><time>{displayTime(message.createdAtMs)}</time></article>) : <p className="public-profile-message-empty">No messages yet.</p>}
        </div>
        <form onSubmit={send}>
          {isPendingSender && <p className="dm-center-notice">Waiting for {profile.displayName || 'this member'} to accept your message request.</p>}
          {isDeclinedSender && <p className="dm-center-notice">This member declined your request. They can still accept it later.</p>}
          {deleted && <p className="dm-center-notice">This account was deleted. Existing messages remain available, but new messages cannot be sent.</p>}
          {error && <p className="dm-center-error">{error}</p>}
          <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} placeholder="Write a private message…" disabled={busy || isPendingSender || isDeclinedSender || deleted} />
          <div><small>{text.length}/1000</small><button type="submit" disabled={busy || isPendingSender || isDeclinedSender || deleted || !text.trim()}>{busy ? 'Sending…' : 'Send message'}</button></div>
        </form>
      </>}
    </section>}
  </div>;
}

