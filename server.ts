import express from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DEFAULT_TARGET_HOST = process.env.TARGET_HOST || '127.0.0.1';
const DEFAULT_TARGET_PORT = parseInt(process.env.TARGET_PORT || '25565', 10);

const app = express();
app.use(express.json());

const server = http.createServer(app);

// Operational Metrics
const proxyStats = {
  startTime: Date.now(),
  activeConnections: 0,
  totalConnections: 0,
  totalBytesToMinecraft: 0,
  totalBytesToClient: 0,
  errors: 0,
  recentLogs: [] as Array<{
    id: string;
    timestamp: string;
    type: 'info' | 'connect' | 'disconnect' | 'error' | 'data';
    message: string;
  }>,
};

function logProxyEvent(type: 'info' | 'connect' | 'disconnect' | 'error' | 'data', message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${type.toUpperCase()}] ${timestamp} ${message}`);
  proxyStats.recentLogs.unshift({
    id: Math.random().toString(36).substring(2, 9),
    timestamp,
    type,
    message,
  });
  if (proxyStats.recentLogs.length > 100) {
    proxyStats.recentLogs.pop();
  }
}

// Health check endpoint
app.get(['/health', '/healthz', '/api/health'], (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'eaglercraft-minecraft-proxy',
    target: {
      host: DEFAULT_TARGET_HOST,
      port: DEFAULT_TARGET_PORT,
    },
    uptimeSeconds: Math.floor((Date.now() - proxyStats.startTime) / 1000),
    activeConnections: proxyStats.activeConnections,
    totalConnections: proxyStats.totalConnections,
  });
});

// Real-time status API
app.get('/api/proxy/status', (_req, res) => {
  res.json({
    targetHost: DEFAULT_TARGET_HOST,
    targetPort: DEFAULT_TARGET_PORT,
    uptimeSeconds: Math.floor((Date.now() - proxyStats.startTime) / 1000),
    startTime: proxyStats.startTime,
    activeConnections: proxyStats.activeConnections,
    totalConnections: proxyStats.totalConnections,
    totalBytesToMinecraft: proxyStats.totalBytesToMinecraft,
    totalBytesToClient: proxyStats.totalBytesToClient,
    errorCount: proxyStats.errors,
    recentLogs: proxyStats.recentLogs.slice(0, 30),
  });
});

// Server-side TCP Connectivity & Handshake Tester
app.post('/api/proxy/test-connection', async (req, res) => {
  const host = (req.body.host || DEFAULT_TARGET_HOST).trim();
  const port = parseInt(req.body.port || DEFAULT_TARGET_PORT, 10);
  const timeoutMs = Math.min(Math.max(parseInt(req.body.timeoutMs || '5000', 10), 1000), 15000);

  if (!host || isNaN(port) || port <= 0 || port > 65535) {
    res.status(400).json({
      success: false,
      error: 'Invalid host or port specified.',
    });
    return;
  }

  const startTime = Date.now();
  let finished = false;

  const socket = new net.Socket();
  socket.setTimeout(timeoutMs);

  const cleanup = () => {
    if (!finished) {
      finished = true;
      socket.removeAllListeners();
      socket.destroy();
    }
  };

  socket.on('connect', () => {
    const latency = Date.now() - startTime;
    cleanup();
    res.json({
      success: true,
      host,
      port,
      latencyMs: latency,
      message: `Successfully connected to ${host}:${port} over raw TCP (${latency}ms round-trip).`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('timeout', () => {
    cleanup();
    res.json({
      success: false,
      host,
      port,
      latencyMs: Date.now() - startTime,
      error: `Connection timed out after ${timeoutMs}ms. Verify that the server is online and port ${port} is forwarded.`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('error', (err: any) => {
    cleanup();
    let explanation = err.message;
    if (err.code === 'ECONNREFUSED') {
      explanation = `Connection refused (ECONNREFUSED). The host ${host} is reachable, but no Minecraft server is accepting connections on port ${port}.`;
    } else if (err.code === 'ENOTFOUND') {
      explanation = `DNS lookup failed (ENOTFOUND). Could not resolve hostname '${host}'.`;
    } else if (err.code === 'ETIMEDOUT') {
      explanation = `Connection timed out (ETIMEDOUT). The server IP could not be reached.`;
    }

    res.json({
      success: false,
      host,
      port,
      code: err.code || 'UNKNOWN',
      error: explanation,
      timestamp: new Date().toISOString(),
    });
  });

  try {
    socket.connect(port, host);
  } catch (err: any) {
    cleanup();
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to initiate TCP socket.',
    });
  }
});

// Endpoint to fetch or download source files
app.get('/api/files/:filename', (req, res) => {
  const allowedFiles: Record<string, string> = {
    'server.js': path.join(__dirname, 'server.js'),
    'render.yaml': path.join(__dirname, 'render.yaml'),
    'package.json': path.join(__dirname, 'package.json'),
    'Dockerfile': path.join(__dirname, 'Dockerfile'),
    'README.md': path.join(__dirname, 'README.md'),
    '.env.example': path.join(__dirname, '.env.example'),
  };

  const filePath = allowedFiles[req.params.filename];
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).send('File not found');
    return;
  }

  const isDownload = req.query.download === '1';
  if (isDownload) {
    res.download(filePath, req.params.filename);
  } else {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(fs.readFileSync(filePath, 'utf-8'));
  }
});

// Setup WebSocket Server for TCP proxying
const wss = new WebSocketServer({ noServer: true });
let connCounter = 0;

wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
  const connId = ++connCounter;
  proxyStats.totalConnections++;
  proxyStats.activeConnections++;

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
                   req.socket.remoteAddress ||
                   'unknown';

  let targetHost = DEFAULT_TARGET_HOST;
  let targetPort = DEFAULT_TARGET_PORT;

  try {
    const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const queryTarget = reqUrl.searchParams.get('target');
    if (queryTarget) {
      const parts = queryTarget.split(':');
      if (parts[0]) targetHost = parts[0];
      if (parts[1]) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
          targetPort = parsed;
        }
      }
    }
  } catch {
    // Keep default
  }

  logProxyEvent('connect', `[#${connId} from ${clientIp}] WebSocket open. Bridging to TCP ${targetHost}:${targetPort}`);

  let isClosed = false;
  let sessionToMc = 0;
  let sessionToClient = 0;
  const earlyQueue: Buffer[] = [];
  let isTcpConnected = false;

  const tcpSocket = net.createConnection({ host: targetHost, port: targetPort });
  tcpSocket.setNoDelay(true);
  tcpSocket.setKeepAlive(true, 30000);

  const cleanup = (reason: string, err?: any) => {
    if (isClosed) return;
    isClosed = true;
    proxyStats.activeConnections = Math.max(0, proxyStats.activeConnections - 1);

    if (err) {
      proxyStats.errors++;
      logProxyEvent('error', `[#${connId}] Closed error: ${err.message || err}`);
    } else {
      logProxyEvent('disconnect', `[#${connId}] Closed (${reason}). Transferred: ${sessionToMc}B up, ${sessionToClient}B down`);
    }

    ws.removeAllListeners();
    tcpSocket.removeAllListeners();

    try {
      if (!tcpSocket.destroyed) {
        tcpSocket.destroy();
      }
    } catch {}

    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Bridge closed');
      }
    } catch {}
  };

  tcpSocket.on('connect', () => {
    isTcpConnected = true;
    logProxyEvent('info', `[#${connId}] TCP connected to ${targetHost}:${targetPort}`);
    while (earlyQueue.length > 0 && !isClosed) {
      const chunk = earlyQueue.shift();
      if (chunk) {
        const canWrite = tcpSocket.write(chunk);
        sessionToMc += chunk.length;
        proxyStats.totalBytesToMinecraft += chunk.length;
        if (!canWrite) {
          ws.pause();
          break;
        }
      }
    }
  });

  tcpSocket.on('data', (chunk: Buffer) => {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;
    sessionToClient += chunk.length;
    proxyStats.totalBytesToClient += chunk.length;
    try {
      ws.send(chunk, { binary: true }, (err) => {
        if (err) cleanup('WS send error', err);
      });
      if (ws.bufferedAmount > 65536) {
        tcpSocket.pause();
      }
    } catch (err) {
      cleanup('WS send exception', err);
    }
  });

  tcpSocket.on('drain', () => {
    if (!isClosed && ws.readyState === WebSocket.OPEN) {
      ws.resume();
    }
  });

  tcpSocket.on('error', (err) => cleanup(`TCP error (${targetHost}:${targetPort})`, err));
  tcpSocket.on('close', (hadError) => cleanup(hadError ? 'TCP transmission error' : 'TCP server closed'));

  ws.on('message', (data: any) => {
    if (isClosed) return;
    let buf: Buffer;
    if (Buffer.isBuffer(data)) {
      buf = data;
    } else if (data instanceof ArrayBuffer) {
      buf = Buffer.from(data);
    } else if (Array.isArray(data)) {
      buf = Buffer.concat(data);
    } else {
      buf = Buffer.from(data);
    }

    if (!isTcpConnected) {
      if (earlyQueue.length < 500) {
        earlyQueue.push(buf);
      } else {
        cleanup('Early buffer overflow');
      }
      return;
    }

    if (!tcpSocket.writable) {
      cleanup('TCP not writable');
      return;
    }

    sessionToMc += buf.length;
    proxyStats.totalBytesToMinecraft += buf.length;
    const canWrite = tcpSocket.write(buf);
    if (!canWrite) {
      ws.pause();
    }
  });

  ws.on('close', (code, reason) => {
    cleanup(`WebSocket closed code ${code}: ${reason?.toString() || 'Normal'}`);
  });
  ws.on('error', (err) => cleanup('WebSocket client error', err));
});

// Handle HTTP upgrade requests: delegate Vite HMR vs Eaglercraft Proxy
server.on('upgrade', (req, socket, head) => {
  const isViteHmr = req.headers['sec-websocket-protocol'] === 'vite-hmr' ||
                    req.url?.startsWith('/@vite');

  if (isViteHmr) {
    // Let Vite dev server handle its own HMR WebSocket
    return;
  }

  // Handle Minecraft proxy WebSocket upgrade
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // In development, dynamically mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static assets from dist
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[PROXY] Target Minecraft server: ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}`);
    logProxyEvent('info', `Proxy started. Listening on port ${PORT}. Target: ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});

export default app;
