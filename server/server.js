const { createServer } = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

// Optional TURN configuration — set these env vars in production:
//   TURN_URLS   comma-separated TURN URIs  e.g. "turn:yourserver.com:3478,turns:yourserver.com:5349"
//   TURN_SECRET shared secret configured on your COTURN / TURN server
const TURN_SECRET = process.env.TURN_SECRET || "";
const TURN_URLS = process.env.TURN_URLS || "";
const CLIENT_ORIGIN = process.env.CLIENT_URL || "http://localhost:3000";

function generateEphemeralTurnCredentials() {
  const ttl = 12 * 3600; // 12-hour expiry
  const username = String(Math.floor(Date.now() / 1000) + ttl);
  const credential = crypto
    .createHmac("sha1", TURN_SECRET)
    .update(username)
    .digest("base64");
  return { username, credential };
}

const FALLBACK_ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const httpServer = createServer((req, res) => {
  // ICE server config endpoint — consumed by the client before each call
  if (req.method === "GET" && req.url === "/api/ice-servers") {
    res.setHeader("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.setHeader("Content-Type", "application/json");

    const iceServers = [...FALLBACK_ICE];

    if (TURN_SECRET && TURN_URLS) {
      const { username, credential } = generateEphemeralTurnCredentials();
      const urls = TURN_URLS.split(",").map((u) => u.trim());
      iceServers.push({ urls, username, credential });
    }

    res.end(JSON.stringify({ iceServers }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"],
  },
});

// roomId -> Set of socket IDs
const rooms = {};

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-room", (roomId) => {
    if (!roomId || typeof roomId !== "string") return;

    socket.join(roomId);

    if (!rooms[roomId]) rooms[roomId] = new Set();
    const existingPeers = [...rooms[roomId]];
    rooms[roomId].add(socket.id);

    // Tell the joiner who is already in the room
    socket.emit("room-users", existingPeers);

    // Tell existing peers someone new arrived
    socket.to(roomId).emit("user-joined", socket.id);

    console.log(`${socket.id} joined room "${roomId}" (${rooms[roomId].size} peers)`);
  });

  socket.on("offer", ({ to, offer }) => {
    if (to && offer) io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    if (to && answer) io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (to && candidate) io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (rooms[roomId]) {
        rooms[roomId].delete(socket.id);
        if (rooms[roomId].size === 0) delete rooms[roomId];
      }
      socket.to(roomId).emit("user-left", socket.id);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () =>
  console.log(`Signaling server listening on http://localhost:${PORT}`)
);
