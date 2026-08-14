import { useState } from 'react';
import AudioLevelMeter from './AudioLevelMeter.jsx';
import DebateChatPanel from './DebateChatPanel.jsx';
import ReportIssue from './ReportIssue.jsx';

function LineIcon({ type }) {
  const paths = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    user: <><circle cx="12" cy="7" r="4" /><path d="M4 21c0-6 3-9 8-9s8 3 8 9H4Z" /></>,
    exit: <><path d="M14 8V4H4v16h10v-4M10 12h11M17 8l4 4-4 4" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    camera: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    flag: <><path d="M5 21V4M5 5h11l-2 4 2 4H5" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
}

function ConnectionBars({ connState, connectionText }) {
  return <span className={`live-video-connection conn-${connState}`} title={connectionText} aria-label={connectionText}>
    <i /><i /><i /><i />
  </span>;
}

function LeaveDebateModal({ micOn, camOn, onCancel, onConfirm }) {
  return (
    <div className="leave-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
      <div className="leave-confirm-card">
        <div className="leave-confirm-icon"><LineIcon type="exit" /></div>
        <h2 id="leave-confirm-title">End this debate?</h2>
        <p>Are you sure you want to end this debate?</p>
        <div className="leave-confirm-statuses" aria-label="Current debate controls">
          <span><LineIcon type="mic" />{micOn ? 'Mic on' : 'Mic muted'}</span>
          <span><LineIcon type="camera" />{camOn ? 'Camera on' : 'Camera off'}</span>
          <span className="leave-confirm-status--danger"><LineIcon type="exit" />Leave debate</span>
        </div>
        <div className="leave-confirm-actions">
          <button type="button" className="leave-confirm-cancel" onClick={onCancel}>Keep debating</button>
          <button type="button" className="leave-confirm-leave" onClick={onConfirm}><LineIcon type="exit" />Leave debate</button>
        </div>
      </div>
    </div>
  );
}

export default function DebateRoomPage({ debateInfo, topic, opponentName = 'Opponent', connState, connectionText, localVideoRef, remoteVideoRef, localStream, micOn, camOn, onToggleMic, onToggleCam, onReport, onLeave, onMenu, onProfile, onSignOut, messages, draft, onDraftChange, onSend, socketId, reportOpen, onCloseReport, kickOpponent, canKick }) {
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const side = debateInfo.matchMode === 'custom' ? (debateInfo.yourSide === 'agree' ? 'Creator' : 'Challenger') : (debateInfo.yourSide === 'agree' ? 'Agree' : 'Disagree');

  const confirmLeave = () => {
    setLeaveConfirmOpen(false);
    // App's existing end handler is also used by non-button navigation. The modal owns
    // confirmation here, so bypass the legacy browser confirm for this single invocation.
    const nativeConfirm = window.confirm;
    window.confirm = () => true;
    try {
      onLeave();
    } finally {
      window.confirm = nativeConfirm;
    }
  };

  return <div className="live-room">
    <header className="live-room-header"><img src="/hottake-logo-horizontal.png" alt="Hot Take" /><nav><button onClick={onMenu}><LineIcon type="menu" />Menu</button><button onClick={onProfile}><LineIcon type="user" />Profile</button><button onClick={onSignOut}><LineIcon type="exit" />Sign out</button><span className={`live-connection conn-${connState}`}><i />{connectionText}</span></nav></header>
    <div className="live-topic"><p><strong>TOPIC:</strong> {topic} <span>&bull;</span> <em>You:</em> <b>{side}</b></p><div className="live-opponent-name" aria-label={`Debating against ${opponentName}`}>Debating against: <strong>{opponentName}</strong></div></div>
    <main className="live-layout"><section className="live-stage"><div className="live-videos">
      <div className="live-video"><video ref={localVideoRef} autoPlay playsInline muted /><span className="live-video-label"><span>You</span><ConnectionBars connState={connState} connectionText={connectionText} /><AudioLevelMeter stream={localStream} compact muted={!micOn} /></span></div>
      <div className="live-video"><video ref={remoteVideoRef} autoPlay playsInline /><span className="live-video-label"><span>Opponent</span><ConnectionBars connState={connState} connectionText={connectionText} /></span></div>
    </div><div className="live-controls"><button onClick={onToggleMic}><LineIcon type="mic" />{micOn ? 'Mute mic' : 'Unmute mic'}</button><button onClick={onToggleCam}><LineIcon type="camera" />{camOn ? 'Camera off' : 'Camera on'}</button><button onClick={onReport}><LineIcon type="flag" />Report issue</button>{canKick && <button onClick={kickOpponent}>Kick opponent</button>}<button className="live-leave" onClick={() => setLeaveConfirmOpen(true)}><LineIcon type="exit" />Leave debate</button></div></section>
      <DebateChatPanel messages={messages} draft={draft} onDraftChange={onDraftChange} onSend={onSend} disabled={!debateInfo.roomId} mySocketId={socketId} />
    </main>
    <ReportIssue open={reportOpen} onClose={onCloseReport} topicId={debateInfo.topicId} roomId={debateInfo.roomId} yourSide={debateInfo.yourSide} peerUid={debateInfo.peerUid ?? null} matchMode={debateInfo.matchMode ?? null} />
    {leaveConfirmOpen && <LeaveDebateModal micOn={micOn} camOn={camOn} onCancel={() => setLeaveConfirmOpen(false)} onConfirm={confirmLeave} />}
  </div>;
}
