import { useRef, useState, useCallback } from "react";

export function useRecorder() {
  const [recordState, setRecordState] = useState("idle"); // idle | recording | paused
  const [recordedBlob, setRecordedBlob] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const videoElsRef = useRef([]);

  const startRecording = useCallback(
    (localStream, remoteStreams) => {
      if (recordState !== "idle") return;

      chunksRef.current = [];
      setRecordedBlob(null);

      const allStreams = [localStream, ...Object.values(remoteStreams)].filter(Boolean);

      // ── Audio: mix all streams into one AudioContext destination ──
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const audioDest = audioCtx.createMediaStreamDestination();
      allStreams.forEach((s) => {
        if (s.getAudioTracks().length > 0) {
          audioCtx.createMediaStreamSource(s).connect(audioDest);
        }
      });

      // ── Video: composite all streams onto a canvas ──
      const W = 1280;
      const H = 720;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      // Create in-memory video elements — one per stream
      const videoEls = allStreams.map((s) => {
        const v = document.createElement("video");
        v.srcObject = s;
        v.muted = true;
        v.play().catch(() => {});
        return v;
      });
      videoElsRef.current = videoEls;

      function draw() {
        ctx.fillStyle = "#0d0d1a";
        ctx.fillRect(0, 0, W, H);
        const n = videoEls.length;
        if (n > 0) {
          const cols = n === 1 ? 1 : 2;
          const rows = Math.ceil(n / cols);
          const tw = W / cols;
          const th = H / rows;
          videoEls.forEach((v, i) => {
            try {
              ctx.drawImage(v, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
            } catch (_) {}
          });
        }
        rafRef.current = requestAnimationFrame(draw);
      }
      draw();

      // ── Combine canvas video + mixed audio into MediaRecorder ──
      const canvasStream = canvas.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ]);

      const mimeType =
        ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find(
          (t) => MediaRecorder.isTypeSupported(t)
        ) ?? "";

      const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : {});

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        setRecordedBlob(new Blob(chunksRef.current, { type: "video/webm" }));
        videoElsRef.current.forEach((v) => {
          v.srcObject = null;
        });
        videoElsRef.current = [];
        cancelAnimationFrame(rafRef.current);
        audioCtxRef.current?.close();
        audioCtxRef.current = null;
        setRecordState("idle");
      };

      recorder.start(1000); // collect data in 1-second chunks
      recorderRef.current = recorder;
      setRecordState("recording");
    },
    [recordState]
  );

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setRecordState("paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setRecordState("recording");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    cancelAnimationFrame(rafRef.current);
    recorderRef.current.stop(); // triggers onstop which finalizes cleanup
  }, []);

  const saveRecording = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [recordedBlob]);

  return {
    recordState,
    recordedBlob,
    isRecording: recordState === "recording",
    isPaused: recordState === "paused",
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    saveRecording,
  };
}
