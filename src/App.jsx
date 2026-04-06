import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { TOPICS, TOPIC_CATEGORIES } from './topics.js';
import DebateHistory from './DebateHistory.jsx';
import ProfilePanel from './ProfilePanel.jsx';
import SocialFeed from './SocialFeed.jsx';
import UserSearchPanel from './UserSearchPanel.jsx';
import { fetchRecentDebates, logDebateSessionEnd, syncUserPresence } from './chitChatFirestore.js';
import ReportIssue from './ReportIssue.jsx';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import AuthScreen from './AuthScreen.jsx';
import VerifyEmailScreen from './VerifyEmailScreen.jsx';
import BrandLogo from './BrandLogo.jsx';
import HeaderNavMenu from './HeaderNavMenu.jsx';
import LegalViewer from './legal/LegalViewer.jsx';
import MissionPage from './MissionPage.jsx';
import SupportPage from './SupportPage.jsx';
import { auth, isFirebaseConfigured } from './firebase.js';
import AudioLevelMeter from './AudioLevelMeter.jsx';
import DeviceSettings from './DeviceSettings.jsx';
import DebateChatPanel from './DebateChatPanel.jsx';
import { getMediaErrorMessage, getUserMediaWithFallback } from './mediaUtils.js';
import './App.css';

const FALLBACK_RTC = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

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

const LEGAL_OVERLAY_IDS = new Set(['terms', 'privacy', 'community', 'recording']);

function formatSocketConnectError(err) {
  const raw = String(err?.message ?? '');
  const msg = raw.toLowerCase();
  if (msg.includes('verify your email')) {
    return 'Please verify your email (check your inbox), then try again.';
  }
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
  /** Must be true to use the app, Socket.IO, and Firestore (email/password users verify via link). */
  const [firebaseEmailVerified, setFirebaseEmailVerified] = useState(false);
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
  /** Quick match: category picked first; then topics in that category. */
  const [quickCategoryId, setQuickCategoryId] = useState(null);
  const quickCategoryTopics = useMemo(() => {
    if (!quickCategoryId) return [];
    return TOPIC_CATEGORIES.find((c) => c.id === quickCategoryId)?.topics ?? [];
  }, [quickCategoryId]);
  /** Socket.IO id for labeling own chat messages. */
  const [socketId, setSocketId] = useState(null);
  /** In-debate text chat (cleared when match ends or opponent leaves). */
  const [debateChatMessages, setDebateChatMessages] = useState([]);
  const [debateChatDraft, setDebateChatDraft] = useState('');
  /** Full-screen overlay from header menu: legal doc id, mission, or support. */
  const [headerOverlay, setHeaderOverlay] = useState(null);
  /** Local-only avatar preview (optional). Stored in localStorage for convenience. */
  const [headerAvatarDataUrl, setHeaderAvatarDataUrl] = useState(null);
  /** Social: view someone else's profile (null = own profile on profile step). */
  const [socialProfileEmail, setSocialProfileEmail] = useState(null);
  /** Where ProfilePanel "Back" returns: welcome, feed, or search. */
  const [socialReturnStep, setSocialReturnStep] = useState('welcome');

  const showHeaderSocialTabs = ['welcome', 'feed', 'profile', 'search', 'history'].includes(step);

  const rtcConfigRef = useRef(FALLBACK_RTC);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const roomIdRef = useRef(null);
  const pendingSignalsRef = useRef([]);
  /** Set when a debate session successfully starts (after mic/cam acquired). */
  const debateSessionRef = useRef(null);
  const matchModeRef = useRef(null);
  const sideRef = useRef(null);
  const headerAvatarInputRef = useRef(null);
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
    setStep('history');
    loadHistory();
  };

  const flushDebateLog = useCallback((reason) => {
    const s = debateSessionRef.current;
    if (!s) return;
    logDebateSessionEnd({
      topicId: s.topicId,
      yourSide: s.yourSide,
      roomId: s.roomId,
      startedAtMs: s.startedAtMs,
      reason,
      connectionState: pcRef.current?.connectionState ?? null,
      peerUid: s.peerUid ?? null,
      matchMode: s.matchMode ?? null,
      roomCode: s.roomCode ?? null,
      statement: s.statement ?? null,
    });
    debateSessionRef.current = null;
  }, []);

  const cleanupMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    roomIdRef.current = null;
    setConnState(null);
    setLocalStream(null);
  }, []);

  useEffect(() => {
    fetch('/api/rtc-config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg?.iceServers?.length) rtcConfigRef.current = cfg;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      let stored = window.localStorage.getItem('hottake:avatarDataUrl');
      if (!stored) stored = window.localStorage.getItem('chitchat:avatarDataUrl');
      if (stored) setHeaderAvatarDataUrl(stored);
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  const onPickHeaderAvatar = () => {
    headerAvatarInputRef.current?.click();
  };

  const onHeaderAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) return;

    // Keep it lightweight: just store a preview locally for now.
    if (file.size > 2_000_000) {
      setError('Avatar image is too large (max ~2MB). Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!dataUrl) return;
      setHeaderAvatarDataUrl(dataUrl);
      try {
        window.localStorage.setItem('hottake:avatarDataUrl', dataUrl);
        window.localStorage.removeItem('chitchat:avatarDataUrl');
      } catch {
        /* ignore localStorage quota errors */
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthReady(true);
      return;
    }
    const unsub = onIdTokenChanged(auth, (user) => {
      setFirebaseUserId(user?.uid ?? null);
      setFirebaseEmailVerified(Boolean(user?.emailVerified));
      if (user?.emailVerified) syncUserPresence();
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

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
    if (!isFirebaseConfigured || !firebaseUserId || !firebaseEmailVerified) return;

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
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
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

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onconnectionstatechange = () => {
          setConnState(pc.connectionState);
        };

        pc.ontrack = (ev) => {
          if (remoteVideoRef.current && ev.streams[0]) {
            remoteVideoRef.current.srcObject = ev.streams[0];
          }
        };

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
        setDebateChatMessages([]);
        setDebateChatDraft('');
        setError(getMediaErrorMessage(e));
        cleanupMedia();
        setStep('side');
      }
    });

    socket.on('queued', (payload = {}) => {
      setWaiting(true);
      if (payload.matchMode === 'custom' && payload.roomCode) {
        setCustomRoomCode(payload.roomCode);
      }
    });

    socket.on('custom-games-updated', (games = []) => {
      setCustomGames(Array.isArray(games) ? games : []);
    });

    socket.on('custom-game-created', ({ roomCode, statement }) => {
      if (roomCode) setCustomRoomCode(roomCode);
      if (statement) setCustomStatement(statement);
      setSide('agree');
      setCustomHostWaiting(true);
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
      } else {
        setError(message ?? 'Could not join the queue.');
      }
      setWaiting(false);
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
        setConnState(null);
        setError('Opponent left. Waiting for next challenger...');
        return;
      }
      setDebateChatMessages([]);
      setDebateChatDraft('');
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
  }, [cleanupMedia, flushDebateLog, firebaseUserId, firebaseEmailVerified]);

  const pickTopic = (id) => {
    setTopicId(id);
    setStep('side');
  };

  const joinQueue = (s) => {
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
    sock.emit('join-queue', { topicId, side: s });
  };

  const cancelWaiting = () => {
    socketRef.current?.emit('leave-queue');
    setWaiting(false);
    setSide(null);
    if (matchMode === 'quick' && topicId) {
      const cat = TOPIC_CATEGORIES.find((c) => c.topics.some((t) => t.id === topicId));
      setQuickCategoryId(cat?.id ?? null);
    }
    setStep(matchMode === 'custom' ? 'custom' : 'topic');
  };

  const startQuickMatch = () => {
    setError(null);
    setMatchMode('quick');
    setTopicId(null);
    setSide(null);
    setQuickCategoryId(null);
    setStep('topic');
  };

  const startCustomMatch = () => {
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

  const createCustomGame = () => {
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
    if (!sock.connected) sock.connect();
    // Clear any stale quick/custom queue on the server before creating a lobby
    sock.emit('leave-queue');
    sock.emit('create-custom-game', { statement, joinMode: customJoinMode });
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
    sock.emit('join-custom-room', { side: 'disagree', roomCode });
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

  const endDebate = () => {
    setDebateChatMessages([]);
    setDebateChatDraft('');
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

  const showAuthScreen = authReady && isFirebaseConfigured && !firebaseUserId;
  const showVerifyEmail =
    authReady && isFirebaseConfigured && !!firebaseUserId && !firebaseEmailVerified;
  const showMainApp =
    authReady && isFirebaseConfigured && !!firebaseUserId && firebaseEmailVerified;

  return (
    <>
      {showMainApp && (
        <div className="app-top-bar">
          <header className="app-header">
            <div className="app-header-row">
              <div className="header-left-actions">
                <button
                  type="button"
                  className="header-avatar-icon"
                  aria-label="Choose a profile picture"
                  onClick={onPickHeaderAvatar}
                >
                  {headerAvatarDataUrl ? (
                    <img className="header-avatar-icon__img" src={headerAvatarDataUrl} alt="" />
                  ) : (
                    <svg
                      className="header-avatar-icon__svg"
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 7.5C4 6.11929 5.11929 5 6.5 5H17.5C18.8807 5 20 6.11929 20 7.5V16.5C20 17.8807 18.8807 19 17.5 19H6.5C5.11929 19 4 17.8807 4 16.5V7.5Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M8 10.2C9.10457 10.2 10 9.30457 10 8.2C10 7.09543 9.10457 6.2 8 6.2C6.89543 6.2 6 7.09543 6 8.2C6 9.30457 6.89543 10.2 8 10.2Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M4.7 17.4L10.4 12.2C11.0 11.6 11.9 11.6 12.5 12.2L14.7 14.2L17 12.1C17.6 11.5 18.6 11.5 19.2 12.1L20 12.9"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
                <input
                  ref={headerAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="header-avatar-input"
                  onChange={onHeaderAvatarSelected}
                />
              </div>
              <div className="app-header-main">
                <BrandLogo className="brand-logo--header" />
                <p className="app-tagline">
                  Live video debates: pick a side, get matched, argue face to face. Use Feed, Profile, and
                  Search in the corner when you want to connect off the debate floor.
                </p>
              </div>
              <div className="header-actions">
                <span
                  className={`header-rt-status header-rt-status--${realtimeStatus}`}
                  role="status"
                  aria-live="polite"
                  title={
                    realtimeStatus === 'connected'
                      ? 'Connected to debate servers'
                      : realtimeStatus === 'reconnecting'
                        ? 'Reconnecting to debate servers…'
                        : realtimeStatus === 'connecting'
                          ? 'Connecting to debate servers…'
                          : 'Offline — refresh the page if this does not clear'
                  }
                >
                  {realtimeStatus === 'connecting' && 'Connecting…'}
                  {realtimeStatus === 'connected' && 'Live'}
                  {realtimeStatus === 'reconnecting' && 'Reconnecting…'}
                  {realtimeStatus === 'disconnected' && 'Offline'}
                </span>
                {showHeaderSocialTabs && (
                  <nav className="header-social-tabs" aria-label="Feed and profiles">
                    <button
                      type="button"
                      className={`header-social-tab ${step === 'feed' ? 'header-social-tab--active' : ''}`}
                      onClick={() => setStep('feed')}
                    >
                      Feed
                    </button>
                    <button
                      type="button"
                      className={`header-social-tab ${step === 'profile' && socialProfileEmail == null ? 'header-social-tab--active' : ''}`}
                      onClick={() => {
                        setSocialProfileEmail(null);
                        setSocialReturnStep('welcome');
                        setStep('profile');
                      }}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      className={`header-social-tab ${step === 'search' ? 'header-social-tab--active' : ''}`}
                      onClick={() => setStep('search')}
                    >
                      Search
                    </button>
                  </nav>
                )}
                <HeaderNavMenu
                  onPickLegal={(id) => setHeaderOverlay(id)}
                  onPickMission={() => setHeaderOverlay('mission')}
                  onPickSupport={() => setHeaderOverlay('support')}
                />
                <button type="button" className="btn btn-ghost header-sign-out" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </div>
          </header>
        </div>
      )}

      <div
        className={[
          'app',
          showAuthScreen || showVerifyEmail ? 'app--auth-only' : '',
          showMainApp ? 'app--with-global-header' : '',
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

      {showAuthScreen && <AuthScreen />}
      {showVerifyEmail && <VerifyEmailScreen />}

      {showMainApp && (
        <>
      {step !== 'debate' && step !== 'history' && step !== 'feed' && step !== 'profile' && step !== 'search' && (
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
        <div className="panel welcome-actions">
          <p className="welcome-hero-lead">
            Choose a topic or statement, then meet someone on the other side over video. Allow your camera
            and mic above before you join a match.
          </p>

          <section className="welcome-block welcome-block--debate" aria-labelledby="welcome-debate-title">
            <h3 id="welcome-debate-title" className="welcome-block-title">
              Live debates
            </h3>
            <p className="welcome-block-desc">
              Quick match uses curated statements; custom room is your own statement and optional room
              code. In-debate text chat stays available during the call.
            </p>
            <div className="welcome-actions-row welcome-debate-actions">
              <button type="button" className="btn btn-primary" onClick={startQuickMatch}>
                Quick match
              </button>
              <button type="button" className="btn btn-primary" onClick={startCustomMatch}>
                Custom room
              </button>
              <button type="button" className="btn" onClick={openHistory}>
                Past sessions
              </button>
            </div>
          </section>
        </div>
      )}

      {step === 'feed' && (
        <SocialFeed
          onBack={() => setStep('welcome')}
          onOpenProfile={(email) => {
            setSocialProfileEmail(email);
            setSocialReturnStep('feed');
            setStep('profile');
          }}
        />
      )}

      {step === 'profile' && (
        <ProfilePanel
          targetEmail={socialProfileEmail}
          onBack={() => {
            setStep(socialReturnStep);
            setSocialProfileEmail(null);
          }}
        />
      )}

      {step === 'search' && (
        <UserSearchPanel
          onBack={() => setStep('welcome')}
          onOpenProfile={(email) => {
            setSocialProfileEmail(email);
            setSocialReturnStep('search');
            setStep('profile');
          }}
        />
      )}

      {step === 'custom' && (
        <div className="panel custom-browser">
          <h2>Custom debates</h2>
          <p style={{ color: 'var(--muted)', marginTop: '-0.5rem' }}>
            Create a statement to start a live debate, or join a statement you disagree with.
          </p>
          <div className="custom-browser-tabs" role="tablist" aria-label="Custom debate modes">
            <button
              type="button"
              className={`custom-tab ${customTab === 'join' ? 'custom-tab--active' : ''}`}
              role="tab"
              aria-selected={customTab === 'join'}
              onClick={() => setCustomTab('join')}
            >
              Join servers
            </button>
            <button
              type="button"
              className={`custom-tab ${customTab === 'create' ? 'custom-tab--active' : ''}`}
              role="tab"
              aria-selected={customTab === 'create'}
              onClick={() => setCustomTab('create')}
            >
              Create server
            </button>
          </div>

          {error && step === 'custom' && (
            <div className="error-banner custom-browser-error" role="alert">
              {error}
            </div>
          )}

          {customTab === 'create' && (
            <div className="custom-tab-panel">
              <h3 className="custom-subtitle">Create server</h3>
              <div className="custom-toolbar">
                <label className="custom-visibility-label" htmlFor="customJoinMode">
                  Join access
                </label>
                <select
                  id="customJoinMode"
                  className="auth-input custom-visibility-select"
                  value={customJoinMode}
                  onChange={(e) => setCustomJoinMode(e.target.value === 'code' ? 'code' : 'open')}
                >
                  <option value="open">Open lobby (shows in Join servers list)</option>
                  <option value="code">Code-only (hidden from list)</option>
                </select>
              </div>
              <div className="custom-toolbar">
                <input
                  id="statementInput"
                  type="text"
                  className="auth-input custom-search"
                  placeholder="Your statement (example: Vegetables are bad for humans)"
                  value={customStatement}
                  onChange={(e) => setCustomStatement(e.target.value)}
                  maxLength={240}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn btn-primary custom-create-btn"
                  onClick={createCustomGame}
                  disabled={customStatement.trim().length < 8}
                  title={
                    customStatement.trim().length < 8
                      ? 'Type at least 8 characters to publish your lobby'
                      : undefined
                  }
                >
                  Publish statement
                </button>
              </div>
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
            </div>
          )}

          {customTab === 'join' && (
            <div className="custom-tab-panel">
              <h3 className="custom-subtitle">Join servers</h3>
              <div className="custom-toolbar">
                <input
                  id="roomCodeInput"
                  type="text"
                  className="auth-input custom-room-code"
                  placeholder="Join by room code"
                  value={customRoomCode}
                  onChange={(e) => setCustomRoomCode(e.target.value.toUpperCase())}
                  maxLength={24}
                />
                <button type="button" className="btn custom-create-btn" onClick={joinByCode}>
                  Join by code
                </button>
              </div>
              <div className="custom-toolbar">
                <input
                  id="customSearchInput"
                  type="text"
                  className="auth-input custom-search"
                  placeholder="Filter live statements"
                  value={customSearch}
                  onChange={(e) => setCustomSearch(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="custom-table-wrap" role="region" aria-label="Custom room list">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Room</th>
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
                          g.roomCode?.toLowerCase().includes(query) ||
                          g.statement?.toLowerCase().includes(query)
                        );
                      })
                      .map((g) => (
                        <tr key={g.roomCode}>
                          <td>{g.roomCode}</td>
                          <td>{g.statement}</td>
                          <td>Waiting</td>
                          <td>
                            <button
                              type="button"
                              className="btn custom-join-btn"
                              onClick={() => joinCustomGame(g.roomCode)}
                            >
                              Join & disagree
                            </button>
                          </td>
                        </tr>
                      ))}
                    {customGames.filter((g) => {
                      const query = customSearch.trim().toLowerCase();
                      if (!query) return true;
                      return (
                        g.roomCode?.toLowerCase().includes(query) ||
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
            <div className="waiting" style={{ marginTop: '1.5rem' }}>
              <div className="spinner" aria-hidden />
              <p>
                {side === 'agree'
                  ? 'Your custom game is live. Waiting for someone who disagrees to join…'
                  : 'Joining debate…'}
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
        </div>
      )}

      {step === 'history' && (
        <DebateHistory
          rows={historyRows}
          loading={historyLoading}
          error={historyError}
          onBack={() => setStep('welcome')}
          onRefresh={loadHistory}
        />
      )}

      {step === 'topic' && (
        <div className="panel">
          {!quickCategoryId ? (
            <>
              <h2>Choose a category</h2>
              <p className="topic-picker-lead">
                Pick a category first. You&apos;ll choose a specific statement next, then Agree or
                Disagree.
              </p>
              <div className="topic-grid topic-category-picker-grid">
                {TOPIC_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="topic-card topic-category-card"
                    onClick={() => setQuickCategoryId(cat.id)}
                  >
                    <strong className="topic-card-statement">{cat.label}</strong>
                  </button>
                ))}
              </div>
              <button type="button" className="back-btn" onClick={() => setStep('welcome')}>
                Back
              </button>
            </>
          ) : (
            <>
              <h2>Select a statement</h2>
              <p className="topic-picker-lead">
                Category:{' '}
                <strong>{TOPIC_CATEGORIES.find((c) => c.id === quickCategoryId)?.label ?? ''}</strong>
              </p>
              {quickCategoryTopics.length === 0 ? (
                <p className="topic-picker-lead" style={{ marginBottom: '1rem' }}>
                  No statements in this category yet. Check back soon or pick another category.
                </p>
              ) : (
                <div className="topic-grid">
                  {quickCategoryTopics.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="topic-card"
                      onClick={() => pickTopic(t.id)}
                    >
                      <strong className="topic-card-statement">{t.label}</strong>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                className="back-btn"
                onClick={() => {
                  setQuickCategoryId(null);
                  setTopicId(null);
                }}
              >
                Back to categories
              </button>
            </>
          )}
        </div>
      )}

      {step === 'side' && topicId && (
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
              onClick={() => {
                const cat = TOPIC_CATEGORIES.find((c) => c.topics.some((t) => t.id === topicId));
                setQuickCategoryId(cat?.id ?? null);
                setStep('topic');
              }}
            >
              Back to topics
            </button>
          )}
        </div>
      )}

      {step === 'debate' && debateInfo && (
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

          {LEGAL_OVERLAY_IDS.has(headerOverlay) && (
            <LegalViewer documentId={headerOverlay} onBack={() => setHeaderOverlay(null)} />
          )}
          {headerOverlay === 'mission' && <MissionPage onBack={() => setHeaderOverlay(null)} />}
          {headerOverlay === 'support' && <SupportPage onBack={() => setHeaderOverlay(null)} />}
        </>
      )}
      </div>
    </>
  );
}
