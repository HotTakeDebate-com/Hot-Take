/**
 * Authoritative two-person WebRTC signaling sessions.
 * Matchmaking decides who shares a room; this controller owns only call readiness,
 * offerer selection, signal routing, and stale-session rejection.
 */
export function createCallSessions(io) {
  const sessions = new Map();

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
      };
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

  const removeSocket = (socket, roomId) => {
    const session = sessions.get(roomId);
    if (!session) return;
    session.ready.delete(socket.id);
    sessions.delete(roomId);
  };

  return { ready, signal, removeSocket };
}
