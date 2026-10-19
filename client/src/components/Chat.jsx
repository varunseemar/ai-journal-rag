import { useEffect, useRef, useState } from 'react';
import { api, streamChat } from '../api/client.js';
import { formatDate } from '../dates.js';

// Clickable example questions shown before the first message.
const SUGGESTIONS = [
  'What did I eat for breakfast yesterday?',
  'What did I do last week?',
  'What book am I reading?',
];

// messages: [{ role: 'user' | 'assistant', text, sources?, error? }]
export default function Chat({ onSourceClick }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Show which LLM provider/model the API is using (handy when switching Ollama <-> OpenRouter).
  useEffect(() => {
    api
      .get('/api/health')
      .then((health) => setModel(`${health.llmModel} via ${health.llmProvider}`))
      .catch(() => setModel(null));
  }, []);

  // Stop any in-flight answer if the component unmounts (e.g. on logout).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest message in view by scrolling only the messages box, never the page.
  useEffect(() => {
    const box = scrollRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages]);

  // Apply a change to the last message (the assistant answer being streamed).
  const updateLast = (change) =>
    setMessages((prev) => [...prev.slice(0, -1), { ...prev.at(-1), ...change(prev.at(-1)) }]);

  async function handleSubmit(event) {
    event.preventDefault();
    const asked = question.trim();
    if (!asked || streaming) return;

    setQuestion('');
    setStreaming(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: asked },
      { role: 'assistant', text: '', sources: [] },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(asked, {
        signal: controller.signal,
        onSources: (sources) => updateLast(() => ({ sources })),
        // Functional updates: tokens arrive faster than React re-renders.
        onToken: ({ t }) => updateLast((last) => ({ text: last.text + t })),
        onError: ({ message }) => updateLast(() => ({ error: message })),
      });
    } catch (err) {
      if (err.name !== 'AbortError') updateLast(() => ({ error: err.message }));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <div className="panel-header row">
        <h2>Ask your journal</h2>
        <span className="spacer" />
        {model && <span className="model-badge">{model}</span>}
      </div>

      <div className="scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty">
            <p className="empty-title">Ask your journal anything</p>
            <p>Answers come only from your own entries, with the dates they came from.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" className="chip" onClick={() => setQuestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="messages">
          {messages.map((message, i) => {
            const isPending = message.role === 'assistant' && streaming && i === messages.length - 1;
            return (
              <div key={i} className={`message ${message.role}`}>
                <div className="avatar">{message.role === 'user' ? 'Me' : 'AI'}</div>
                <div className="message-body">
                  <div className="bubble">
                    {message.text ||
                      (isPending ? (
                        <span className="typing" aria-label="Thinking">
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        ''
                      ))}
                  </div>
                  {message.error && <p className="error">{message.error}</p>}
                  {message.sources?.length > 0 && (
                    <div className="sources">
                      <span className="muted">Sources</span>
                      {message.sources.map((source) => (
                        <button
                          key={source.n}
                          type="button"
                          className="chip"
                          title={`${source.snippet}... (similarity ${source.score})`}
                          onClick={() => onSourceClick(source.entryId)}
                        >
                          [{source.n}] {formatDate(source.entryDate)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="chat-input">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your past entries..."
          maxLength={1000}
        />
        <button type="submit" className="primary" disabled={streaming || !question.trim()}>
          {streaming ? '...' : 'Ask'}
        </button>
      </form>
    </>
  );
}
