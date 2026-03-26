const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
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
