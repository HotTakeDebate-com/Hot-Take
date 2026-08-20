/**
 * Authoritative two-person WebRTC signaling sessions.
 * Matchmaking decides who shares a room; this controller owns only call readiness,
 * offerer selection, signal routing, and stale-session rejection.
 */
export function createCallSessions(io) {
  const sessions = new Map();
  const READY_TIMEOUT_MS = 15_000;
  const CONNECT_TIMEOUT_MS = 35_000;

  const participants = (roomId) => [...(io.sockets.adapter.rooms.get(roomId) || [])]
    .map((id) => io.sockets.sockets.get(id))
    .filter((member) => member?.connected && member.data.roomId === roomId);

  const ensure = (roomId) => {
    let session = sessions.get(roomId);
    if (!session) {
      session = {
        id: `${roomId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        ready: new Set(),
        started: false,
        offererId: null,
        connected: new Set(),
        readyTimer: null,
        connectTimer: null,
      };
      session.readyTimer = setTimeout(() => {
        if (sessions.get(roomId) !== session || session.started) return;
        io.to(roomId).emit('call-error', {
          roomId,
          code: 'readiness_timeout',
          message: 'The other participant did not become ready. Leave the debate and try matching again.',
        });
        sessions.delete(roomId);
      }, READY_TIMEOUT_MS);
      session.readyTimer.unref?.();
      sessions.set(roomId, session);
    }
    return session;
  };

  const ready = (socket, roomId) => {
    if (!roomId || socket.data.roomId !== roomId) return;
    const members = participants(roomId);
    if (members.length !== 2) return;
    const session = ensure(roomId);
    session.ready.add(socket.id);
    if (session.started || !members.every((member) => session.ready.has(member.id))) return;

    // Stable server-side choice: the first participant already assigned to the room
    // creates the offer. Both clients receive the same immutable session id.
    session.offererId = members[0].id;
    session.started = true;
    clearTimeout(session.readyTimer);
    session.readyTimer = null;
    session.connectTimer = setTimeout(() => {
      if (sessions.get(roomId) !== session || session.connected.size === 2) return;
      io.to(roomId).emit('call-error', {
        roomId,
        code: 'connection_timeout',
        message: 'The video connection timed out. Check both devices and networks, then start a new match.',
      });
      sessions.delete(roomId);
    }, CONNECT_TIMEOUT_MS);
    session.connectTimer.unref?.();
    for (const member of members) {
      member.emit('call-start', {
        roomId,
        sessionId: session.id,
        offerer: member.id === session.offererId,
      });
    }
  };

  const signal = (socket, message = {}) => {
    const roomId = String(message.roomId || '');
    const session = sessions.get(roomId);
    if (!session?.started || socket.data.roomId !== roomId || message.sessionId !== session.id) return;
    const type = message.type;
    if (!['offer', 'answer', 'ice'].includes(type)) return;
    socket.to(roomId).emit('call-signal', {
      roomId,
      sessionId: session.id,
      type,
      payload: message.payload,
      from: socket.id,
    });
  };

  const connected = (socket, roomId, sessionId) => {
    const session = sessions.get(roomId);
    if (!session || session.id !== sessionId || socket.data.roomId !== roomId) return;
    session.connected.add(socket.id);
    if (session.connected.size === 2) {
      clearTimeout(session.connectTimer);
      session.connectTimer = null;
    }
  };

  const removeSocket = (socket, roomId) => {
    const session = sessions.get(roomId);
    if (!session) return;
    clearTimeout(session.readyTimer);
    clearTimeout(session.connectTimer);
    session.ready.delete(socket.id);
    sessions.delete(roomId);
  };

  return { ready, signal, connected, removeSocket };
}
