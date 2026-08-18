import { useEffect, useState } from 'react';
import AudioLevelMeter from './AudioLevelMeter.jsx';
import DebateChatPanel from './DebateChatPanel.jsx';
import ReportIssue from './ReportIssue.jsx';
import { auth } from './firebase.js';
import GenericAvatar from './GenericAvatar.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import DirectMessageCenter from './DirectMessageCenter.jsx';
import './debateRatingCapture.js';

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

function LineIcon({ type }) {
  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    user: <><circle cx="12" cy="7" r="4" /><path d="M4 21c0-6 3-9 8-9s8 3 8 9H4Z" /></>,
    exit: <><path d="M14 8V4H4v16h10v-4M10 12h11M17 8l4 4-4 4" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    micOff: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16" /></>,
    camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    cameraOff: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3M4 4l16 16" /></>,
    flag: <><path d="M5 21V4M5 5h11l-2 4 2 4H5" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

function ConnectionBars({ connState, connectionText }) {
  return <span className={`live-video-connection conn-${connState}`} title={connectionText} aria-label={connectionText}>
    <i /><i /><i /><i />
  </span>;
}

function LeaveDebateModal({ onCancel, onConfirm }) {
  return (
    <div className="leave-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
      <div className="leave-confirm-card">
        <div className="leave-confirm-icon"><LineIcon type="exit" /></div>
        <h2 id="leave-confirm-title">Are you sure you want to leave this debate?</h2>
        <div className="leave-confirm-actions">
          <button type="button" className="leave-confirm-cancel" onClick={onCancel}>Keep Debating</button>
          <button type="button" className="leave-confirm-leave" onClick={onConfirm}><LineIcon type="exit" />End Debate</button>
        </div>
      </div>
    </div>
  );
}

export default function DebateRoomPage({ debateInfo, topic, opponentName = 'Opponent', opponentRole = 'user', opponentVerified = false, opponentPremium = false, isSearching = false, hostQueueCount = null, connState, connectionText, localVideoRef, remoteVideoRef, localStream, micOn, camOn, onToggleMic, onToggleCam, onReport, onLeave, onMenu, onProfile, onSignOut, messages, draft, onDraftChange, onSend, socket, socketId, reportOpen, onCloseReport, onReportSubmitted, kickOpponent, canKick }) {
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [opponentRating, setOpponentRating] = useState(null);
  const side = debateInfo.matchMode === 'custom' ? (debateInfo.yourSide === 'agree' ? 'Creator' : 'Challenger') : (debateInfo.yourSide === 'agree' ? 'Agree' : 'Disagree');

  useEffect(() => {
    let cancelled = false;
    const peerUid = debateInfo?.peerUid;
    if (typeof window !== 'undefined' && peerUid && debateInfo?.roomId) {
      // Keep the real roomId for the debate itself, but give each completed review
      // a unique rating key so a second review can never overwrite the first one.
      const ratingReviewId = `${debateInfo.roomId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage?.setItem(
        'hottake:ratingContext',
        JSON.stringify({ peerUid, roomId: ratingReviewId })
      );
    }
    setOpponentRating(null);
    if (!peerUid) return () => { cancelled = true; };
    fetchLiveRatingSummary(peerUid).then((summary) => {
      if (!cancelled) setOpponentRating(summary.average);
    }).catch((error) => {
      console.warn('[hot-take] opponent rating load failed', error);
      if (!cancelled) setOpponentRating(null);
    });
    return () => {
      cancelled = true;
    };
  }, [debateInfo?.peerUid, debateInfo?.roomId]);

  const confirmLeave = () => {
    setLeaveConfirmOpen(false);
    const nativeConfirm = window.confirm;
    window.confirm = () => true;
    try {
      onLeave();
    } finally {
      window.confirm = nativeConfirm;
    }
  };

  return <div className="live-room">
    <header className="live-room-header"><img src="/hottake-logo-horizontal.png" alt="Hot Take" /><nav><DirectMessageCenter socket={socket} /><button onClick={onMenu}><LineIcon type="menu" />Menu</button><button onClick={onProfile}><LineIcon type="user" />Profile</button><button onClick={onSignOut}><LineIcon type="exit" />Sign out</button><span className={`live-connection conn-${connState}`}><i />{connectionText}</span></nav></header>
    <div className="live-topic"><p><strong>TOPIC:</strong> {topic} <span>&bull;</span> <em>You:</em> <b>{side}</b></p><div className={`live-topic-statuses ${hostQueueCount != null ? 'has-queue-count' : ''}`}>{hostQueueCount != null && <span className={`live-queue-count ${hostQueueCount > 0 ? 'has-waiters' : ''}`} aria-live="polite"><i aria-hidden="true" />{hostQueueCount} {hostQueueCount === 1 ? 'user' : 'users'} in queue</span>}<div className={`live-opponent-name ${isSearching ? 'live-opponent-name--searching' : ''}`} role="status" aria-live="polite" aria-label={isSearching ? 'Finding you a match' : `Debating: ${opponentName}`}>
      {isSearching ? <><span className="live-search-mini" aria-hidden="true"><i /><i /><i /></span><span>Finding you a match<strong>...</strong></span></> : <><span className={'live-opponent-avatar' + (debateInfo.peerAvatarUrl ? ' has-image' : '')}>{debateInfo.peerAvatarUrl ? <img src={debateInfo.peerAvatarUrl} alt="" /> : <GenericAvatar />}</span><span>Debating: <strong>{opponentName}</strong><IdentityBadges compact premium={opponentPremium} verified={opponentVerified} role={opponentRole} />{opponentRating != null && <span className="live-opponent-rating">★ {opponentRating.toFixed(2)}</span>}</span></>}
    </div></div></div>
    <main className="live-layout"><section className="live-stage"><div className="live-videos">
      <div className="live-video">
        <video ref={localVideoRef} autoPlay playsInline muted />
        {!micOn && <div className="local-mic-muted-reminder" role="status" aria-live="polite"><LineIcon type="micOff" /><span>Your mic is muted</span></div>}
        <span className="live-video-label"><span>You</span><ConnectionBars connState={connState} connectionText={connectionText} /><AudioLevelMeter stream={localStream} compact muted={!micOn} /></span>
      </div>
      <div className={`live-video ${isSearching ? 'live-video--searching' : ''}`}><video ref={remoteVideoRef} autoPlay playsInline />{isSearching && <div className="live-searching-overlay" role="status" aria-live="polite"><div className="live-search-orb" aria-hidden="true"><span /><i /><i /><i /></div><h2>Finding you a match<span>...</span></h2><p>Your public room is live. We’ll bring your challenger in as soon as someone joins.</p></div>}<span className="live-video-label"><span>{isSearching ? 'Searching' : 'Opponent'}</span>{isSearching ? <span className="live-search-label-dots" aria-hidden="true"><i /><i /><i /></span> : <ConnectionBars connState={connState} connectionText={connectionText} />}</span></div>
    </div><div className="live-controls"><button onClick={onToggleMic}><LineIcon type={micOn ? 'mic' : 'micOff'} />{micOn ? 'Mute mic' : 'Unmute mic'}</button><button onClick={onToggleCam}><LineIcon type={camOn ? 'camera' : 'cameraOff'} />{camOn ? 'Camera off' : 'Camera on'}</button><button onClick={onReport}><LineIcon type="flag" />Report issue</button>{canKick && <button onClick={kickOpponent}>Kick opponent</button>}<button className="live-leave" onClick={() => setLeaveConfirmOpen(true)}><LineIcon type="exit" />Leave debate</button></div></section>
      <DebateChatPanel messages={messages} draft={draft} onDraftChange={onDraftChange} onSend={onSend} disabled={!debateInfo.roomId} mySocketId={socketId} />
    </main>
    <ReportIssue open={reportOpen} onClose={onCloseReport} topicId={debateInfo.topicId} roomId={debateInfo.roomId} yourSide={debateInfo.yourSide} peerUid={debateInfo.peerUid ?? null} matchMode={debateInfo.matchMode ?? null} onSubmitted={onReportSubmitted} />
    {leaveConfirmOpen && <LeaveDebateModal onCancel={() => setLeaveConfirmOpen(false)} onConfirm={confirmLeave} />}
  </div>;
}

