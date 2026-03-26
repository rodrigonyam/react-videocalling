# React Video Calling App

A peer-to-peer video calling application built with **React**, **WebRTC**, and **Socket.io**. No third-party video SDK — full control over the connection.

---

## How It Works

```
[You (Browser)] <---WebRTC P2P video/audio---> [Brother (Browser)]
        |                                               |
        └────────── Socket.io Signaling Server ────────┘
                  (coordinates the connection setup)
```

- **Signaling server** (Node.js + Socket.io): Exchanges connection metadata (offers, answers, ICE candidates) between peers so they can find each other.
- **WebRTC**: Once peers are introduced, video/audio flows directly between browsers — the server is no longer involved.
- **Rooms**: Both users join the same room ID to connect. Works for 2+ participants.

---

## Project Structure

```
react-videocalling/
├── server/                   # Node.js signaling server
│   ├── server.js             # Socket.io server (port 3001)
│   └── package.json
├── client/                   # React frontend (Vite)
│   ├── src/
│   │   ├── hooks/
│   │   │   └── useWebRTC.js  # Core WebRTC + Socket.io logic
│   │   ├── components/
│   │   │   ├── VideoCall.jsx # Video grid UI + controls
│   │   │   └── VideoCall.css
│   │   ├── App.jsx           # Lobby / room join screen
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js        # Runs on port 3000
│   └── package.json
└── package.json              # Root workspace
```

---

## Running Locally

### 1. Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Start the signaling server
```bash
cd server
npm run dev
# Runs on http://localhost:3001
```

### 3. Start the React client
```bash
cd client
npm run dev
# Runs on http://localhost:3000
```

### 4. Test a call
Open `http://localhost:3000` in **two browser tabs**, type the same room ID in both, and join. Video should connect between the two tabs.

---

## Calling Someone Over the Internet (Different Networks)

Localhost only works on your own machine. To call your brother in another state, you need two things:

### 1. Deploy the Signaling Server (Free — Render.com)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New → Web Service**
3. Connect your `react-videocalling` repo and use these settings:

| Setting | Value |
|---------|-------|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | Free |

4. Add environment variable: `CLIENT_URL` = `*`
5. After deploy, copy your server URL (e.g. `https://your-app.onrender.com`)

### 2. Point the Client at the Deployed Server

Create `client/.env`:
```
VITE_SOCKET_URL=https://your-app.onrender.com
```

### 3. Add a TURN Server (for reliable cross-network connections)

STUN alone can fail across different ISPs. A TURN server relays media as a fallback.

Get free TURN credentials from [Metered.ca](https://www.metered.ca/) (no credit card), then update `client/src/hooks/useWebRTC.js`:

```js
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:your-turn-server.metered.live:80",
      username: "your-username",
      credential: "your-credential",
    },
    {
      urls: "turn:your-turn-server.metered.live:443",
      username: "your-username",
      credential: "your-credential",
    },
  ],
};
```

### 4. Deploy the Frontend (Free — Vercel or Netlify)

```bash
cd client
npm run build        # Creates client/dist/
```

Then drag the `dist/` folder into [vercel.com](https://vercel.com) or [netlify.com](https://netlify.com), or connect your GitHub repo for auto-deploy.

Share the deployed frontend URL with your brother — you both open it, enter the same room ID, and connect.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Signaling | Node.js + Socket.io 4 |
| P2P Media | WebRTC (`RTCPeerConnection`) |
| NAT Traversal | STUN (Google) + TURN (optional) |

---

## Features

- [x] Camera + microphone capture
- [x] Multi-peer room support
- [x] Mute / unmute audio
- [x] Turn camera on / off
- [x] Leave call
- [x] ICE candidate queuing (handles race conditions)
- [x] Auto-cleanup on disconnect

---

## Notes

- The **free tier on Render** spins down after 15 minutes of inactivity — the first connection may take ~30 seconds to wake up.
- For production use, consider a paid tier or a always-on service like [Railway](https://railway.app) or [Fly.io](https://fly.io).
- TURN server credentials should be stored in environment variables, not committed to the repo.
