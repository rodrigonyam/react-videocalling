import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3001";

export function useWebRTC(roomId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { peerId: MediaStream }
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const peerConnectionsRef = useRef({}); // { peerId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef({}); // { peerId: RTCIceCandidateInit[] }

  // Flush ICE candidates that arrived before remote description was set
  const flushPendingCandidates = useCallback(async (peerId) => {
    const pc = peerConnectionsRef.current[peerId];
    const queue = pendingCandidatesRef.current[peerId] ?? [];
    for (const candidate of queue) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    }
    pendingCandidatesRef.current[peerId] = [];
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socketRef.current?.emit("ice-candidate", { to: peerId, candidate });
        }
      };

      pc.ontrack = ({ streams }) => {
        setRemoteStreams((prev) => ({ ...prev, [peerId]: streams[0] }));
      };

      pc.onconnectionstatechange = () => {
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
          delete peerConnectionsRef.current[peerId];
        }
      };

      // Add local tracks so the remote peer receives our media
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current));
      }

      peerConnectionsRef.current[peerId] = pc;
      return pc;
    },
    [flushPendingCandidates]
  );

  useEffect(() => {
    if (!roomId) return;

    let active = true;

    async function start() {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (err) {
        console.error("Could not get user media:", err);
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera/microphone access was denied. Please allow permissions and try again.");
        } else if (err.name === "NotFoundError") {
          setError("No camera or microphone found. Please connect a device and try again.");
        } else {
          setError("Could not access camera/microphone: " + err.message);
        }
        return;
      }

      if (!active) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);

      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        socket.emit("join-room", roomId);
      });

      socket.on("disconnect", () => setIsConnected(false));

      // We joined: initiate offers to all peers already in the room
      socket.on("room-users", async (peerIds) => {
        for (const peerId of peerIds) {
          try {
            const pc = createPeerConnection(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer", { to: peerId, offer });
          } catch (err) {
            console.error(`Failed to create offer for peer ${peerId}:`, err);
            peerConnectionsRef.current[peerId]?.close();
            delete peerConnectionsRef.current[peerId];
          }
        }
      });

      // A new peer joined after us: they will send us an offer
      socket.on("user-joined", (peerId) => {
        console.log("New peer joined:", peerId);
      });

      // We received an offer from a peer → create answer
      socket.on("offer", async ({ from, offer }) => {
        try {
          const pc = createPeerConnection(from);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          await flushPendingCandidates(from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("answer", { to: from, answer });
        } catch (err) {
          console.error(`Failed to handle offer from peer ${from}:`, err);
          peerConnectionsRef.current[from]?.close();
          delete peerConnectionsRef.current[from];
        }
      });

      // We sent an offer and got the answer back
      socket.on("answer", async ({ from, answer }) => {
        const pc = peerConnectionsRef.current[from];
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await flushPendingCandidates(from);
          } catch (err) {
            console.error(`Failed to handle answer from peer ${from}:`, err);
            pc.close();
            delete peerConnectionsRef.current[from];
          }
        }
      });

      // ICE candidate from a peer
      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = peerConnectionsRef.current[from];
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
        } else {
          // Queue it until we have a remote description
          pendingCandidatesRef.current[from] ??= [];
          pendingCandidatesRef.current[from].push(candidate);
        }
      });

      // A peer disconnected
      socket.on("user-left", (peerId) => {
        peerConnectionsRef.current[peerId]?.close();
        delete peerConnectionsRef.current[peerId];
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      });
    }

    start();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      pendingCandidatesRef.current = {};
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemoteStreams({});
      setIsConnected(false);
      setIsMuted(false);
      setIsCameraOff(false);
    };
  }, [roomId, createPeerConnection, flushPendingCandidates]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsCameraOff(!track.enabled);
    }
  }, []);

  return {
    localStream,
    remoteStreams,
    isConnected,
    isMuted,
    isCameraOff,
    error,
    toggleMute,
    toggleCamera,
  };
}
