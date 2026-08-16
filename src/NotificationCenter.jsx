import { useCallback, useEffect, useRef, useState } from 'react';
import { networkNotifications, networkReadNotification } from './networkApi.js';
import GenericAvatar from './GenericAvatar.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import './DebateNetwork.css';

export default function NotificationCenter({ socket, onJoinRoom }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef(null);
  const unread = items.filter((item) => !item.read).length;

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await networkNotifications()).notifications || []); }
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
    return () => socket.off('network-notification', receive);
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
          <span><b>{item.hostDisplayName || 'A debater'} <IdentityBadges compact verified={item.hostVerified} role={item.hostRole} /></b><em>created a public debate room</em><small>{item.statement}</small></span>
        </button>)}
      </div> : <p className="network-empty">Follow debaters to be notified when they open a public room.</p>}
      {typeof Notification !== 'undefined' && Notification.permission === 'default' && <button type="button" className="network-browser-alerts" onClick={() => Notification.requestPermission()}>Enable browser alerts</button>}
    </section>}
  </div>;
}

