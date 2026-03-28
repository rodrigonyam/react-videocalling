import { useRef, useEffect } from "react";
import { useWebRTC } from "../hooks/useWebRTC";
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
    error,
    toggleMute,
    toggleCamera,
  } = useWebRTC(roomId);

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
      <div className="connection-status">
        <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
        <span>{isConnected ? `Room: ${roomId}` : "Connecting…"}</span>
        {peerCount > 0 && (
          <span className="peer-count">
            {peerCount} peer{peerCount !== 1 ? "s" : ""} connected
          </span>
        )}
      </div>

      <div className={`videos-grid peers-${peerCount}`}>
        {remoteEntries.map(([peerId, stream]) => (
          <VideoPlayer key={peerId} stream={stream} label="Remote" />
        ))}
        <VideoPlayer stream={localStream} muted label="You" />
      </div>

      <div className="controls">
        <button
          onClick={toggleMute}
          className={isMuted ? "btn-active" : ""}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🎤✕" : "🎤"}
        </button>
        <button
          onClick={toggleCamera}
          className={isCameraOff ? "btn-active" : ""}
          title={isCameraOff ? "Turn on camera" : "Turn off camera"}
        >
          {isCameraOff ? "📷✕" : "📷"}
        </button>
        <button onClick={onLeave} className="btn-danger" title="Leave call">
          📞✕
        </button>
      </div>
    </div>
  );
}
