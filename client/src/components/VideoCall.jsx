import { useState, useEffect, useRef } from "react";
import { useWebRTC } from "../hooks/useWebRTC";
import { useRecorder } from "../hooks/useRecorder";
import ChatPanel from "./ChatPanel";
import "./VideoCall.css";

function VideoPlayer({ stream, muted = false, label }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-wrapper">
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      <span className="video-label">{label}</span>
    </div>
  );
}

export default function VideoCall({ roomId, onLeave }) {
  const {
    localStream,
    remoteStreams,
    isConnected,
    isMuted,
    isCameraOff,
    isOnHold,
    error,
    toggleMute,
    toggleCamera,
    toggleHold,
    messages,
    sendMessage,
  } = useWebRTC(roomId);

  const {
    recordState,
    recordedBlob,
    isRecording,
    isPaused,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    saveRecording,
  } = useRecorder();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  // Ref-based tracking to avoid stale closure in the messages effect
  const isChatOpenRef = useRef(false);
  const msgLengthRef = useRef(0);
  isChatOpenRef.current = isChatOpen;

  // Increment badge when new remote messages arrive and chat is closed
  useEffect(() => {
    const newMsgs = messages.slice(msgLengthRef.current);
    msgLengthRef.current = messages.length;
    const newRemote = newMsgs.filter((m) => !m.isLocal).length;
    if (!isChatOpenRef.current && newRemote > 0) {
      setUnreadCount((c) => c + newRemote);
    }
  }, [messages]);

  const openChat = () => {
    setIsChatOpen(true);
    setUnreadCount(0);
  };

  const handleRecordToggle = () => {
    if (recordState === "idle") {
      startRecording(localStream, remoteStreams);
    } else if (isRecording) {
      pauseRecording();
    } else {
      resumeRecording();
    }
  };

  const shareViaWhatsApp = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    const text = `Join my video call! Room: ${roomId}\n${url}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  if (error) {
    return (
      <div className="error-screen">
        <p className="error-icon">⚠️</p>
        <p className="error-message">{error}</p>
        <button onClick={onLeave}>Go Back</button>
      </div>
    );
  }

  const remoteEntries = Object.entries(remoteStreams);
  const peerCount = remoteEntries.length;

  return (
    <div className="video-call">
      {/* ── Status bar ── */}
      <div className="connection-status">
        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
        <span>{isConnected ? `Room: ${roomId}` : "Connecting…"}</span>
        <div className="status-right">
          {peerCount > 0 && (
            <span className="peer-count">
              {peerCount} peer{peerCount !== 1 ? "s" : ""} connected
            </span>
          )}
          {(isRecording || isPaused) && (
            <span className="recording-badge">
              <span className={`rec-dot ${isRecording ? "pulsing" : ""}`} />
              {isPaused ? "Paused" : "Recording"}
            </span>
          )}
        </div>
      </div>

      {/* ── Main area: video grid + optional chat panel ── */}
      <div className="call-body">
        <div className={`videos-grid peers-${peerCount}`}>
          {remoteEntries.map(([peerId, stream]) => (
            <VideoPlayer key={peerId} stream={stream} label={`Peer ${peerId.slice(0, 4)}`} />
          ))}
          <VideoPlayer
            stream={localStream}
            muted
            label={isOnHold ? "You (on hold)" : "You"}
          />
        </div>
        {isChatOpen && (
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>

      {/* ── Controls ── */}
      <div className="controls">
        {/* Group 1: call media */}
        <div className="controls-group">
          <button
            onClick={toggleMute}
            disabled={isOnHold}
            className={isMuted ? "btn-active" : ""}
            title={isOnHold ? "On hold" : isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "🎤✕" : "🎤"}
          </button>
          <button
            onClick={toggleCamera}
            disabled={isOnHold}
            className={isCameraOff ? "btn-active" : ""}
            title={isOnHold ? "On hold" : isCameraOff ? "Turn on camera" : "Turn off camera"}
          >
            {isCameraOff ? "📷✕" : "📷"}
          </button>
          <button
            onClick={toggleHold}
            className={isOnHold ? "btn-active" : ""}
            title={isOnHold ? "Resume call" : "Hold call"}
          >
            {isOnHold ? "▶" : "⏸"}
          </button>
        </div>

        {/* Group 2: recording */}
        <div className="controls-group">
          <button
            onClick={handleRecordToggle}
            className={isRecording ? "btn-recording" : isPaused ? "btn-active" : ""}
            title={
              recordState === "idle"
                ? "Start recording"
                : isRecording
                ? "Pause recording"
                : "Resume recording"
            }
          >
            {recordState === "idle" ? "⏺" : isRecording ? "⏸" : "▶"}
          </button>
          {recordState !== "idle" && (
            <button onClick={stopRecording} className="btn-stop-rec" title="Stop recording">
              ⏹
            </button>
          )}
          {recordedBlob && recordState === "idle" && (
            <button onClick={saveRecording} className="btn-save" title="Save recording">
              💾
            </button>
          )}
        </div>

        {/* Group 3: sharing */}
        <div className="controls-group">
          <button onClick={copyLink} title="Copy room link">
            🔗
          </button>
          <button onClick={shareViaWhatsApp} className="btn-whatsapp" title="Share via WhatsApp">
            WA
          </button>
        </div>

        {/* Group 4: chat */}
        <div className="controls-group">
          <button
            onClick={openChat}
            className={isChatOpen ? "btn-active" : ""}
            title="Open chat"
          >
            💬
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>
        </div>

        {/* Leave */}
        <button onClick={onLeave} className="btn-danger" title="Leave call">
          📞✕
        </button>
      </div>
    </div>
  );
}

