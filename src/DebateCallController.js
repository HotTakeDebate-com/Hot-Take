const DEFAULT_RTC = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function browserRtcConfig(config) {
  const { relayConfigured, ...rtc } = config || DEFAULT_RTC;
  return {
    ...rtc,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    // TURN is a fallback, not a forced route. Forcing relay made a bad TURN
    // credential look like a broken peer connection on desktop browsers.
    iceTransportPolicy: 'all',
  };
}

function addTracks(pc, stream) {
  const kinds = new Set();
  for (const track of stream?.getTracks?.() || []) {
    kinds.add(track.kind);
    pc.addTrack(track, stream);
  }
  if (!kinds.has('audio')) pc.addTransceiver('audio', { direction: 'recvonly' });
  if (!kinds.has('video')) pc.addTransceiver('video', { direction: 'recvonly' });
}

export default class DebateCallController {
  constructor({ socket, rtcConfig, onState, onRemoteTrack, onError }) {
    this.socket = socket;
    this.rtcConfig = rtcConfig;
    this.onState = onState;
    this.onRemoteTrack = onRemoteTrack;
    this.onError = onError;
    this.roomId = null;
    this.sessionId = null;
    this.pc = null;
    this.pendingIce = [];
    this.restartTimer = null;
    this.restarted = false;
    this.offerer = false;
    this.readyTimer = null;
    this.connectTimer = null;
  }

  async prepare(roomId, stream) {
    this.close(false);
    this.roomId = roomId;
    const pc = new RTCPeerConnection(browserRtcConfig(this.rtcConfig));
    this.pc = pc;
    addTracks(pc, stream);
    pc.ontrack = this.onRemoteTrack;
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.emit('ice', candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      this.onState?.(pc.connectionState);
      if (pc.connectionState === 'connected') {
        this.clearRestart();
        if (this.connectTimer) window.clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.socket.emit('call-connected', { roomId: this.roomId, sessionId: this.sessionId });
      }
      if (['failed', 'disconnected'].includes(pc.connectionState)) this.scheduleRestart();
    };
    this.onState?.('new');
    this.socket.emit('call-ready', { roomId });
    this.readyTimer = window.setTimeout(() => {
      if (!this.sessionId && this.roomId === roomId) this.onError?.(new Error('Call readiness timed out.'));
    }, 17_000);
  }

  async start({ roomId, sessionId, offerer }) {
    if (!this.pc || roomId !== this.roomId) return;
    this.sessionId = sessionId;
    if (this.readyTimer) window.clearTimeout(this.readyTimer);
    this.readyTimer = null;
    this.offerer = offerer === true;
    this.connectTimer = window.setTimeout(() => {
      if (this.pc && this.pc.connectionState !== 'connected') this.onError?.(new Error('Call connection timed out.'));
    }, 38_000);
    if (!offerer) return;
    await this.makeOffer(false);
  }

  async receive({ roomId, sessionId, type, payload }) {
    if (!this.pc || roomId !== this.roomId || sessionId !== this.sessionId) return;
    const pc = this.pc;
    if (type === 'ice') {
      if (!pc.remoteDescription) this.pendingIce.push(payload);
      else await pc.addIceCandidate(payload).catch(() => this.pendingIce.push(payload));
      return;
    }
    if (type === 'offer') {
      await pc.setRemoteDescription(payload);
      await this.flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.emit('answer', pc.localDescription);
      return;
    }
    if (type === 'answer' && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(payload);
      await this.flushIce();
    }
  }

  async makeOffer(iceRestart) {
    if (!this.pc || !this.sessionId) return;
    const offer = await this.pc.createOffer({ iceRestart });
    await this.pc.setLocalDescription(offer);
    this.emit('offer', this.pc.localDescription);
  }

  emit(type, payload) {
    if (!this.roomId || !this.sessionId) return;
    this.socket.emit('call-signal', { roomId: this.roomId, sessionId: this.sessionId, type, payload });
  }

  async flushIce() {
    const queued = this.pendingIce.splice(0);
    for (const candidate of queued) await this.pc?.addIceCandidate(candidate).catch(() => {});
  }

  scheduleRestart() {
    if (!this.offerer || this.restartTimer || this.restarted) return;
    this.restartTimer = window.setTimeout(async () => {
      this.restartTimer = null;
      if (!this.pc || !['failed', 'disconnected'].includes(this.pc.connectionState)) return;
      this.restarted = true;
      try {
        await this.makeOffer(true);
      } catch (error) {
        this.onError?.(error);
      }
    }, 3000);
  }

  clearRestart() {
    if (this.restartTimer) window.clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }

  close(resetState = true) {
    this.clearRestart();
    if (this.readyTimer) window.clearTimeout(this.readyTimer);
    if (this.connectTimer) window.clearTimeout(this.connectTimer);
    this.readyTimer = null;
    this.connectTimer = null;
    this.pc?.close();
    this.pc = null;
    this.roomId = null;
    this.sessionId = null;
    this.pendingIce = [];
    this.restarted = false;
    this.offerer = false;
    if (resetState) this.onState?.(null);
  }
}
