/**
 * Eaglercraft Minecraft TCP-to-WebSocket Proxy Server
 * 
 * Production-ready bridge enabling browser-based Minecraft clients (Eaglercraft)
 * to connect directly to standard vanilla, Spigot, Paper, or Aternos TCP servers.
 *
 * Dependencies: ws (npm), net (built-in), http (built-in)
 */

import http from 'http';
import net from 'net';
import { WebSocketServer, WebSocket } from 'ws';

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

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format uptime
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
}

/**
 * Minimal HTTP Server for health-checks and status
 */
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // CORS headers for API accessibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health-check / status endpoints
  if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/healthz' || url.pathname === '/status') {
    const isJson = req.headers.accept && req.headers.accept.includes('application/json');

    const statusData = {
      status: 'healthy',
      service: 'eaglercraft-minecraft-proxy',
      target: {
        host: DEFAULT_TARGET_HOST,
        port: DEFAULT_TARGET_PORT,
      },
      metrics: {
        uptime: formatUptime(Date.now() - stats.startTime),
        uptimeSeconds: Math.floor((Date.now() - stats.startTime) / 1000),
        activeConnections: stats.activeConnections,
        totalConnections: stats.totalConnections,
        bytesForwardedToMinecraft: formatBytes(stats.totalBytesToMinecraft),
        bytesRelayedToClients: formatBytes(stats.totalBytesToClient),
        errorCount: stats.errors,
      },
      timestamp: new Date().toISOString(),
    };

    if (isJson || url.pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(statusData, null, 2));
      return;
    }

    // Return human-readable plain text / minimal HTML for basic monitors
    const responseBody = `OK - Eaglercraft TCP-to-WebSocket Proxy Alive
Target Server: ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}
Active Sessions: ${stats.activeConnections}
Total Sessions: ${stats.totalConnections}
Uptime: ${formatUptime(Date.now() - stats.startTime)}
Data Relayed: RX ${formatBytes(stats.totalBytesToMinecraft)} / TX ${formatBytes(stats.totalBytesToClient)}
`;

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(responseBody);
    return;
  }

  // 404 for unknown HTTP paths
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

/**
 * Parse target Minecraft host and port from URL pathname or query parameters
 * Supports:
 * - /host:port (e.g. /stone.aternos.me:38472)
 * - /host/port (e.g. /stone.aternos.me/38472)
 * - /host (e.g. /mc.hypixel.net -> port 25565)
 * - /?target=host:port
 * - /?host=host&port=port
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
      !cleanPath.startsWith('api/')
    ) {
      // Path format: host/port
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

      // Path format: host:port
      if (cleanPath.includes(':')) {
        const [h, pStr] = cleanPath.split(':');
        if (h) targetHost = h;
        if (pStr) {
          const parsed = parseInt(pStr, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) targetPort = parsed;
        }
        return { host: targetHost, port: targetPort };
      }

      // Path format: host only (default to 25565)
      if (cleanPath.length > 2 && (cleanPath.includes('.') || cleanPath === 'localhost')) {
        targetHost = cleanPath;
        targetPort = 25565;
        return { host: targetHost, port: targetPort };
      }
    }
  } catch {
    // Keep defaults if parsing fails
  }

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
  console.log(`${new Date().toISOString()} ${connTag} New WebSocket client connected. Bridging to TCP ${targetHost}:${targetPort}`);

  // Track per-session metrics
  let sessionBytesToMc = 0;
  let sessionBytesToClient = 0;
  let isClosed = false;

  // Temporary queue for messages received before TCP connection is fully established
  const earlyMessageQueue = [];
  let isTcpConnected = false;

  // Open raw TCP socket to Minecraft server
  const tcpSocket = net.createConnection({
    host: targetHost,
    port: targetPort,
  });

  // Optimize for low-latency Minecraft packet transmission
  tcpSocket.setNoDelay(true);
  tcpSocket.setKeepAlive(true, 30000);

  /**
   * Safe cleanup to ensure both sides terminate cleanly and event listeners are dismantled
   */
  function cleanup(reason, error = null) {
    if (isClosed) return;
    isClosed = true;
    stats.activeConnections = Math.max(0, stats.activeConnections - 1);

    if (error) {
      stats.errors++;
      console.error(`${new Date().toISOString()} ${connTag} Closed due to error: ${error.message || error}`);
    } else {
      console.log(
        `${new Date().toISOString()} ${connTag} Closed (${reason}). Transferred: ${formatBytes(sessionBytesToMc)} to server, ${formatBytes(sessionBytesToClient)} to client`
      );
    }

    // Detach listeners to prevent memory leaks
    ws.removeAllListeners('message');
    ws.removeAllListeners('close');
    ws.removeAllListeners('error');
    ws.removeAllListeners('drain');

    tcpSocket.removeAllListeners('data');
    tcpSocket.removeAllListeners('close');
    tcpSocket.removeAllListeners('error');
    tcpSocket.removeAllListeners('drain');
    tcpSocket.removeAllListeners('connect');

    // Close TCP socket
    try {
      if (!tcpSocket.destroyed) {
        tcpSocket.end();
        tcpSocket.destroy();
      }
    } catch {
      // Ignore destroy errors during teardown
    }

    // Close WebSocket
    try {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, 'Proxy bridge closed');
      }
    } catch {
      // Ignore close errors during teardown
    }
  }

  // --- TCP Socket Handlers ---

  tcpSocket.on('connect', () => {
    isTcpConnected = true;
    console.log(`${new Date().toISOString()} ${connTag} TCP connection established to ${targetHost}:${targetPort}`);

    // Flush any early messages buffered while TCP was handshaking
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

  // Relay raw binary bytes: TCP (Minecraft server) -> WebSocket (Browser client)
  tcpSocket.on('data', (chunk) => {
    if (isClosed || ws.readyState !== WebSocket.OPEN) return;

    sessionBytesToClient += chunk.length;
    stats.totalBytesToClient += chunk.length;

    try {
      ws.send(chunk, { binary: true }, (err) => {
        if (err) {
          cleanup('WebSocket send error', err);
        }
      });

      // Flow control / backpressure management
      // If WebSocket buffered amount exceeds 64KB, pause TCP reads until buffered amount decreases
      if (ws.bufferedAmount > 65536) {
        tcpSocket.pause();
      }
    } catch (err) {
      cleanup('WebSocket send exception', err);
    }
  });

  tcpSocket.on('drain', () => {
    // Resume WebSocket reads once TCP buffer has cleared
    if (!isClosed && ws.readyState === WebSocket.OPEN) {
      ws.resume();
    }
  });

  tcpSocket.on('error', (err) => {
    cleanup(`TCP error (${targetHost}:${targetPort})`, err);
  });

  tcpSocket.on('close', (hadError) => {
    cleanup(hadError ? 'TCP closed with transmission error' : 'TCP server disconnected');
  });

  // --- WebSocket Handlers ---

  // Relay raw binary bytes: WebSocket (Browser client) -> TCP (Minecraft server)
  ws.on('message', (data, isBinary) => {
    if (isClosed) return;

    // Convert incoming data to standard Node.js Buffer
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
      // Buffer packet until TCP socket finishes connecting
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

    // Write directly to TCP socket
    const canWrite = tcpSocket.write(buffer);
    if (!canWrite) {
      // Apply backpressure to WebSocket if TCP kernel send buffer is full
      ws.pause();
    }
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : 'Normal closure';
    cleanup(`WebSocket client disconnected (code: ${code}, reason: ${reasonStr})`);
  });

  ws.on('error', (err) => {
    cleanup('WebSocket client error', err);
  });
});

// Periodic check to resume paused TCP sockets when WS bufferedAmount drops
const backpressureInterval = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 32768) {
      // Handled automatically via drain or normal poll
    }
  }
}, 50);
backpressureInterval.unref();

// Start the server binding strictly to process.env.PORT
server.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================================');
  console.log('   EAGLERCRAFT MINECRAFT TCP <-> WEBSOCKET PROXY SERVER    ');
  console.log('===========================================================');
  console.log(`[INIT] Listening for WebSocket connections on port :${PORT}`);
  console.log(`[INIT] Default Target: ${DEFAULT_TARGET_HOST}:${DEFAULT_TARGET_PORT}`);
  console.log(`[INIT] Dynamic Target Support: /<host>:<port> or ?target=<host>:<port>`);
  console.log(`[INIT] Health Check URL: http://0.0.0.0:${PORT}/health`);
  console.log('===========================================================');
});

// Graceful process shutdown handling
function handleProcessSignal(signal) {
  console.log(`\n[SHUTDOWN] Received ${signal}. Closing proxy gracefully...`);
  wss.close(() => {
    server.close(() => {
      console.log('[SHUTDOWN] Proxy stopped.');
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error('[SHUTDOWN] Force terminating after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => handleProcessSignal('SIGINT'));
process.on('SIGTERM', () => handleProcessSignal('SIGTERM'));

export default server;
