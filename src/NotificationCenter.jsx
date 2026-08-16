import { useCallback, useEffect, useRef, useState } from 'react';
import { networkDecideDirectMessage, networkNotifications, networkReadNotification } from './networkApi.js';
import GenericAvatar from './GenericAvatar.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import './DebateNetwork.css';

export default function NotificationCenter({ socket, onJoinRoom }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dmRequest, setDmRequest] = useState(null);
  const [dmBusy, setDmBusy] = useState(false);
  const rootRef = useRef(null);
  const unread = items.filter((item) => !item.read).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const notifications = (await networkNotifications()).notifications || [];
      setItems(notifications);
      setDmRequest((current) => current || notifications.find((item) => item.type === 'dm_request' && !item.read) || null);
    }
    catch { /* Header notifications stay non-blocking. */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    const receive = (notification) => {
      setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)]);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notice = new Notification(`${notification.hostDisplayName} is ready to debate`, { body: notification.statement || 'A public debate room is open.' });
        notice.onclick = () => { window.focus(); setOpen(true); };
      }
    };
    socket.on('network-notification', receive);
    const receiveDmRequest = (request) => {
      const item = { ...request, id: request.id || request.conversationId, type: 'dm_request', read: false };
      setItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      setDmRequest(item);
    };
    socket.on('dm-request', receiveDmRequest);
    return () => { socket.off('network-notification', receive); socket.off('dm-request', receiveDmRequest); };
  }, [socket]);
  useEffect(() => {
    const close = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = async (item) => {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
    void networkReadNotification(item.id).catch(() => {});
    setOpen(false);
    if (item.type === 'room_live' && item.roomCode) onJoinRoom?.(item.roomCode);
    if (item.type === 'dm_request' && item.fromUid) setDmRequest(item);
  };

  const decideDmRequest = async (decision) => {
    if (!dmRequest?.fromUid) return;
    setDmBusy(true);
    try {
      await networkDecideDirectMessage(dmRequest.fromUid, decision);
      setItems((current) => current.filter((item) => item.id !== dmRequest.id));
      setDmRequest(null);
    } finally {
      setDmBusy(false);
    }
  };

  return <div className="network-notifications" ref={rootRef}>
    <button type="button" className="network-bell" aria-label={`${unread} unread notifications`} onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <section className="network-notification-panel">
      <header><div><small>Debate network</small><h3>Notifications</h3></div><button type="button" onClick={load}>Refresh</button></header>
      {loading && !items.length ? <p className="network-empty">Loading…</p> : items.length ? <div className="network-notification-list">
        {items.map((item) => <button type="button" key={item.id} className={`network-notification-item${item.read ? '' : ' is-unread'}`} onClick={() => select(item)}>
          <span className={`network-notification-avatar${item.hostAvatarUrl ? ' has-image' : ''}`}>{item.hostAvatarUrl ? <img src={item.hostAvatarUrl} alt="" /> : <GenericAvatar />}</span>
          <span><b>{item.hostDisplayName || 'A debater'} <IdentityBadges compact verified={item.hostVerified} role={item.hostRole} /></b><em>{item.type === 'dm_request' ? 'wants to send you a direct message' : 'created a public debate room'}</em><small>{item.type === 'dm_request' ? 'Message contents are hidden until accepted.' : item.statement}</small></span>
        </button>)}
      </div> : <p className="network-empty">Follow debaters to be notified when they open a public room.</p>}
      {typeof Notification !== 'undefined' && Notification.permission === 'default' && <button type="button" className="network-browser-alerts" onClick={() => Notification.requestPermission()}>Enable browser alerts</button>}
    </section>}
    {dmRequest && <section className="dm-request-popup" role="dialog" aria-modal="true" aria-label="Direct message request">
      <span className={`network-notification-avatar${dmRequest.hostAvatarUrl ? ' has-image' : ''}`}>{dmRequest.hostAvatarUrl ? <img src={dmRequest.hostAvatarUrl} alt="" /> : <GenericAvatar />}</span>
      <small>Direct message request</small>
      <h3>Accept DMs from {dmRequest.hostDisplayName || 'this user'}?</h3>
      <p>Their first message will remain hidden until you accept.</p>
      <div><button type="button" onClick={() => decideDmRequest('decline')} disabled={dmBusy}>Decline</button><button type="button" className="is-accept" onClick={() => decideDmRequest('accept')} disabled={dmBusy}>{dmBusy ? 'Updating…' : 'Accept DMs'}</button></div>
    </section>}
  </div>;
}

