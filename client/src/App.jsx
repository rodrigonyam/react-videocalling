import { useState } from "react";
import VideoCall from "./components/VideoCall";
import "./App.css";

export default function App() {
  const [input, setInput] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);

  const joinRoom = () => {
    const room = input.trim();
    if (room) setActiveRoom(room);
  };

  if (activeRoom) {
    return <VideoCall roomId={activeRoom} onLeave={() => setActiveRoom(null)} />;
  }

  return (
    <div className="lobby">
      <h1>📹 Video Call</h1>
      <p className="subtitle">Enter a room ID to start or join a call</p>
      <div className="join-form">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          placeholder="Room ID (e.g. my-room-123)"
          maxLength={50}
          autoFocus
        />
        <button onClick={joinRoom} disabled={!input.trim()}>
          Join
        </button>
      </div>
      <p className="hint">Share the same room ID with others to connect</p>
    </div>
  );
}
