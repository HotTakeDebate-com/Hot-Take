import { useEffect, useRef } from 'react';

const LINK_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|$))/i;

/**
 * Side text chat during an active debate (same Socket.IO room as WebRTC).
 * Links are intentionally blocked for user safety.
 */
export default function DebateChatPanel({
  messages,
  draft,
  onDraftChange,
  onSend,
  disabled,
  mySocketId,
}) {
  const listRef = useRef(null);
  const containsLink = LINK_PATTERN.test(draft.trim());

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && draft.trim() && !containsLink) onSend();
    }
  };

  return (
    <div className="debate-chat" aria-label="Debate text chat">
      <h3 className="debate-chat-title">Text chat</h3>
      <p className="debate-chat-hint">Enter sends; Shift+Enter for a new line. Links are not allowed.</p>
      <div ref={listRef} className="debate-chat-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="debate-chat-empty">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const isSelf = m.from === mySocketId;
            return (
              <div
                key={m.key}
                className={`debate-chat-msg ${isSelf ? 'debate-chat-msg--self' : 'debate-chat-msg--peer'}`}
              >
                <span className="debate-chat-msg-label">{isSelf ? 'You' : 'Opponent'}</span>
                <div className="debate-chat-msg-body">{m.text}</div>
              </div>
            );
          })
        )}
      </div>
      <div className="debate-chat-compose">
        <textarea
          className="debate-chat-input"
          rows={1}
          maxLength={2000}
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Chat message"
        />
        <button
          type="button"
          className="btn btn-primary debate-chat-send"
          onClick={onSend}
          disabled={disabled || !draft.trim() || containsLink}
        >
          Send
        </button>
      </div>
    </div>
  );
}
