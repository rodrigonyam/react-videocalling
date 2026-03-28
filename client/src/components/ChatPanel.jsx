import { useState, useRef, useEffect } from "react";
import "./ChatPanel.css";

export default function ChatPanel({ messages, onSend, onClose }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (text) {
      onSend(text);
      setInput("");
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>Chat</span>
        <button onClick={onClose} title="Close chat" className="chat-close">
          ✕
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say hi! 👋</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-msg ${msg.isLocal ? "local" : "remote"}`}>
              <span className="chat-author">{msg.isLocal ? "You" : "Peer"}</span>
              <span className="chat-text">{msg.text}</span>
              <span className="chat-time">
                {new Date(msg.ts).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          maxLength={500}
        />
        <button onClick={send} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
