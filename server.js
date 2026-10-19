/**
 * Eaglercraft Minecraft TCP-to-WebSocket Proxy Server
 * 
 * Production-ready bridge enabling browser-based Minecraft clients (Eaglercraft)
 * to connect directly to standard vanilla, Spigot, Paper, or Aternos TCP servers.
 *
 * Dependencies: ws (npm), net (built-in), http (built-in), fs (built-in), path (built-in)
 */

import http from 'http';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');

// Configuration from Environment Variables with fallbacks
const PORT = parseInt(process.env.PORT || '8080', 10);
const DEFAULT_TARGET_HOST = process.env.TARGET_HOST || '127.0.0.1';
const DEFAULT_TARGET_PORT = parseInt(process.env.TARGET_PORT || '25565', 10);

// Proxy operational metrics for monitoring
const stats = {
  startTime: Date.now(),
  activeConnections: 0,
  totalConnections: 0,
  totalBytesToMinecraft: 0,
  totalBytesToClient: 0,
  errors: 0,
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
}

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * HTTP Server for Health Checks, API, and Static Website Hosting
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Dedicated health-check routes for cloud load balancers / Render
  if (url.pathname === '/health' || url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'healthy', uptimeSeconds: Math.floor((Date.now() - stats.startTime) / 1000) }));
    return;
  }

  // 2. Real-time Status API
  if (url.pathname === '/api/proxy/status') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        targetHost: DEFAULT_TARGET_HOST,
        targetPort: DEFAULT_TARGET_PORT,
        uptimeSeconds: Math.floor((Date.now() - stats.startTime) / 1000),
        startTime: stats.startTime,
        activeConnections: stats.activeConnections,
        totalConnections: stats.totalConnections,
        totalBytesToMinecraft: stats.totalBytesToMinecraft,
        totalBytesToClient: stats.totalBytesToClient,
        errorCount: stats.errors,
        recentLogs: [],
      })
    );
    return;
  }

  // 3. Server-side TCP Connectivity & Handshake Tester
  if (url.pathname === '/api/proxy/test-connection' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const host = (payload.host || DEFAULT_TARGET_HOST).trim();
        const port = parseInt(payload.port || DEFAULT_TARGET_PORT, 10);
        const timeoutMs = Math.min(Math.max(parseInt(payload.timeoutMs || '5000', 10), 1000), 15000);

        if (!host || isNaN(port) || port <= 0 || port > 65535) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid host or port specified.' }));
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
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              host,
              port,
              latencyMs: latency,
              message: `Successfully connected to ${host}:${port} over raw TCP (${latency}ms round-trip).`,
              timestamp: new Date().toISOString(),
            })
          );
        });

        socket.on('timeout', () => {
          cleanup();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              host,
              port,
              latencyMs: Date.now() - startTime,
              error: `Connection timed out after ${timeoutMs}ms. Verify server is online and port ${port} is forwarded.`,
              timestamp: new Date().toISOString(),
            })
          );
        });

        socket.on('error', (err) => {
          cleanup();
          let explanation = err.message;
          if (err.code === 'ECONNREFUSED') {
            explanation = `Connection refused (ECONNREFUSED). Host ${host} is reachable, but no Minecraft server is accepting connections on port ${port}.`;
          } else if (err.code === 'ENOTFOUND') {
            explanation = `DNS lookup failed (ENOTFOUND). Could not resolve hostname '${host}'.`;
          } else if (err.code === 'ETIMEDOUT') {
            explanation = `Connection timed out (ETIMEDOUT).`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, host, port, code: err.code || 'UNKNOWN', error: explanation, timestamp: new Date().toISOString() }));
        });

        socket.connect(port, host);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid request body' }));
      }
    });
    return;
  }

  // 4. Serve built frontend website from dist/ (if present)
  if (fs.existsSync(distDir)) {
    let filePath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);

    // If requested path does not exist, serve index.html (SPA fallback)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // 5. Fallback plain-text status when website is not built
  if (url.pathname === '/' || url.pathname === '/status') {
    const responseBody = `OK - Eaglercraft TCP-to-WebSocket Proxy Alive
Target Server: ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}
Active Sessions: ${stats.activeConnections}
Total Sessions: ${stats.totalConnections}
Uptime: ${formatUptime(Date.now() - stats.startTime)}
Data Relayed: RX ${formatBytes(stats.totalBytesToMinecraft)} / TX ${formatBytes(stats.totalBytesToClient)}
`;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(responseBody);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

/**
 * Parse target Minecraft host and port from URL pathname or query parameters
 */
function parseTargetFromRequest(urlStr, hostHeader, defaultHost, defaultPort) {
  let targetHost = defaultHost;
  let targetPort = defaultPort;

  try {
    const reqUrl = new URL(urlStr || '/', `http://${hostHeader || 'localhost'}`);

    // 1. Check query parameter ?target=host:port
    const queryTarget = reqUrl.searchParams.get('target');
    if (queryTarget) {
      const parts = queryTarget.trim().split(':');
      if (parts[0]) targetHost = parts[0];
      if (parts[1]) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) targetPort = parsed;
      }
      return { host: targetHost, port: targetPort };
    }

    // 2. Check query parameter ?host=... and ?port=...
    const qHost = reqUrl.searchParams.get('host');
    const qPort = reqUrl.searchParams.get('port');
    if (qHost) {
      targetHost = qHost.trim();
      if (qPort) {
        const parsed = parseInt(qPort, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) targetPort = parsed;
      }
      return { host: targetHost, port: targetPort };
    }

    // 3. Check pathname: e.g. /stone.aternos.me:38472 or /stone.aternos.me/38472
    let cleanPath = decodeURIComponent(reqUrl.pathname).replace(/^\/connect\/?/, '').replace(/^\/+|\/+$/g, '');

    if (
      cleanPath &&
      cleanPath !== 'health' &&
      cleanPath !== 'healthz' &&
      cleanPath !== 'status' &&
      !cleanPath.startsWith('api/') &&
      !cleanPath.startsWith('assets/')
    ) {
      if (cleanPath.includes('/')) {
        const segments = cleanPath.split('/').filter(Boolean);
        if (segments.length >= 2) {
          targetHost = segments[0];
          const parsed = parseInt(segments[1], 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) targetPort = parsed;
          return { host: targetHost, port: targetPort };
        } else if (segments.length === 1) {
          cleanPath = segments[0];
        }
      }

      if (cleanPath.includes(':')) {
        const [h, pStr] = cleanPath.split(':');
        if (h) targetHost = h;
        if (pStr) {
          const parsed = parseInt(pStr, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) targetPort = parsed;
        }
        return { host: targetHost, port: targetPort };
      }

      if (cleanPath.length > 2 && (cleanPath.includes('.') || cleanPath === 'localhost')) {
        targetHost = cleanPath;
        targetPort = 25565;
        return { host: targetHost, port: targetPort };
      }
    }
  } catch {}

  return { host: targetHost, port: targetPort };
}

/**
 * WebSocket Server attached to HTTP Server
 */
const wss = new WebSocketServer({ server });
let connectionSequence = 0;

wss.on('connection', (ws, req) => {
  const connectionId = ++connectionSequence;
  stats.totalConnections++;
  stats.activeConnections++;

  const clientIp = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
                   req.socket.remoteAddress ||
                   'unknown';

  const { host: targetHost, port: targetPort } = parseTargetFromRequest(
    req.url,
    req.headers.host,
    DEFAULT_TARGET_HOST,
    DEFAULT_TARGET_PORT
  );

  const connTag = `[Client #${connectionId} (${clientIp})]`;
  console.log(`${new Date().toISOString()} ${connTag} WebSocket open. Bridging to TCP ${targetHost}:${targetPort}`);

  let sessionBytesToMc = 0;
  let sessionBytesToClient = 0;
  let isClosed = false;
  const earlyMessageQueue = [];
  let isTcpConnected = false;

  const tcpSocket = net.createConnection({ host: targetHost, port: targetPort });
  tcpSocket.setNoDelay(true);
  tcpSocket.setKeepAlive(true, 30000);

  function cleanup(reason, error = null) {
    if (isClosed) return;
    isClosed = true;
    stats.activeConnections = Math.max(0, stats.activeConnections - 1);

    if (error) {
      stats.errors++;
      console.error(`${new Date().toISOString()} ${connTag} Closed error: ${error.message || error}`);
    } else {
      console.log(
        `${new Date().toISOString()} ${connTag} Closed (${reason}). Transferred: ${formatBytes(sessionBytesToMc)} to server, ${formatBytes(sessionBytesToClient)} to client`
      );
    }

    ws.removeAllListeners();
    tcpSocket.removeAllListeners();

    try {
      if (!tcpSocket.destroyed) {
        tcpSocket.end();
        tcpSocket.destroy();
      }
    } catch {}

    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Proxy bridge closed');
      }
    } catch {}
  }

  tcpSocket.on('connect', () => {
    isTcpConnected = true;
    console.log(`${new Date().toISOString()} ${connTag} TCP connection established to ${targetHost}:${targetPort}`);
    while (earlyMessageQueue.length > 0 && !isClosed) {
      const queuedChunk = earlyMessageQueue.shift();
      if (queuedChunk) {
        const canWrite = tcpSocket.write(queuedChunk);
        sessionBytesToMc += queuedChunk.length;
        stats.totalBytesToMinecraft += queuedChunk.length;
        if (!canWrite) {
          ws.pause();
          break;
        }
      }
    }
  });

  tcpSocket.on('data', (chunk) => {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;
    sessionBytesToClient += chunk.length;
    stats.totalBytesToClient += chunk.length;

    try {
      ws.send(chunk, { binary: true }, (err) => {
        if (err) cleanup('WebSocket send error', err);
      });
      if (ws.bufferedAmount > 65536) {
        tcpSocket.pause();
      }
    } catch (err) {
      cleanup('WebSocket send exception', err);
    }
  });

  tcpSocket.on('drain', () => {
    if (!isClosed && ws.readyState === WebSocket.OPEN) {
      ws.resume();
    }
  });

  tcpSocket.on('error', (err) => cleanup(`TCP error (${targetHost}:${targetPort})`, err));
  tcpSocket.on('close', (hadError) => cleanup(hadError ? 'TCP transmission error' : 'TCP server disconnected'));

  ws.on('message', (data) => {
    if (isClosed) return;
    let buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (data instanceof ArrayBuffer) {
      buffer = Buffer.from(data);
    } else if (Array.isArray(data)) {
      buffer = Buffer.concat(data);
    } else {
      buffer = Buffer.from(data);
    }

    if (!isTcpConnected) {
      if (earlyMessageQueue.length < 500) {
        earlyMessageQueue.push(buffer);
      } else {
        cleanup('Buffer overflow waiting for TCP connection');
      }
      return;
    }

    if (!tcpSocket.writable) {
      cleanup('TCP socket not writable');
      return;
    }

    sessionBytesToMc += buffer.length;
    stats.totalBytesToMinecraft += buffer.length;
    const canWrite = tcpSocket.write(buffer);
    if (!canWrite) {
      ws.pause();
    }
  });

  ws.on('close', (code, reason) => {
    cleanup(`WebSocket client disconnected (code: ${code}, reason: ${reason?.toString() || 'Normal'})`);
  });

  ws.on('error', (err) => cleanup('WebSocket client error', err));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================================');
  console.log('   EAGLERCRAFT MINECRAFT TCP <-> WEBSOCKET PROXY SERVER    ');
  console.log('===========================================================');
  console.log(`[INIT] Listening on port :${PORT}`);
  console.log(`[INIT] Frontend Web: ${fs.existsSync(distDir) ? 'Serving built dist/' : 'API / Status only'}`);
  console.log(`[INIT] Default Target: ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}`);
  console.log('===========================================================');
});

function handleProcessSignal(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing proxy gracefully...`);
  wss.close(() => {
    server.close(() => {
      console.log('[SHUTDOWN] Proxy stopped.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => handleProcessSignal('SIGINT'));
process.on('SIGTERM', () => handleProcessSignal('SIGTERM'));

export default server;
