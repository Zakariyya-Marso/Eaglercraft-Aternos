# Eaglercraft Minecraft TCP-to-WebSocket Proxy

A high-performance, low-latency, production-ready Node.js bridge that allows browser-based Minecraft clients (**Eaglercraft**) to connect to standard vanilla, Spigot, Paper, Fabric, and Aternos Minecraft servers over raw TCP.

---

## ⚡ How It Works

1. **Browser Client (Eaglercraft)** connects to this proxy using secure WebSockets (`wss://your-proxy-domain.com`).
2. **The Proxy Server** opens a raw, unbuffered TCP connection directly to the target Minecraft server (`TARGET_HOST:TARGET_PORT`).
3. **Data Relaying**: All binary packets are relayed bidirectionally byte-for-byte with Nagle's algorithm disabled (`setNoDelay(true)`) for minimal latency, plus TCP backpressure handling to prevent memory leaks.
4. **Health Check**: An integrated HTTP endpoint (`GET /`) provides a 200 OK status to satisfy uptime pingers and cloud load balancers.

---

## 🚀 One-Click Deploy to Render

1. Fork or push this repository to GitHub/GitLab.
2. In Render Dashboard, click **New +** -> **Blueprint**.
3. Select this repository. Render will automatically detect `render.yaml`.
4. Fill in your environment variables:
   - `TARGET_HOST`: Your server IP or domain (e.g. `myserver.aternos.me`)
   - `TARGET_PORT`: Your server port (e.g. `25565` or your Aternos dynamic port)
5. Click **Apply**. Render will build and deploy the web service with automatic HTTPS/WSS!

### Connecting from Eaglercraft
Once deployed on Render, add a new server in your Eaglercraft client:
```text
wss://your-service-name.onrender.com
```

---

## 🛠 Local Setup & Running

### Requirements
- Node.js 18+ (Node 20+ recommended)

### Installation
```bash
npm install
```

### Configuration
Set environment variables or create a `.env` file:
```env
PORT=8080
TARGET_HOST=myserver.aternos.me
TARGET_PORT=25565
```

### Start Proxy
```bash
npm start
```

---

## 📋 Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Listening port assigned by host | `8080` (or `3000` in dev) |
| `TARGET_HOST` | Target Minecraft server IP/domain | `127.0.0.1` |
| `TARGET_PORT` | Target Minecraft server TCP port | `25565` |

---

## ⚠️ Important Minecraft Server Configuration Notes

- **Cracked / Offline Mode**: Browser Eaglercraft clients cannot authenticate against Mojang/Microsoft official auth servers. Ensure your Minecraft server has `online-mode=false` set in `server.properties` (or toggle "Cracked: ON" in Aternos Options).
- **Aternos Dynamic Ports**: Aternos assigns dynamic ports (e.g. `38472`). Make sure `TARGET_PORT` matches your active Aternos server port, not just 25565.
- **HTTPS & Secure WebSockets**: Modern browsers require `wss://` (secure WebSockets) if Eaglercraft is loaded over HTTPS. Render provides free automatic SSL termination, so `wss://<app>.onrender.com` works out-of-the-box.
