import { useEffect, useMemo, useState } from 'react';
import './chat.css';
import Modal from './Modal';
import { api, API_URL } from '../lib/api';
import { auth } from '../firebase';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function sameSender(a, b) {
  return a?.name === b?.name;
}

export default function Chat({ onClose }) {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    let connected = true;

    api('/chat').then(setStatus).catch((e) => setError(e.message));

    (async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`${API_URL}/chat/stream`, {
          signal: abort.signal,
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error((await response.json()).message);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (connected) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop();

          for (const part of parts) {
            if (!part.startsWith('data: ')) continue;
            const msg = JSON.parse(part.slice(6));
            setMessages((old) => [
              ...old.filter((m) => m.id !== msg.id && m.expiresAt > Date.now()),
              msg,
            ].sort((a, b) => a.createdAt - b.createdAt).slice(-50));
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message);
      }
    })();

    const timer = setInterval(() => {
      setMessages((old) => old.filter((m) => m.expiresAt > Date.now()));
    }, 1000);

    return () => {
      connected = false;
      abort.abort();
      clearInterval(timer);
    };
  }, []);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || busy || status?.messagesRemaining === 0) return;
    setBusy(true);
    try {
      const next = await api('/chat', { method: 'POST', body: { message: text } });
      setStatus(next);
      setText('');
      setError('');
    } catch (e) {
      setError(e.message);
      try { setStatus(await api('/chat')); } catch { /* Keep the current status if refresh fails. */ }
    } finally {
      setBusy(false);
    }
  }

  const remaining = status?.messagesRemaining ?? 0;
  const limitLabel = useMemo(
    () => `${remaining} message${remaining === 1 ? '' : 's'} remaining this month`,
    [remaining]
  );

  return (
    <Modal title="Community chat" onClose={onClose}>
      <div className="gg-chat">
        <div className="gg-chat-intro">
          <div>
            <strong>GG Community</strong>
            <span>Messages stay visible for 5 days.</span>
          </div>
          <span className="gg-chat-quota">{limitLabel}</span>
        </div>

        {error && <p className="gg-chat-error" role="alert">{error}</p>}

        <div className="gg-chat-stream" aria-live="polite" aria-label="Community messages">
          {messages.length === 0 ? (
            <div className="gg-chat-empty">
              <span aria-hidden="true">✦</span>
              <strong>No messages yet</strong>
              <p>Start the conversation with the GG community.</p>
            </div>
          ) : messages.map((m, index) => {
            const previous = messages[index - 1];
            const grouped = sameSender(previous, m);
            return (
              <article className={`gg-chat-message${grouped ? ' grouped' : ''}`} key={m.id}>
                {!grouped && (
                  <div className="gg-chat-message-head">
                    <strong>{m.name}</strong>
                    <time dateTime={new Date(m.createdAt).toISOString()}>{formatTime(m.createdAt)}</time>
                  </div>
                )}
                <p>{m.text}</p>
              </article>
            );
          })}
        </div>

        <form className="gg-chat-composer" onSubmit={send}>
          <label htmlFor="gg-chat-message" className="sr-only">Message</label>
          <textarea
            id="gg-chat-message"
            maxLength={500}
            value={text}
            disabled={!status || remaining === 0 || busy}
            onChange={(e) => setText(e.target.value)}
            placeholder={remaining === 0 ? 'Monthly message limit reached' : 'Write a message…'}
            rows={2}
          />
          <div className="gg-chat-composer-footer">
            <small>{text.length}/500</small>
            <button className="save-button gg-chat-send" disabled={!status || remaining === 0 || !text.trim() || busy}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>

        {status?.messagesRemaining === 0 && (
          <p className="gg-chat-limit">You’ve used all 3 messages for {status.monthKey}. Your allowance resets next month.</p>
        )}
      </div>
    </Modal>
  );
}
