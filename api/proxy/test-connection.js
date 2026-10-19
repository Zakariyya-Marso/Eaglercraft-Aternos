// Vercel Serverless Function: TCP Ping Probe for Minecraft Server
import net from 'net';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const host = (req.body?.host || req.query?.host || '').trim();
  const port = parseInt(req.body?.port || req.query?.port || '25565', 10);
  const timeoutMs = Math.min(Math.max(parseInt(req.body?.timeoutMs || '5000', 10), 1000), 10000);

  if (!host || isNaN(port) || port <= 0 || port > 65535) {
    return res.status(400).json({
      success: false,
      error: 'Invalid host or port specified.',
    });
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
    return res.status(200).json({
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
    return res.status(200).json({
      success: false,
      host,
      port,
      latencyMs: Date.now() - startTime,
      error: `Connection timed out after ${timeoutMs}ms. Verify that your Aternos/Minecraft server is turned ON and port ${port} is active.`,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('error', (err) => {
    cleanup();
    let explanation = err.message;
    if (err.code === 'ECONNREFUSED') {
      explanation = `Connection refused (ECONNREFUSED). Host ${host} is reachable, but no Minecraft server is accepting connections on port ${port}. Is your server online?`;
    } else if (err.code === 'ENOTFOUND') {
      explanation = `DNS lookup failed (ENOTFOUND). Could not resolve hostname '${host}'.`;
    } else if (err.code === 'ETIMEDOUT') {
      explanation = `Connection timed out (ETIMEDOUT). The server could not be reached.`;
    }

    return res.status(200).json({
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
  } catch (err) {
    cleanup();
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to initiate TCP connection.',
    });
  }
}
