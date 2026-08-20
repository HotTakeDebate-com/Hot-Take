import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { TOPICS } from './topics.js';
import DebateHistory from './DebateHistory.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import SocialFeed from './SocialFeed.jsx';
import UserSearchPanel from './UserSearchPanel.jsx';
import { fetchPublicProfile, fetchRecentDebates, syncUserPresence } from './chitChatFirestore.js';
import ReportIssue from './ReportIssue.jsx';
import { GoogleAuthProvider, onIdTokenChanged, reauthenticateWithPopup, reload, signOut } from 'firebase/auth';
import AuthScreen from './AuthScreen.jsx';
import BrandLogo from './BrandLogo.jsx';
import HeaderNavMenu from './HeaderNavMenu.jsx';
import LegalViewer from './legal/LegalViewer.jsx';
import MissionPage from './MissionPage.jsx';
import SupportPage from './SupportPage.jsx';
import FaqPage from './FaqPage.jsx';
import WhatsHotPage from './WhatsHotPage.jsx';
import { auth, isFirebaseConfigured } from './firebase.js';
import AudioLevelMeter from './AudioLevelMeter.jsx';
import DeviceSettings from './DeviceSettings.jsx';
import DebateChatPanel from './DebateChatPanel.jsx';
import { getMediaErrorMessage, getUserMediaWithFallback, getUserMediaWithRecovery } from './mediaUtils.js';
import HomePage from './HomePage.jsx';
import QuickMatchPage from './QuickMatchPage.jsx';
import WarningNotice from './WarningNotice.jsx';
import DebateRoomPage from './DebateRoomPage.jsx';
import StaffPanel from './StaffPanel.jsx';
import { SiteFooter, SiteHeader } from './SiteChrome.jsx';
import { staffMe } from './staffApi.js';
import VerificationApplicationPage from './VerificationApplicationPage.jsx';
import IdentityBadges from './IdentityBadges.jsx';
import NotificationCenter from './NotificationCenter.jsx';
import DirectMessageCenter from './DirectMessageCenter.jsx';
import MemberSearchCenter from './MemberSearchCenter.jsx';
import GenericAvatar from './GenericAvatar.jsx';
import FollowingPage from './FollowingPage.jsx';
import { sendHotTakeEmailVerification } from './firebaseEmailVerification.js';
import './App.css';
import './HomePage.css';
import './QuickMatchPage.css';
import './SiteChrome.css';
import './DebateRoomPage.css';

const FALLBACK_RTC = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/** Attach local mic/camera tracks; recvonly transceivers when a device has no camera or mic. */
function addLocalTracksToPeerConnection(pc, stream) {
  const hasVideo = stream.getVideoTracks().length > 0;
  const hasAudio = stream.getAudioTracks().length > 0;
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  if (!hasVideo) {
    pc.addTransceiver('video', { direction: 'recvonly' });
  }
  if (!hasAudio) {
    pc.addTransceiver('audio', { direction: 'recvonly' });
  }
}

function connectionLabel(state) {
  if (!state) return '';
  const map = {
    new: 'Starting…',
    connecting: 'Connecting…',
    connected: 'Connected',
    disconnected: 'Disconnected',
    failed: 'Connection failed',
    closed: 'Ended',
  };
  return map[state] ?? state;
}

function topicLabel(id) {
  return TOPICS.find((t) => t.id === id)?.label ?? id;
}

function signedInDisplayName() {
  return (
    auth.currentUser?.displayName?.trim().slice(0, 100) ||
    'Hot Take member'
  );
}

const LEGAL_OVERLAY_IDS = new Set(['terms', 'privacy', 'community', 'recording']);

function formatSocketConnectError(err) {
  const raw = String(err?.message ?? '');
  const msg = raw.toLowerCase();
  if (
    msg.includes('missing firebase') ||
    msg.includes('invalid firebase') ||
    msg.includes('auth token') ||
    msg.includes('could not verify')
  ) {
    return 'Your session could not be verified. Refresh the page and sign in again.';
  }
  if (msg.includes('admin not configured')) {
    return 'The server could not verify sign-in. Try again in a moment or contact support.';
  }
  return raw ? `Realtime connection failed (${raw}). Please refresh and try again.` : 'Realtime connection failed. Please refresh and try again.';
}

export default function App() {
  const [step, setStep] = useState('welcome');
  const [matchMode, setMatchMode] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [side, setSide] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [debateInfo, setDebateInfo] = useState(null);
  const [error, setError] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connState, setConnState] = useState(null);
  const [firebaseUserId, setFirebaseUserId] = useState(null);
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState('');
  const [staffRole, setStaffRole] = useState(null);
  /** Must be true to use the app, Socket.IO, and Firestore (email/password users verify via link). */
  const [authReady, setAuthReady] = useState(false);
  const [videoDeviceId, setVideoDeviceId] = useState('');
  const [audioDeviceId, setAudioDeviceId] = useState('');
  /** Same tracks as localStreamRef — kept in state for `<AudioLevelMeter />`. */
  const [localStream, setLocalStream] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [customStatement, setCustomStatement] = useState('');
  const [customSearch, setCustomSearch] = useState('');
  const [customGames, setCustomGames] = useState([]);
  const [customTab, setCustomTab] = useState('join');
  const [customJoinMode, setCustomJoinMode] = useState('open');
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [customHostWaiting, setCustomHostWaiting] = useState(false);
  const [customQueuePosition, setCustomQueuePosition] = useState(null);
  const [customHostQueueCount, setCustomHostQueueCount] = useState(0);
  /** Socket.IO id for labeling own chat messages. */
  const [socketId, setSocketId] = useState(null);
  /** In-debate text chat (cleared when match ends or opponent leaves). */
  const [debateChatMessages, setDebateChatMessages] = useState([]);
  const [debateChatDraft, setDebateChatDraft] = useState('');
  /** Full-screen overlay from header menu: legal doc id, mission, or support. */
  const [headerOverlay, setHeaderOverlay] = useState(null);
  /** Social: view someone else's profile (null = own profile on profile step). */
  const [socialProfileEmail, setSocialProfileEmail] = useState(null);
  /** Where ProfilePanel "Back" returns: welcome, feed, or search. */
  const [socialReturnStep, setSocialReturnStep] = useState('welcome');
  /** Guest auth overlay: signin or signup modal. */
  const [authModal, setAuthModal] = useState(null);
  const [debateRatingOpen, setDebateRatingOpen] = useState(false);
  const [debateRating, setDebateRating] = useState(0);
  const [verificationPromptOpen, setVerificationPromptOpen] = useState(false);
  const [verificationPromptBusy, setVerificationPromptBusy] = useState(false);
  const [verificationPromptMessage, setVerificationPromptMessage] = useState('');
  const [verificationPromptError, setVerificationPromptError] = useState('');

  const isSignedIn = Boolean(firebaseUserId);
  const showHeaderSocialTabs =
    isSignedIn && ['welcome', 'feed', 'following', 'profile', 'search', 'history', 'admin', 'verification'].includes(step);

  const openAuth = useCallback((mode = 'signin') => {
    setAuthModal(mode === 'signup' ? 'signup' : 'signin');
    setError(null);
  }, []);

  const requireAuth = useCallback(
    (mode = 'signin') => {
      if (firebaseUserId) return true;
      openAuth(mode);
      return false;
    },
    [firebaseUserId, openAuth]
  );

  const requireVerifiedEmail = useCallback(() => {
    if (!requireAuth('signin')) return false;
    if (auth?.currentUser?.emailVerified === true) return true;
    setVerificationPromptMessage('');
    setVerificationPromptError('');
    setVerificationPromptOpen(true);
    return false;
  }, [requireAuth]);

  const sendVerificationFromPrompt = useCallback(async () => {
    const user = auth?.currentUser;
    if (!user) return;
    setVerificationPromptBusy(true);
    setVerificationPromptMessage('');
    setVerificationPromptError('');
    try {
      await sendHotTakeEmailVerification(user);
      setVerificationPromptMessage(`Verification email sent to ${user.email || 'your inbox'}.`);
    } catch (verificationError) {
      setVerificationPromptError(verificationError?.code === 'auth/too-many-requests' ? 'Too many emails were sent. Wait a few minutes and try again.' : 'Could not send the verification email. Please try again.');
    } finally {
      setVerificationPromptBusy(false);
    }
  }, []);

  const checkVerificationFromPrompt = useCallback(async () => {
    const user = auth?.currentUser;
    if (!user) return;
    setVerificationPromptBusy(true);
    setVerificationPromptMessage('');
    setVerificationPromptError('');
    try {
      await reload(user);
      await user.getIdToken(true);
      if (!auth.currentUser?.emailVerified) {
        setVerificationPromptError('Your email is still unverified. Open the link in your inbox, then check again.');
        return;
      }
      setVerificationPromptOpen(false);
      setVerificationPromptMessage('');
    } catch {
      setVerificationPromptError('Could not refresh your verification status. Try again.');
    } finally {
      setVerificationPromptBusy(false);
    }
  }, []);

  const openFollowing = useCallback(() => {
    if (!requireAuth('signin')) return;
    setHeaderOverlay(null);
    setStep('following');
  }, [requireAuth]);

  useEffect(() => {
    if (!firebaseUserId || !auth?.currentUser?.email) {
      setHeaderAvatarUrl('');
      return undefined;
    }
    let active = true;
    const loadAvatar = async () => {
      try {
        const profile = await fetchPublicProfile(auth.currentUser.email);
        // Only use avatars explicitly saved to the Hot Take profile. OAuth provider
        // photos (for example a private Gmail profile picture) must never become a
        // public Hot Take avatar implicitly.
        if (active) setHeaderAvatarUrl(profile?.avatarUrl || '');
      } catch {
        if (active) setHeaderAvatarUrl('');
      }
    };
    const onProfileUpdated = (event) => {
      setHeaderAvatarUrl(event?.detail?.avatarUrl || '');
    };
    loadAvatar();
    window.addEventListener('hot-take-profile-updated', onProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener('hot-take-profile-updated', onProfileUpdated);
    };
  }, [firebaseUserId]);

  const rtcConfigRef = useRef(FALLBACK_RTC);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const roomIdRef = useRef(null);
  const pendingSignalsRef = useRef([]);
  const spectatorPeerConnectionsRef = useRef(new Map());
  /** Set when a debate session successfully starts (after mic/cam acquired). */
  const debateSessionRef = useRef(null);
  const matchModeRef = useRef(null);
  const sideRef = useRef(null);
  /** True while effect cleanup is disconnecting the socket (ignore disconnect UI). */
  const socketDisconnectIntentionalRef = useRef(false);
  const socketEverConnectedRef = useRef(false);
  /** Realtime signaling: Socket.IO connection to the debate server. */
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');

  useEffect(() => {
    matchModeRef.current = matchMode;
    sideRef.current = side;
  }, [matchMode, side]);

  const loadHistory = useCallback(async () => {
    if (!firebaseUserId || !isFirebaseConfigured) {
      setHistoryError('Firebase is not configured or you are not signed in yet.');
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await fetchRecentDebates(40);
      setHistoryRows(rows);
    } catch (e) {
      setHistoryError(e?.message ?? 'Could not load history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [firebaseUserId]);

  const openHistory = () => {
    if (!requireAuth('signin')) return;
    setStep('history');
    loadHistory();
  };

  const flushDebateLog = useCallback(() => {
    // Match history is created once by the server at users/{email}/debates/{roomId}.
    // The client only clears its local session state so it cannot create a duplicate record.
    debateSessionRef.current = null;
  }, []);

  const cleanupMedia = useCallback(() => {
    spectatorPeerConnectionsRef.current.forEach((pc) => pc.close());
    spectatorPeerConnectionsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    roomIdRef.current = null;
    setConnState(null);
    setLocalStream(null);
  }, []);

  const attachRemoteVideo = useCallback(() => {
    const el = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    void el.play?.().catch(() => {});
  }, []);

  const handleRemoteTrack = useCallback(
    (ev) => {
      const track = ev.track;
      if (!track) return;

      let stream = remoteStreamRef.current;
      if (ev.streams?.[0]) {
        stream = ev.streams[0];
      } else {
        if (!stream) stream = new MediaStream();
        if (!stream.getTracks().some((t) => t.id === track.id)) {
          stream.addTrack(track);
        }
      }
      remoteStreamRef.current = stream;
      attachRemoteVideo();
    },
    [attachRemoteVideo]
  );

  useEffect(() => {
    fetch('/api/rtc-config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.iceServers?.length) rtcConfigRef.current = cfg;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthReady(true);
      return;
    }
    const unsub = onIdTokenChanged(auth, (user) => {
      setFirebaseUserId(user?.uid ?? null);
      if (user) {
        if (!user.displayName?.trim()) setAuthModal((current) => current || 'display-name');
        syncUserPresence();
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!firebaseUserId) {
      setStaffRole(null);
      return () => { cancelled = true; };
    }
    staffMe()
      .then((data) => { if (!cancelled) setStaffRole(data.role || null); })
      .catch(() => { if (!cancelled) setStaffRole(null); });
    return () => { cancelled = true; };
  }, [firebaseUserId]);

  useEffect(() => {
    if (!authReady) return;
    if (firebaseUserId) return;
    cleanupMedia();
    setStep('welcome');
    setMatchMode(null);
    setTopicId(null);
    setSide(null);
    setWaiting(false);
    setDebateInfo(null);
    setError(null);
    setConnState(null);
    setSocialProfileEmail(null);
    setSocialReturnStep('welcome');
  }, [authReady, firebaseUserId, cleanupMedia]);

  useEffect(() => {
    if (!authReady || firebaseUserId) return;
    if (step !== 'welcome') {
      setStep('welcome');
      setWaiting(false);
      setMatchMode(null);
      setTopicId(null);
      setSide(null);
      setDebateInfo(null);
      setSocialProfileEmail(null);
    }
  }, [authReady, firebaseUserId, step]);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseUserId) return;

    const user = auth.currentUser;
    if (!user || user.uid !== firebaseUserId) return;

    let cancelled = false;
    socketDisconnectIntentionalRef.current = false;
    socketEverConnectedRef.current = false;
    setRealtimeStatus('connecting');

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      // Fresh token on every connect/reconnect so long-lived tabs stay valid when REQUIRE_FIREBASE_TOKEN is on.
      auth: (cb) => {
        const u = auth.currentUser;
        if (!u || u.uid !== firebaseUserId) {
          cb({});
          return;
        }
        u.getIdToken()
          .then((token) => {
            if (token) cb({ token });
            else cb({});
          })
          .catch(() => {
            cb({});
            if (!cancelled) {
              setError('Could not get sign-in token. Please refresh and try again.');
            }
          });
      },
    });

    socketRef.current = socket;

    const syncSocketId = () => setSocketId(socket.id ?? null);

    socket.on('connect', () => {
      socketEverConnectedRef.current = true;
      if (!cancelled) setRealtimeStatus('connected');
      syncSocketId();
    });
    if (socket.connected) {
      socketEverConnectedRef.current = true;
      setRealtimeStatus('connected');
      syncSocketId();
    }

    socket.on('disconnect', () => {
      if (socketDisconnectIntentionalRef.current || cancelled) return;
      setRealtimeStatus('reconnecting');
    });

    socket.io.on('reconnect_attempt', () => {
      if (!cancelled) setRealtimeStatus('reconnecting');
    });
    socket.io.on('reconnect', () => {
      socketEverConnectedRef.current = true;
      if (!cancelled) setRealtimeStatus('connected');
    });
    socket.io.on('reconnect_failed', () => {
      if (!cancelled) setRealtimeStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      if (!cancelled) {
        setError(formatSocketConnectError(err));
        setRealtimeStatus(
          socketEverConnectedRef.current ? 'reconnecting' : 'disconnected'
        );
      }
    });

    const processSignal = async ({ type, payload }) => {
      const pc = pcRef.current;
      const roomId = roomIdRef.current;
      if (!pc || !roomId) return;

      if (type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { roomId, type: 'answer', payload: answer });
      } else if (type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ice' && payload) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        } catch {
          /* may arrive slightly early; connection often still succeeds */
        }
      }
    };

    const flushPendingSignals = async () => {
      const queued = pendingSignalsRef.current.splice(0);
      for (const sig of queued) {
        await processSignal(sig);
      }
    };

    socket.on('matched', async (payload) => {
      setDebateChatMessages([]);
      setDebateChatDraft('');
      setWaiting(false);
      setError(null);
      setCustomHostWaiting(false);
      setCustomQueuePosition(null);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteStreamRef.current = null;
      roomIdRef.current = payload.roomId;
      setDebateInfo({
        roomId: payload.roomId,
        topicId: payload.topicId ?? (payload.matchMode === 'custom' ? 'custom' : null),
        yourSide: payload.yourSide,
        isOfferer: payload.isOfferer,
        matchMode: payload.matchMode ?? 'quick',
        roomCode: payload.roomCode ?? null,
        statement: payload.statement ?? null,
        peerUid: payload.peerUid ?? null,
        peerDisplayName: payload.peerDisplayName ?? null,
        peerAvatarUrl: payload.peerAvatarUrl ?? '',
        peerRole: payload.peerRole ?? 'user',
        peerVerified: payload.peerVerified === true,
        peerPremium: payload.peerPremium === true,
      });
      setStep('debate');

      try {
        let stream = localStreamRef.current;
        if (!stream) {
          stream = await getUserMediaWithFallback(videoDeviceId, audioDeviceId);
          localStreamRef.current = stream;
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        }

        debateSessionRef.current = {
          topicId: payload.topicId ?? (payload.matchMode === 'custom' ? 'custom' : null),
          yourSide: payload.yourSide,
          roomId: payload.roomId,
          startedAtMs: Date.now(),
          peerUid: payload.peerUid ?? null,
          matchMode: payload.matchMode ?? 'quick',
          roomCode: payload.roomCode ?? null,
          statement: payload.statement ?? null,
        };

        const pc = new RTCPeerConnection(rtcConfigRef.current);
        pcRef.current = pc;
        setConnState(pc.connectionState);

        addLocalTracksToPeerConnection(pc, stream);

        pc.onconnectionstatechange = () => {
          setConnState(pc.connectionState);
        };

        pc.ontrack = handleRemoteTrack;

        pc.onicecandidate = (ev) => {
          if (ev.candidate && roomIdRef.current) {
            socket.emit('signal', {
              roomId: roomIdRef.current,
              type: 'ice',
              payload: ev.candidate.toJSON(),
            });
          }
        };

        await flushPendingSignals();

        if (payload.isOfferer) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('signal', {
            roomId: payload.roomId,
            type: 'offer',
            payload: offer,
          });
        }
      } catch (e) {
        setError(getMediaErrorMessage(e));
        // Do not eject a successfully matched participant into the retired
        // setup flow when camera or microphone access fails.
        setConnState('disconnected');
        setStep('debate');
      }
    });

    socket.on('queued', (payload = {}) => {
      setWaiting(true);
      if (payload.matchMode === 'custom' && payload.roomCode) {
        setCustomRoomCode(payload.roomCode);
      }
      if (!payload.queuedForHost) setCustomQueuePosition(null);
    });

    socket.on('custom-queue-status', ({ roomCode, position, totalWaiting }) => {
      setCustomRoomCode(roomCode || '');
      setCustomQueuePosition({ position: Number(position) || 1, totalWaiting: Number(totalWaiting) || 1 });
      setWaiting(true);
      setError(null);
    });

    socket.on('custom-queue-count', ({ roomCode, queueLength }) => {
      setCustomRoomCode((currentRoomCode) => roomCode || currentRoomCode);
      setCustomHostQueueCount(Math.max(0, Number(queueLength) || 0));
    });

    socket.on('custom-games-updated', (games = []) => {
      setCustomGames(Array.isArray(games) ? games : []);
    });

    socket.on('custom-game-created', ({ roomCode, statement }) => {
      if (roomCode) setCustomRoomCode(roomCode);
      if (statement) setCustomStatement(statement);
      setSide('agree');
      setCustomHostWaiting(true);
      setCustomHostQueueCount(0);
      setError(null);
      setDebateInfo({
        roomId: null,
        topicId: 'custom',
        yourSide: 'agree',
        isOfferer: false,
        matchMode: 'custom',
        roomCode: roomCode ?? null,
        statement: statement ?? null,
      });
      setStep('debate');
      if (!localStreamRef.current) {
        getUserMediaWithFallback(videoDeviceId, audioDeviceId)
          .then((stream) => {
            localStreamRef.current = stream;
            setLocalStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
            debateSessionRef.current = {
              topicId: 'custom',
              yourSide: 'agree',
              roomId: roomCode ?? null,
              startedAtMs: Date.now(),
              peerUid: null,
              matchMode: 'custom',
              roomCode: roomCode ?? null,
              statement: statement ?? null,
            };
          })
          .catch((e) => {
            setError(getMediaErrorMessage(e));
            cleanupMedia();
            setStep('custom');
          });
      }
    });

    socket.on('custom-lobby-waiting', ({ roomCode, statement }) => {
      setDebateChatMessages([]);
      setDebateChatDraft('');
      setCustomHostWaiting(true);
      setDebateInfo((prev) => ({
        roomId: null,
        topicId: 'custom',
        yourSide: 'agree',
        isOfferer: false,
        matchMode: 'custom',
        roomCode: roomCode ?? prev?.roomCode ?? null,
        statement: statement ?? prev?.statement ?? null,
      }));
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      remoteStreamRef.current = null;
      setConnState(null);
      setError('Opponent left. Waiting for next challenger...');
    });

    socket.on('debate-chat', ({ text, from, sentAtMs }) => {
      setDebateChatMessages((prev) => [
        ...prev,
        {
          text,
          from,
          sentAtMs,
          key: `${from}-${sentAtMs}-${prev.length}`,
        },
      ]);
    });

    socket.on('peer-kicked', () => {
      setDebateChatMessages([]);
      setDebateChatDraft('');
      flushDebateLog('peer_kicked');
      setError('You were removed by the lobby creator.');
      cleanupMedia();
      setReportOpen(false);
      setDebateInfo(null);
      setConnState(null);
      setWaiting(false);
      setStep('custom');
      setMatchMode('custom');
      setCustomRoomCode('');
      setCustomHostWaiting(false);
      setCustomTab('join');
      setSide(null);
    });

    socket.on('queue-error', ({ message, code }) => {
      if (code === 'rate_limited') {
        setError(message ?? 'Too many attempts. Please wait and try again.');
      } else if (code === 'already_active') {
        setError(
          message ??
            'You already have an active debate or queue in another tab/window. Go to that tab, click Leave debate or Cancel queue, then try again here.'
        );
      } else if (code === 'auth_required') {
        setError(message ?? 'Could not verify your account. Refresh the page and sign in again.');
      } else if (code === 'email_unverified') {
        setError(null);
        setVerificationPromptMessage('');
        setVerificationPromptError('Verify your email address before starting a debate.');
        setVerificationPromptOpen(true);
      } else {
        setError(message ?? 'Could not join the queue.');
      }
      setWaiting(false);
      setCustomQueuePosition(null);
    });

    socket.on('signal', async ({ type, payload }) => {
      if (!pcRef.current || !roomIdRef.current) {
        pendingSignalsRef.current.push({ type, payload });
        return;
      }
      try {
        await processSignal({ type, payload });
      } catch {
        setError('Connection error. Try again.');
      }
    });

    socket.on('staff-spectator-request', async ({ watcherId, roomId }) => {
      if (roomId !== roomIdRef.current || !localStreamRef.current) return;
      spectatorPeerConnectionsRef.current.get(watcherId)?.close();
      const pc = new RTCPeerConnection(rtcConfigRef.current);
      spectatorPeerConnectionsRef.current.set(watcherId, pc);
      addLocalTracksToPeerConnection(pc, localStreamRef.current);
      pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit('staff-spectator-signal', { watcherId, roomId, type: 'ice', payload: event.candidate.toJSON() });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('staff-spectator-signal', { watcherId, roomId, type: 'offer', payload: offer });
    });

    socket.on('staff-spectator-return-signal', async ({ watcherId, type, payload }) => {
      const pc = spectatorPeerConnectionsRef.current.get(watcherId);
      if (!pc) return;
      if (type === 'answer') await pc.setRemoteDescription(new RTCSessionDescription(payload));
      if (type === 'ice' && payload) await pc.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
    });

    socket.on('staff-spectator-left', ({ watcherId }) => {
      spectatorPeerConnectionsRef.current.get(watcherId)?.close();
      spectatorPeerConnectionsRef.current.delete(watcherId);
    });

    socket.on('peer-left', () => {
      if (matchModeRef.current === 'custom' && sideRef.current === 'agree') {
        setDebateChatMessages([]);
        setDebateChatDraft('');
        setCustomHostWaiting(true);
        setDebateInfo((prev) => (prev ? { ...prev, roomId: null } : prev));
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        remoteStreamRef.current = null;
        setConnState(null);
        setError('Opponent left. Waiting for next challenger...');
        return;
      }
      setDebateChatMessages([]);
      setDebateChatDraft('');
      setDebateRating(0);
      setDebateRatingOpen(true);
      flushDebateLog('peer_left');
      setError('Your opponent left the debate.');
      cleanupMedia();
      setReportOpen(false);
      setDebateInfo(null);
      setConnState(null);
      setStep('welcome');
      setMatchMode(null);
      setTopicId(null);
      setSide(null);
    });

    return () => {
      cancelled = true;
      socketDisconnectIntentionalRef.current = true;
      setSocketId(null);
      setRealtimeStatus('connecting');
      const sock = socketRef.current;
      if (sock) {
        sock.emit('leave-queue');
        cleanupMedia();
        sock.disconnect();
        socketRef.current = null;
      }
    };
    // Socket auth callback fetches a fresh ID token on each connect/reconnect. Effect deps stay on
    // firebaseUserId (not token) so we don’t reconnect every hour; the callback still sends a new token.
  }, [cleanupMedia, flushDebateLog, firebaseUserId, handleRemoteTrack]);

  const pickTopic = (id) => {
    setTopicId(id);
    setStep('side');
  };

  const joinQueue = (s) => {
    if (!requireVerifiedEmail()) return;
    setSide(s);
    setError(null);
    const sock = socketRef.current;
    if (!topicId) return;
    if (!sock) {
      setError('Realtime connection is still starting. Please try again in a second.');
      return;
    }
    if (!sock.connected) sock.connect();
    // Optimistic UI: server will confirm with `queued` or reject with `queue-error`.
    setWaiting(true);
    sock.emit('join-queue', { topicId, side: s, displayName: signedInDisplayName() });
  };

  const cancelWaiting = () => {
    socketRef.current?.emit('leave-queue');
    setWaiting(false);
    setCustomQueuePosition(null);
    setSide(null);
    setStep(matchMode === 'custom' ? 'custom' : 'topic');
  };

  const startQuickMatch = (options = null) => {
    if (!requireVerifiedEmail()) return;
    const preset = options && typeof options === 'object' && typeof options.topicId === 'string' ? options : null;
    setError(null);
    setMatchMode('quick');
    setTopicId(preset && TOPICS.some((topic) => topic.id === preset.topicId) ? preset.topicId : null);
    setSide(preset && ['agree', 'disagree'].includes(preset.side) ? preset.side : null);
    setStep('topic');
  };

  const startCustomMatch = () => {
    if (!requireAuth('signin')) return;
    setError(null);
    setMatchMode('custom');
    setTopicId(null);
    setSide(null);
    setCustomRoomCode('');
    setCustomStatement('');
    setCustomSearch('');
    setCustomTab('join');
    setCustomJoinMode('open');
    setCustomHostWaiting(false);
    setStep('custom');
  };

  const createCustomGame = async () => {
    if (!requireVerifiedEmail()) return;
    const sock = socketRef.current;
    if (!sock) {
      setError('Realtime connection is still starting. Please try again in a second.');
      return;
    }
    const statement = customStatement.trim();
    if (statement.length < 8) {
      setError('Add a statement with at least 8 characters.');
      return;
    }
    setError(null);
    try {
      const currentStream = localStreamRef.current;
      const hasLiveTrack = currentStream?.getTracks().some((track) => track.readyState === 'live');
      if (!hasLiveTrack) {
        currentStream?.getTracks().forEach((track) => track.stop());
        const stream = await getUserMediaWithRecovery(videoDeviceId, audioDeviceId);
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
    } catch (mediaError) {
      setError(getMediaErrorMessage(mediaError));
      return;
    }
    if (!sock.connected) sock.connect();
    // Clear any stale quick/custom queue on the server before creating a lobby
    sock.emit('leave-queue');
    sock.emit('create-custom-game', { statement, joinMode: customJoinMode, displayName: signedInDisplayName() });
  };

  const joinCustomGame = (roomCode) => {
    const sock = socketRef.current;
    if (!sock) {
      setError('Realtime connection is still starting. Please try again in a second.');
      return;
    }
    setCustomRoomCode(roomCode);
    setError(null);
    setSide('disagree');
    if (!sock.connected) sock.connect();
    setWaiting(true);
    sock.emit('join-custom-room', { side: 'disagree', roomCode, displayName: signedInDisplayName() });
  };

  const joinByCode = () => {
    const normalizedRoomCode = customRoomCode.trim().toUpperCase();
    if (!normalizedRoomCode) {
      setError('Enter a room code.');
      return;
    }
    joinCustomGame(normalizedRoomCode);
  };

  const copyRoomCode = async (codeToCopy = customRoomCode) => {
    if (!codeToCopy || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopyConfirmed(true);
      window.setTimeout(() => setCopyConfirmed(false), 1400);
    } catch {
      /* ignore clipboard errors */
    }
    setError(null);
  };

  const sendDebateChat = () => {
    const roomId = debateInfo?.roomId;
    const text = debateChatDraft.trim();
    if (!roomId || !text) return;
    socketRef.current?.emit('debate-chat', { roomId, text });
    setDebateChatDraft('');
  };

  const kickOpponent = () => {
    if (!debateInfo?.roomId) return;
    const ok = window.confirm('Kick this opponent from your lobby? They can rejoin later.');
    if (!ok) return;
    socketRef.current?.emit('kick-peer', { roomId: debateInfo.roomId });
  };

  const handleSignOut = async () => {
    setDebateChatMessages([]);
    setDebateChatDraft('');
    cleanupMedia();
    setDebateInfo(null);
    setStep('welcome');
    setMatchMode(null);
    setCustomHostWaiting(false);
    setTopicId(null);
    setSide(null);
    setError(null);
    setSocialProfileEmail(null);
    setSocialReturnStep('welcome');
    try {
      if (auth) await signOut(auth);
    } catch {
      /* ignore */
    }
  };

  const openAdminPanel = async () => {
    const currentUser = auth?.currentUser;
    if (!staffRole || !currentUser) return;
    const expectedUid = currentUser.uid;
    const expectedEmail = currentUser.email?.trim().toLowerCase() || '';
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account', login_hint: currentUser.email || '' });
    try {
      const hasGoogleProvider = currentUser.providerData.some((entry) => entry.providerId === 'google.com');
      if (!hasGoogleProvider) throw new Error('This staff account must be linked to Google before it can access the Admin panel.');
      const result = await reauthenticateWithPopup(currentUser, provider);
      const verifiedEmail = result.user.email?.trim().toLowerCase() || '';
      if (result.user.uid !== expectedUid || (expectedEmail && verifiedEmail !== expectedEmail)) {
        throw new Error('The Google account must match your signed-in staff account.');
      }
      setError(null);
      setHeaderOverlay(null);
      setSocialProfileEmail(null);
      setStep('admin');
    } catch (adminAuthError) {
      if (adminAuthError?.code === 'auth/popup-closed-by-user' || adminAuthError?.code === 'auth/cancelled-popup-request') return;
      const message = adminAuthError?.message || 'Google verification is required to access the Admin panel.';
      setError(message);
      window.alert(message);
    }
  };

  const endDebate = () => {
    setDebateChatMessages([]);
    setDebateChatDraft('');
    setDebateRating(0);
    setDebateRatingOpen(true);
    flushDebateLog('leave');
    socketRef.current?.emit('leave-debate');
    cleanupMedia();
    setReportOpen(false);
    setDebateInfo(null);
    setStep('welcome');
    setMatchMode(null);
    setCustomHostWaiting(false);
    setTopicId(null);
    setSide(null);
    setError(null);
  };

  const requestEndDebate = () => {
    if (!window.confirm('Are you sure you want to end this debate?')) return;
    endDebate();
  };

  /** Header brand: return to welcome and leave queues / debates safely. */
  const goHome = () => {
    setHeaderOverlay(null);
    setSocialProfileEmail(null);
    setSocialReturnStep('welcome');
    setReportOpen(false);
    if (step === 'debate') {
      endDebate();
      return;
    }
    socketRef.current?.emit('leave-queue');
    setWaiting(false);
    setDebateChatMessages([]);
    setDebateChatDraft('');
    setMatchMode(null);
    setCustomHostWaiting(false);
    setTopicId(null);
    setSide(null);
    setCustomRoomCode('');
    setCustomStatement('');
    setCustomTab('join');
    setCopyConfirmed(false);
    setError(null);
    setDebateInfo(null);
    setConnState(null);
    setStep('welcome');
  };

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
  }, [micOn]);

  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = camOn;
    });
  }, [camOn]);

  useEffect(() => {
    if (step === 'debate') attachRemoteVideo();
  }, [step, debateInfo?.roomId, attachRemoteVideo]);

  useEffect(() => {
    if (step !== 'debate' || !localVideoRef.current || !localStreamRef.current) return;
    if (localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    void localVideoRef.current.play?.().catch(() => {});
  }, [step, debateInfo?.roomId, localStream]);

  const showAppShell = authReady && isFirebaseConfigured;

  if (typeof window !== 'undefined') {
    window.__hotTakeAdminAction = staffRole ? openAdminPanel : null;
    window.__hotTakeHeaderAvatarUrl = headerAvatarUrl;
    window.__hotTakeNetworkSocket = socketRef.current;
    window.__hotTakeOpenVerification = isSignedIn ? (() => { setHeaderOverlay(null); setStep('verification'); }) : null;
    window.__hotTakeJoinNetworkRoom = isSignedIn ? ((roomCode) => { setStep('custom'); setCustomTab('join'); joinCustomGame(roomCode); }) : null;
    window.__hotTakeOpenMemberProfile = isSignedIn ? ((uid) => { setHeaderOverlay(null); setSocialProfileEmail(uid === firebaseUserId ? null : `uid:${uid}`); setSocialReturnStep(step === 'profile' ? 'welcome' : step); setStep('profile'); }) : null;
    window.__hotTakeOpenFollowing = isSignedIn ? openFollowing : null;
  }

  return (
    <>
      {showAppShell && step !== 'welcome' && step !== 'topic' && step !== 'debate' && step !== 'following' && step !== 'profile' && step !== 'admin' && step !== 'custom' && step !== 'verification' && (
        <div className="app-top-bar">
          <header className="app-header">
            <div className="app-header-row">
              <div className="header-left-actions">
                <a
                  href="/"
                  className="header-home-brand"
                  onClick={(e) => {
                    e.preventDefault();
                    goHome();
                  }}
                >
                  HotTakeDebate.com
                </a>
              </div>
              <div className="app-header-main">
                <BrandLogo className="brand-logo--header" />
                <p className="app-tagline">
                  {isSignedIn
                    ? 'Live video debates: pick a side, get matched, argue face to face. Use Account in the corner when you want to manage settings off the debate floor.'
                    : 'Browse topics and see how Hot Take works. Sign in to join live video debates.'}
                </p>
              </div>
              <div className="header-actions">
                {showHeaderSocialTabs && (
                  <nav className="header-social-tabs" aria-label="Profile">
                    <button
                      type="button"
                      className={`header-chip header-social-tab ${step === 'following' ? 'header-social-tab--active' : ''}`}
                      onClick={openFollowing}
                    >
                      Following
                    </button>
                    <button
                      type="button"
                      className={`header-chip header-social-tab ${step === 'profile' && socialProfileEmail == null ? 'header-social-tab--active' : ''}`}
                      onClick={() => {
                        if (!requireAuth('signin')) return;
                        setSocialProfileEmail(null);
                        setSocialReturnStep('welcome');
                        setStep('profile');
                      }}
                    >
                      Account
                    </button>
                    {staffRole && (
                      <button
                        type="button"
                        className={`header-chip header-social-tab header-admin-link ${step === 'admin' ? 'header-social-tab--active' : ''}`}
                        onClick={openAdminPanel}
                      >
                        Admin
                      </button>
                    )}
                  </nav>
                )}
                <HeaderNavMenu
                  onPickLegal={(id) => setHeaderOverlay(id)}
                  onPickMission={() => setHeaderOverlay('mission')}
                  onPickFaq={() => setHeaderOverlay('faq')}
                  onPickSupport={() => setHeaderOverlay('support')}
                />
                {isSignedIn ? (
                  <button type="button" className="btn btn-ghost header-chip header-sign-out" onClick={handleSignOut}>
                    Sign out
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn btn-ghost header-chip" onClick={() => openAuth('signin')}>
                      Sign in
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary header-chip header-chip--cta"
                      onClick={() => openAuth('signup')}
                    >
                      Create account
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>
        </div>
      )}

      <div
        className={[
          'app',
          showAppShell && step !== 'welcome' && 'app--with-global-header',
          step === 'welcome' && 'app--landing',
          step === 'topic' && 'app--quick-match',
          step === 'debate' && 'app--debate-room',
          step === 'following' && 'app--following',
          step === 'profile' && 'app--account',
          step === 'admin' && 'app--admin',
          step === 'verification' && 'app--verification',
          step === 'custom' && 'app--custom-rooms',
          !isSignedIn && showAppShell && step !== 'welcome' && 'app--guest',
        ]
          .filter(Boolean)
          .join(' ')}
      >
      {!authReady && (
        <div className="panel auth-initializing">
          <p className="auth-initializing-text">Loading…</p>
        </div>
      )}

      {authReady && !isFirebaseConfigured && (
        <div className="panel">
          <h2 className="auth-title">Firebase setup required</h2>
          <p className="auth-lead">
            Add your <code>VITE_FIREBASE_*</code> keys to <code>.env</code> (see{' '}
            <code>.env.example</code>), then restart the dev server.
          </p>
        </div>
      )}

      {showAppShell && (
        <>
      {step !== 'welcome' &&
        step !== 'topic' &&
        step !== 'debate' &&
        step !== 'history' &&
        step !== 'feed' &&
        step !== 'following' &&
        step !== 'profile' &&
        step !== 'search' &&
        step !== 'admin' &&
        step !== 'verification' &&
        step !== 'custom' && (
        <details className="device-details" open>
          <summary className="device-details-summary">
            Camera &amp; microphone
            <span className="device-details-summary-hint"> — for Quick match &amp; custom debates</span>
          </summary>
          <div className="panel device-details-panel">
            <DeviceSettings
              videoDeviceId={videoDeviceId}
              audioDeviceId={audioDeviceId}
              onVideoDeviceChange={setVideoDeviceId}
              onAudioDeviceChange={setAudioDeviceId}
            />
          </div>
        </details>
      )}

      {step === 'welcome' && (
        <HomePage
          isSignedIn={isSignedIn}
          onSignIn={() => openAuth('signin')}
          onSignUp={() => openAuth('signup')}
          onSignOut={handleSignOut}
          onQuickMatch={startQuickMatch}
          onCustomRoom={startCustomMatch}
          onPickLegal={(id) => setHeaderOverlay(id)}
          onPickMission={() => setHeaderOverlay('mission')}
          onPickSupport={() => setHeaderOverlay('faq')}
          onPickHelp={() => setHeaderOverlay('support')}
          onPickWhatsHot={() => setHeaderOverlay('whats-hot')}
          onPickFollowing={openFollowing}
          onProfile={() => {
            if (!requireAuth('signin')) return;
            setSocialProfileEmail(null);
            setSocialReturnStep('welcome');
            setStep('profile');
          }}
          onOpenProfile={(uid) => {
            setSocialProfileEmail(uid === firebaseUserId ? null : `uid:${uid}`);
            setSocialReturnStep('welcome');
            setStep('profile');
          }}
          brandExtras={
            staffRole ? (
              <button type="button" className="landing-admin-link" onClick={openAdminPanel}>
                Admin
              </button>
            ) : null
          }
        />
      )}

      {isSignedIn && step === 'admin' && staffRole && (
        <StaffPanel
          role={staffRole}
          socket={socketRef.current}
          rtcConfig={rtcConfigRef.current}
          onBack={() => setStep('welcome')}
          onAbout={() => setHeaderOverlay('mission')}
          onFaq={() => setHeaderOverlay('faq')}
          onSupport={() => setHeaderOverlay('support')}
          onAccount={() => setStep('profile')}
          onSignOut={handleSignOut}
          onPickLegal={(id) => setHeaderOverlay(id)}
        />
      )}

      {isSignedIn && step === 'verification' && <VerificationApplicationPage
        onHome={goHome}
        onBack={goHome}
        onAbout={() => setHeaderOverlay('mission')}
        onQuickMatch={startQuickMatch}
        onWhatsHot={() => setHeaderOverlay('whats-hot')}
        onFaq={() => setHeaderOverlay('faq')}
        onSupport={() => setHeaderOverlay('support')}
        onProfile={() => setStep('profile')}
        onSignOut={handleSignOut}
        onPickLegal={(id) => setHeaderOverlay(id)}
      />}

      {isSignedIn && step === 'feed' && (
        <SocialFeed
          onBack={() => setStep('welcome')}
          onOpenProfile={(profileId) => {
            setSocialProfileEmail(profileId);
            setSocialReturnStep('feed');
            setStep('profile');
          }}
        />
      )}

      {isSignedIn && step === 'following' && (
        <FollowingPage
          onHome={goHome}
          onAbout={() => setHeaderOverlay('mission')}
          onQuickMatch={startQuickMatch}
          onWhatsHot={() => setHeaderOverlay('whats-hot')}
          onFaq={() => setHeaderOverlay('faq')}
          onSupport={() => setHeaderOverlay('support')}
          onProfile={() => { setSocialProfileEmail(null); setSocialReturnStep('following'); setStep('profile'); }}
          onSignOut={handleSignOut}
          onPickLegal={(id) => setHeaderOverlay(id)}
          onOpenProfile={(uid) => { setSocialProfileEmail(`uid:${uid}`); setSocialReturnStep('following'); setStep('profile'); }}
          brandExtras={
            staffRole ? (
              <button type="button" className="landing-admin-link" onClick={openAdminPanel}>
                Admin
              </button>
            ) : null
          }
        />
      )}

      {isSignedIn && step === 'profile' && (
        <ProfilePanel
          targetEmail={socialProfileEmail}
          hostedRoom={socialProfileEmail?.startsWith('uid:')
            ? customGames.find((game) => game.creatorUid === socialProfileEmail.slice(4)) || null
            : null}
          canJoinHostedRoom={!socialProfileEmail?.startsWith('uid:') || socialProfileEmail.slice(4) !== firebaseUserId}
          onJoinHostedRoom={(roomCode) => joinCustomGame(roomCode)}
          onBack={() => {
            setStep(socialReturnStep);
            setSocialProfileEmail(null);
          }}
          onHome={goHome}
          onAbout={() => setHeaderOverlay('mission')}
          onQuickMatch={startQuickMatch}
          onFaq={() => setHeaderOverlay('faq')}
          onSupport={() => setHeaderOverlay('support')}
          onSignOut={handleSignOut}
          onPickLegal={(id) => setHeaderOverlay(id)}
          onDeleted={goHome}
          onOpenProfile={(uid) => {
            setSocialProfileEmail(`uid:${uid}`);
            setSocialReturnStep('profile');
            setStep('profile');
          }}
        />
      )}

      {isSignedIn && step === 'search' && (
        <UserSearchPanel
          onBack={() => setStep('welcome')}
          onOpenProfile={(email) => {
            setSocialProfileEmail(email);
            setSocialReturnStep('search');
            setStep('profile');
          }}
        />
      )}

      {isSignedIn && step === 'custom' && (
        <div className="custom-room-page">
        <SiteHeader
          onHome={goHome}
          onAbout={() => setHeaderOverlay('mission')}
          onTopics={startQuickMatch}
          onFaq={() => setHeaderOverlay('faq')}
          onSupport={() => setHeaderOverlay('support')}
          isSignedIn
          onSignOut={handleSignOut}
          onProfile={() => { setSocialProfileEmail(null); setSocialReturnStep('custom'); setStep('profile'); }}
          onPickLegal={(id) => setHeaderOverlay(id)}
        />
        <main className={`custom-browser custom-browser-v2 ${waiting && side === 'disagree' ? 'custom-browser--queue' : ''}`}>
          {waiting && side === 'disagree' ? (
            <section className="custom-challenger-queue" aria-live="polite">
              <div className="custom-challenger-queue__eyebrow"><i /> LIVE WAITING ROOM</div>
              <div className="custom-challenger-queue__orb" aria-hidden="true">
                <span />
                <b>{customQueuePosition ? `#${customQueuePosition.position}` : '…'}</b>
              </div>
              <p className="custom-challenger-queue__label">YOUR POSITION</p>
              <h1>{customQueuePosition ? `You’re #${customQueuePosition.position} in line.` : 'Joining the queue…'}</h1>
              <p className="custom-challenger-queue__message">
                {customQueuePosition
                  ? customQueuePosition.position === 1
                    ? 'You’re next. Keep this page open and you’ll enter the debate automatically.'
                    : `${customQueuePosition.position - 1} ${customQueuePosition.position === 2 ? 'person is' : 'people are'} ahead of you. You’ll enter automatically when it’s your turn.`
                  : 'Confirming your place in the host’s waiting line.'}
              </p>
              {customQueuePosition && (
                <div className="custom-challenger-queue__total">
                  <span>{customQueuePosition.totalWaiting}</span>
                  {customQueuePosition.totalWaiting === 1 ? 'challenger waiting' : 'challengers waiting'}
                </div>
              )}
              <div className="custom-challenger-queue__progress" aria-hidden="true"><i /><i /><i /></div>
              <button type="button" className="custom-challenger-queue__cancel" onClick={cancelWaiting}>
                Leave queue
              </button>
            </section>
          ) : <>
          <header className="custom-browser-hero">
            <button type="button" className="custom-browser-back" onClick={() => setStep('welcome')} aria-label="Back">←</button>
            <div><p>CHOOSE THE CONVERSATION</p><h1>Debate rooms<span>.</span></h1><small>Publish a take and defend it, or step into an open challenge.</small></div>
            <div className="custom-browser-live"><i />LIVE ROOMS</div>
          </header>
          <div className="custom-browser-tabs" role="tablist" aria-label="Custom debate modes">
            <button
              type="button"
              className={`custom-tab ${customTab === 'join' ? 'custom-tab--active' : ''}`}
              role="tab"
              aria-selected={customTab === 'join'}
              onClick={() => setCustomTab('join')}
            >
              <span>01</span> Find a debate
            </button>
            <button
              type="button"
              className={`custom-tab ${customTab === 'create' ? 'custom-tab--active' : ''}`}
              role="tab"
              aria-selected={customTab === 'create'}
              onClick={() => setCustomTab('create')}
            >
              <span>02</span> Create a room
            </button>
          </div>

          {error && step === 'custom' && (
            <div className="error-banner custom-browser-error" role="alert">
              {error}
            </div>
          )}

          {customTab === 'create' && (
            <div className="custom-tab-panel">
              <div className="custom-create-heading"><p>BUILD YOUR ROOM</p><h2>What&apos;s your hot take?</h2><span>You&apos;ll argue in favor. The person joining will take the opposing side.</span></div>
              <label className="custom-statement-field" htmlFor="statementInput">
                <span>Debate statement</span>
                <textarea
                  id="statementInput"
                  placeholder="Example: Social media does more harm than good."
                  value={customStatement}
                  onChange={(e) => setCustomStatement(e.target.value)}
                  maxLength={240}
                  autoComplete="off"
                />
                <i>{customStatement.trim().length}/240</i>
              </label>
              <div className="custom-access-section"><span className="custom-field-label">Who can join?</span><div className="custom-access-grid">
                <button
                  type="button"
                  className={customJoinMode === 'open' ? 'selected' : ''}
                  onClick={() => setCustomJoinMode('open')}><b>Public room</b><small>Visible to everyone browsing open debates.</small><i>{customJoinMode === 'open' ? '✓' : ''}</i></button>
                <button type="button" className={customJoinMode === 'code' ? 'selected' : ''} onClick={() => setCustomJoinMode('code')}><b>Private room</b><small>Hidden from the list. Invite someone with a code.</small><i>{customJoinMode === 'code' ? '✓' : ''}</i></button>
              </div></div>
              <p className="custom-statement-hint" aria-live="polite">
                {customStatement.trim().length < 8 ? (
                  <>
                    <strong>
                      {customStatement.trim().length}/8
                    </strong>{' '}
                    characters — add a few more to publish.
                  </>
                ) : (
                  <span className="custom-statement-ready">
                    Ready to publish ({customStatement.trim().length} characters)
                  </span>
                )}
              </p>
              <button type="button" className="custom-publish-button" onClick={createCustomGame} disabled={customStatement.trim().length < 8}><span>Publish room</span><b>→</b></button>
            </div>
          )}

          {customTab === 'join' && (
            <div className="custom-tab-panel">
              <div className="custom-create-heading"><p>OPEN CHALLENGES</p><h2>Find your opposition.</h2><span>Browse public rooms or enter a private invitation code.</span></div>
              <div className="custom-code-join">
                <input
                  id="roomCodeInput"
                  type="text"
                  className="auth-input custom-room-code"
                  placeholder="ENTER ROOM CODE"
                  value={customRoomCode}
                  onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                  maxLength={24}
                />
                <button type="button" onClick={joinByCode}>
                  Join private room →
                </button>
              </div>
              <div className="custom-room-filter">
                <input
                  id="customSearchInput"
                  type="text"
                  className="auth-input custom-search"
                  placeholder="Search open debate statements…"
                  value={customSearch}
                  onChange={(e) => setCustomSearch(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="custom-table-wrap" role="region" aria-label="Custom room list">
                <table className="custom-table">
                  <thead className="custom-table-head">
                    <tr>
                      <th>Creator</th>
                      <th>Statement</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {customGames
                      .filter((g) => {
                        const query = customSearch.trim().toLowerCase();
                        if (!query) return true;
                        return (
                          g.creatorDisplayName?.toLowerCase().includes(query) ||
                          g.statement?.toLowerCase().includes(query)
                        );
                      })
                      .map((g) => (
                        <tr key={g.roomCode}>
                          <td className="custom-room-creator">
                            <button
                              type="button"
                              className="custom-room-host-link"
                              disabled={!g.creatorUid}
                              aria-label={`View ${g.creatorDisplayName || 'host'}'s profile`}
                              onClick={() => {
                                if (!g.creatorUid) return;
                                setSocialProfileEmail(`uid:${g.creatorUid}`);
                                setSocialReturnStep('custom');
                                setStep('profile');
                              }}
                            >
                            <span className={`custom-room-creator-avatar${g.creatorAvatarUrl ? ' has-image' : ''}`}>
                              {g.creatorAvatarUrl
                                ? <img src={g.creatorAvatarUrl} alt="" />
                                : <span aria-hidden="true">{(g.creatorDisplayName || 'H').trim().charAt(0).toUpperCase()}</span>}
                            </span>
                            <span className="custom-room-creator-copy">
                              <small>Hosted by</small>
                              <span className="custom-room-host-name">
                                <strong>{g.creatorDisplayName || 'Hot Take member'}</strong>
                                <IdentityBadges compact premium={g.creatorPremium} verified={g.creatorVerified} role={g.creatorRole} />
                              </span>
                            </span>
                            </button>
                          </td>
                          <td>{g.statement}</td>
                          <td><span className={`custom-waiting-status ${g.active ? 'is-live' : ''}`}><i />{g.active ? `Live · ${g.queueLength || 0} queued` : 'Waiting'}</span></td>
                          <td>
                            <button
                              type="button"
                              className="custom-join-btn"
                              onClick={() => joinCustomGame(g.roomCode)}
                            >
                              {g.active ? 'Join queue →' : 'Take the opposing side →'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    {customGames.filter((g) => {
                      const query = customSearch.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        g.creatorDisplayName?.toLowerCase().includes(query) ||
                        g.statement?.toLowerCase().includes(query)
                      );
                    }).length === 0 && (
                      <tr>
                        <td colSpan={4} className="custom-empty-row">
                          No open servers right now. Create one or use Join by code.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!!customRoomCode && side === 'agree' && (
            <p className="mode-help-text">
              Current room code: <strong>{customRoomCode}</strong>{' '}
              <button type="button" className="auth-legal-link copy-code-btn" onClick={copyRoomCode}>
                {copyConfirmed ? '✓ Copied' : 'Copy'}
              </button>
            </p>
          )}
          {waiting && (
            <div className={`waiting custom-queue-waiting ${customQueuePosition ? 'has-position' : ''}`} style={{ marginTop: '1.5rem' }}>
              <div className="spinner" aria-hidden />
              {customQueuePosition && <div className="custom-queue-position"><small>You are in line</small><strong>#{customQueuePosition.position}</strong><span>{customQueuePosition.position === 1 ? 'You are next to debate the host.' : `${customQueuePosition.position - 1} ${customQueuePosition.position === 2 ? 'person' : 'people'} ahead of you.`}</span></div>}
              <p>
                {side === 'agree'
                  ? 'Your custom game is live. Waiting for someone who disagrees to join…'
                  : customQueuePosition ? 'Keep this page open. You will enter automatically when it is your turn.' : 'Joining debate…'}
              </p>
              <button type="button" className="back-btn" onClick={cancelWaiting}>
                Cancel
              </button>
            </div>
          )}
          {!waiting && (
            <button type="button" className="back-btn" onClick={() => setStep('welcome')}>
              Back
            </button>
          )}
          </>}
        </main>
        <SiteFooter onHome={goHome} onAbout={() => setHeaderOverlay('mission')} onFaq={() => setHeaderOverlay('faq')} onSupport={() => setHeaderOverlay('support')} onPickLegal={(id) => setHeaderOverlay(id)} />
        </div>
      )}

      {isSignedIn && step === 'history' && (
        <DebateHistory
          rows={historyRows}
          loading={historyLoading}
          error={historyError}
          onBack={() => setStep('welcome')}
          onRefresh={loadHistory}
        />
      )}

      {isSignedIn && step === 'topic' && (
        <QuickMatchPage
          topics={TOPICS}
          selectedTopicId={topicId}
          selectedSide={side}
          waiting={waiting}
          error={error}
          onSelectTopic={(id) => { setTopicId(id); setSide(null); setError(null); }}
          onSelectSide={setSide}
          onFindMatch={joinQueue}
          onCancel={cancelWaiting}
          onBack={goHome}
          onSignOut={handleSignOut}
          onProfile={() => { setSocialProfileEmail(null); setSocialReturnStep('topic'); setStep('profile'); }}
          onAbout={() => setHeaderOverlay('mission')}
          onSupport={() => setHeaderOverlay('faq')}
          onHelp={() => setHeaderOverlay('support')}
          onPickLegal={(id) => setHeaderOverlay(id)}
        />
      )}

      {isSignedIn && step === 'side' && topicId && (
        <div className="panel">
          <h2>{topicLabel(topicId)}</h2>
          <p style={{ color: 'var(--muted)', marginTop: '-0.5rem' }}>
            Do you agree or disagree with the statement?
          </p>
          <div className="side-row">
            <button type="button" className="side-btn agree" onClick={() => joinQueue('agree')}>
              Agree
            </button>
            <button type="button" className="side-btn disagree" onClick={() => joinQueue('disagree')}>
              Disagree
            </button>
          </div>
          {waiting && (
            <div className="waiting" style={{ marginTop: '1.5rem' }}>
              <div className="spinner" aria-hidden />
              <p>Looking for someone on the other side…</p>
              <button type="button" className="back-btn" onClick={cancelWaiting}>
                Cancel
              </button>
            </div>
          )}
          {error && step === 'side' && <div className="error-banner">{error}</div>}
          {!waiting && (
            <button
              type="button"
              className="back-btn"
              onClick={() => setStep('topic')}
            >
              Back to topics
            </button>
          )}
        </div>
      )}

      {isSignedIn && step === 'debate' && debateInfo && <DebateRoomPage debateInfo={debateInfo} topic={debateInfo.matchMode === 'custom' ? debateInfo.statement ?? 'Custom debate' : topicLabel(debateInfo.topicId)} opponentName={debateInfo.peerDisplayName ?? 'Opponent'} opponentRole={debateInfo.peerRole} opponentVerified={debateInfo.peerVerified} opponentPremium={debateInfo.peerPremium} isSearching={customHostWaiting && debateInfo.matchMode === 'custom'} hostQueueCount={debateInfo.matchMode === 'custom' && debateInfo.yourSide === 'agree' ? customHostQueueCount : null} connState={connState} connectionText={connectionLabel(connState)} localVideoRef={localVideoRef} remoteVideoRef={remoteVideoRef} localStream={localStream} micOn={micOn} camOn={camOn} onToggleMic={() => setMicOn((m) => !m)} onToggleCam={() => setCamOn((c) => !c)} onReport={() => setReportOpen(true)} onLeave={requestEndDebate} onMenu={() => setHeaderOverlay('support')} onProfile={() => setStep('profile')} onSignOut={handleSignOut} messages={debateChatMessages} draft={debateChatDraft} onDraftChange={setDebateChatDraft} onSend={sendDebateChat} socket={socketRef.current} socketId={socketId} reportOpen={reportOpen} onCloseReport={() => setReportOpen(false)} onReportSubmitted={(reportId) => socketRef.current?.emit('mark-debate-reported', { roomId: debateInfo.roomId, reportId })} kickOpponent={kickOpponent} canKick={debateInfo.matchMode === 'custom' && debateInfo.yourSide === 'agree' && !customHostWaiting && !!debateInfo.roomId} />}

      {false && isSignedIn && step === 'debate' && debateInfo && (
        <div className="panel">
          <div className="debate-header">
            <div className="debate-meta">
              {debateInfo.matchMode === 'custom' ? (
                <>
                  Statement: <strong>{debateInfo.statement ?? 'Custom debate'}</strong>
                  {' · '}
                  You:{' '}
                  <strong>{debateInfo.yourSide === 'agree' ? 'Creator' : 'Challenger'}</strong>
                </>
              ) : (
                <>
                  Topic: <strong>{topicLabel(debateInfo.topicId)}</strong>
                  {' · '}
                  You:{' '}
                  <strong>{debateInfo.yourSide === 'agree' ? 'Agree' : 'Disagree'}</strong>
                </>
              )}
              {debateInfo.matchMode === 'custom' && debateInfo.roomCode ? (
                <>
                  {' · '}
                  Room: <strong>{debateInfo.roomCode}</strong>{' '}
                  <button
                    type="button"
                    className="auth-legal-link copy-code-btn"
                    onClick={() => copyRoomCode(debateInfo.roomCode)}
                  >
                    {copyConfirmed ? '✓ Copied' : 'Copy'}
                  </button>
                </>
              ) : null}
            </div>
            {connState && (
              <span
                className={`conn-pill conn-${connState}`}
                title="WebRTC connection state"
              >
                {connectionLabel(connState)}
              </span>
            )}
          </div>
          <div
            className={
              debateInfo.roomId ? 'debate-main debate-main--with-chat' : 'debate-main'
            }
          >
            <div className="video-grid">
              <div className="video-wrap">
                <video ref={localVideoRef} autoPlay playsInline muted />
                <div className="video-local-overlay">
                  <AudioLevelMeter stream={localStream} compact muted={!micOn} />
                </div>
                <span className="video-label">You</span>
              </div>
              <div className="video-wrap">
                <video ref={remoteVideoRef} autoPlay playsInline />
                <span className="video-label">Opponent</span>
              </div>
            </div>
            {debateInfo.roomId && (
              <DebateChatPanel
                messages={debateChatMessages}
                draft={debateChatDraft}
                onDraftChange={setDebateChatDraft}
                onSend={sendDebateChat}
                disabled={!debateInfo.roomId}
                mySocketId={socketId}
              />
            )}
          </div>
          {error && <div className="error-banner">{error}</div>}
          {connState === 'failed' && !error && (
            <p className="rtc-hint">
              If this keeps happening, add a TURN server via{' '}
              <code>ICE_SERVERS_JSON</code> on the server (see <code>.env.example</code>).
            </p>
          )}
          {customHostWaiting && debateInfo.matchMode === 'custom' && (
            <p className="mode-help-text">Lobby is open. Waiting for someone to join your debate…</p>
          )}
          {debateInfo.matchMode === 'custom' && (
            <p className="lobby-status">
              Lobby:{' '}
              <span className={`lobby-status-pill ${customHostWaiting ? 'waiting' : 'active'}`}>
                {customHostWaiting ? 'Waiting' : 'In debate'}
              </span>
            </p>
          )}
          <div className="debate-actions">
            <button type="button" className="btn" onClick={() => setMicOn((m) => !m)}>
              {micOn ? 'Mute mic' : 'Unmute mic'}
            </button>
            <button type="button" className="btn" onClick={() => setCamOn((c) => !c)}>
              {camOn ? 'Camera off' : 'Camera on'}
            </button>
            {debateInfo.matchMode === 'custom' &&
              debateInfo.yourSide === 'agree' &&
              !customHostWaiting &&
              !!debateInfo.roomId && (
                <button type="button" className="btn" onClick={kickOpponent}>
                  Kick opponent
                </button>
              )}
            <button type="button" className="btn" onClick={() => setReportOpen(true)}>
              Report issue
            </button>
            <button type="button" className="btn btn-danger" onClick={endDebate}>
              Leave debate
            </button>
          </div>
          <ReportIssue
            open={reportOpen}
            onClose={() => setReportOpen(false)}
            topicId={debateInfo.topicId}
            roomId={debateInfo.roomId}
            yourSide={debateInfo.yourSide}
            peerUid={debateInfo.peerUid ?? null}
            matchMode={debateInfo.matchMode ?? null}
          />
        </div>
      )}

        </>
      )}
      </div>

      {debateRatingOpen && (
        <div className="debate-rating-backdrop" role="dialog" aria-modal="true" aria-labelledby="debate-rating-title">
          <div className="debate-rating-card">
            <h2 id="debate-rating-title">Rate your debate</h2>
            <p>How was your debate experience?</p>
            <div className="debate-rating-stars" role="radiogroup" aria-label="Rate this debate from 1 to 5 stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={star <= debateRating ? 'debate-rating-star debate-rating-star--active' : 'debate-rating-star'}
                  aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  aria-pressed={star === debateRating}
                  onClick={() => setDebateRating(star)}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              type="button"
              className="debate-rating-submit"
              disabled={!debateRating}
              onClick={() => setDebateRatingOpen(false)}
            >
              Submit rating
            </button>
          </div>
        </div>
      )}

      <WarningNotice />

      {authModal && (
        <AuthScreen
          variant="modal"
          initialMode={authModal}
          onClose={() => setAuthModal(null)}
          onAuthenticated={() => setAuthModal(null)}
        />
      )}

      {verificationPromptOpen && <div className="email-verification-gate" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVerificationPromptOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="email-verification-gate-title">
          <button type="button" className="email-verification-gate-close" onClick={() => setVerificationPromptOpen(false)} aria-label="Close verification prompt">×</button>
          <div className="email-verification-gate-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6.5 12 13l9-6.5"/><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m9.5 16 1.6 1.6 3.5-4"/></svg></div>
          <p>EMAIL VERIFICATION REQUIRED</p>
          <h2 id="email-verification-gate-title">Verify before you debate<span>.</span></h2>
          <p className="email-verification-gate-copy">Quick Match and room creation are available only to members with a verified email address. We’ll send a secure link to <strong>{auth?.currentUser?.email || 'your inbox'}</strong>.</p>
          {verificationPromptMessage && <div className="email-verification-gate-message success" role="status">{verificationPromptMessage}</div>}
          {verificationPromptError && <div className="email-verification-gate-message error" role="alert">{verificationPromptError}</div>}
          <div className="email-verification-gate-actions">
            <button type="button" className="primary" onClick={sendVerificationFromPrompt} disabled={verificationPromptBusy}>{verificationPromptBusy ? 'Please wait…' : 'Send verification email'}</button>
            <button type="button" onClick={checkVerificationFromPrompt} disabled={verificationPromptBusy}>I’ve verified — check again</button>
          </div>
          <small>You’ll be able to start searching or publish a room as soon as verification is confirmed.</small>
        </section>
      </div>}

      {showAppShell && LEGAL_OVERLAY_IDS.has(headerOverlay) && (
        <LegalViewer documentId={headerOverlay} onBack={() => setHeaderOverlay(null)} />
      )}
      {showAppShell && headerOverlay === 'mission' && (
        <MissionPage onBack={() => setHeaderOverlay(null)} isSignedIn={isSignedIn} onSignIn={() => openAuth('signin')} onSignUp={() => openAuth('signup')} onSignOut={handleSignOut} onProfile={() => { setHeaderOverlay(null); setSocialProfileEmail(null); setSocialReturnStep('welcome'); setStep('profile'); }} onPickLegal={(id) => setHeaderOverlay(id)} onPickSupport={() => setHeaderOverlay('faq')} />
      )}
      {showAppShell && headerOverlay === 'support' && (
        <SupportPage onBack={() => setHeaderOverlay(null)} isSignedIn={isSignedIn} onSignIn={() => openAuth('signin')} onSignUp={() => openAuth('signup')} onSignOut={handleSignOut} onProfile={() => { setHeaderOverlay(null); setSocialProfileEmail(null); setSocialReturnStep('welcome'); setStep('profile'); }} onPickLegal={(id) => setHeaderOverlay(id)} onPickMission={() => setHeaderOverlay('mission')} onPickFaq={() => setHeaderOverlay('faq')} />
      )}
      {showAppShell && headerOverlay === 'faq' && (
        <FaqPage onBack={() => setHeaderOverlay(null)} onSupport={() => setHeaderOverlay('support')} isSignedIn={isSignedIn} onSignIn={() => openAuth('signin')} onSignUp={() => openAuth('signup')} onSignOut={handleSignOut} onProfile={() => { setHeaderOverlay(null); setSocialProfileEmail(null); setSocialReturnStep('welcome'); setStep('profile'); }} onPickLegal={(id) => setHeaderOverlay(id)} onPickMission={() => setHeaderOverlay('mission')} />
      )}
      {showAppShell && headerOverlay === 'whats-hot' && (
        <WhatsHotPage
          onBack={() => setHeaderOverlay(null)}
          isSignedIn={isSignedIn}
          onSignIn={() => openAuth('signin')}
          onSignUp={() => openAuth('signup')}
          onSignOut={handleSignOut}
          onProfile={() => { setHeaderOverlay(null); setSocialProfileEmail(null); setSocialReturnStep('welcome'); setStep('profile'); }}
          onPickLegal={(id) => setHeaderOverlay(id)}
          onPickMission={() => setHeaderOverlay('mission')}
          onPickFaq={() => setHeaderOverlay('faq')}
          onPickSupport={() => setHeaderOverlay('support')}
          onQuickMatch={startQuickMatch}
          brandExtras={
            staffRole ? (
              <button type="button" className="landing-admin-link" onClick={openAdminPanel}>
                Admin
              </button>
            ) : null
          }
        />
      )}
    </>
  );
}

