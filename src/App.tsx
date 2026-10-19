import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Wifi,
  Terminal,
  FileCode,
  Check,
  Copy,
  Download,
  ExternalLink,
  AlertCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Layers,
  Globe,
  Clock,
  ArrowRight,
  Radio,
  Sliders,
  ChevronRight
} from 'lucide-react';

interface ProxyStatus {
  targetHost: string;
  targetPort: number;
  uptimeSeconds: number;
  startTime: number;
  activeConnections: number;
  totalConnections: number;
  totalBytesToMinecraft: number;
  totalBytesToClient: number;
  errorCount: number;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    type: 'info' | 'connect' | 'disconnect' | 'error' | 'data';
    message: string;
  }>;
}

interface TestResult {
  success: boolean;
  host: string;
  port: number;
  latencyMs?: number;
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tester' | 'files' | 'deploy' | 'aternos' | 'logs'>('overview');
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Server test state
  const [testHost, setTestHost] = useState('myserver.aternos.me');
  const [testPort, setTestPort] = useState('25565');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // File viewer state
  const [selectedFile, setSelectedFile] = useState<'server.js' | 'render.yaml' | 'package.json' | 'Dockerfile' | '.env.example' | 'README.md'>('server.js');
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);

  // Custom client URL builder
  const [customClientDomain, setCustomClientDomain] = useState('');

  // Fetch status on mount and interval
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/proxy/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch proxy status:', e);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch file content when tab or selected file changes
  useEffect(() => {
    if (activeTab === 'files') {
      loadFileContent(selectedFile);
    }
  }, [activeTab, selectedFile]);

  const loadFileContent = async (fileName: string) => {
    setLoadingFile(true);
    try {
      const res = await fetch(`/api/files/${fileName}`);
      if (res.ok) {
        const text = await res.text();
        setFileContent(text);
      } else {
        setFileContent('// Error loading file content.');
      }
    } catch {
      setFileContent('// Could not connect to file endpoint.');
    } finally {
      setLoadingFile(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testHost || !testPort) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/proxy/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: testHost, port: parseInt(testPort, 10), timeoutMs: 6000 }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        success: false,
        host: testHost,
        port: parseInt(testPort, 10),
        error: err.message || 'Network error executing connection test.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Compute public WebSocket URL
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  const isHttps = typeof window !== 'undefined' ? window.location.protocol === 'https:' : false;
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const defaultWsUrl = `${wsProtocol}//${currentHost}`;
  const effectiveWsUrl = customClientDomain.trim()
    ? (customClientDomain.startsWith('ws://') || customClientDomain.startsWith('wss://')
        ? customClientDomain
        : `wss://${customClientDomain}`)
    : defaultWsUrl;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Bar following Top Bar Contract (1-line Brand wordmark, 4-5 text links, 1 primary action) */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
              EaglerProxy
            </span>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={() => setActiveTab('overview')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('tester')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'tester' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Server Tester
            </button>
            <button
              onClick={() => setActiveTab('files')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'files' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Code & Config
            </button>
            <button
              onClick={() => setActiveTab('deploy')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'deploy' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Render Deploy
            </button>
            <button
              onClick={() => setActiveTab('aternos')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'aternos' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Aternos Guide
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'logs' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Live Logs
            </button>
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => copyToClipboard(defaultWsUrl, 'top-bar-url')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-emerald-500/20 active:scale-[0.98]"
            >
              {copiedKey === 'top-bar-url' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied WSS URL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Proxy URL</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 border-t border-slate-800/60 overflow-x-auto text-xs">
          {(['overview', 'tester', 'files', 'deploy', 'aternos', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md capitalize whitespace-nowrap ${
                activeTab === tab ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400'
              }`}
            >
              {tab === 'files' ? 'Code' : tab}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="border border-slate-800/80 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/30 p-6 sm:p-8">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <span>WebSocket to TCP Relay</span>
                  <span aria-hidden="true">·</span>
                  <span>Eaglercraft 1.5.2 / 1.8.8 / 1.12 / 1.20</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-mono">Zero-overhead byte-for-byte stream</span>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
                  Minecraft TCP to WebSocket Proxy
                </h1>
                <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                  Enables browser-based Minecraft players on Eaglercraft to connect seamlessly to standard vanilla,
                  Spigot, Paper, Fabric, or Aternos servers that only speak raw TCP.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setActiveTab('tester')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm active:scale-[0.98]"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Test Minecraft Server</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('files')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors active:scale-[0.98]"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>View server.js & render.yaml</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('deploy')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-colors active:scale-[0.98]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Render Deployment Guide</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics KPI Row with tabular figures */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Target Server</span>
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-white font-mono truncate" title={`${status?.targetHost || '127.0.0.1'}:${status?.targetPort || 25565}`}>
                  {status ? `${status.targetHost}:${status.targetPort}` : 'Loading...'}
                </div>
                <div className="text-xs text-slate-500 mt-1">Configured via TARGET_HOST</div>
              </div>

              <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Active Clients</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
                  {status?.activeConnections ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Total served: <span className="font-mono tabular-nums">{status?.totalConnections ?? 0}</span>
                </div>
              </div>

              <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Relayed Traffic</span>
                  <Wifi className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  {status ? formatBytes(status.totalBytesToMinecraft + status.totalBytesToClient) : '0 B'}
                </div>
                <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                  RX {status ? formatBytes(status.totalBytesToMinecraft) : '0 B'} · TX {status ? formatBytes(status.totalBytesToClient) : '0 B'}
                </div>
              </div>

              <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Health Check & Uptime</span>
                  <Clock className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-white font-mono tabular-nums">
                  {status ? formatUptime(status.uptimeSeconds) : '0s'}
                </div>
                <div className="text-xs text-emerald-400 flex items-center gap-1 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>HTTP GET /: 200 OK</span>
                </div>
              </div>
            </div>

            {/* Architecture Relay Diagram */}
            <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-6">
              <h2 className="font-display text-lg font-semibold text-white mb-4">
                Bi-Directional Relay Architecture
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Step 1: Eaglercraft */}
                <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
                  <div className="text-xs text-emerald-400 font-mono mb-1">Browser Client</div>
                  <h3 className="text-base font-bold text-white">Eaglercraft 1.8.8</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Connects using standard WebSockets. Modern browsers block raw TCP sockets due to sandbox security.
                  </p>
                  <div className="mt-3 text-xs font-mono bg-slate-900/90 px-2.5 py-1.5 rounded text-slate-300 break-all">
                    wss://your-proxy.onrender.com
                  </div>
                </div>

                {/* Step 2: This Node.js Proxy */}
                <div className="border border-emerald-500/40 bg-emerald-950/10 rounded-xl p-4 relative">
                  <div className="text-xs text-emerald-400 font-mono mb-1">Node.js Stream Relay</div>
                  <h3 className="text-base font-bold text-white">EaglerProxy (server.js)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Listens on <code className="text-emerald-400 font-mono">process.env.PORT</code>, unwraps WebSocket frames,
                    applies backpressure control, and streams unbuffered raw TCP bytes.
                  </p>
                  <div className="mt-3 text-xs font-mono bg-slate-900/90 px-2.5 py-1.5 rounded text-emerald-400">
                    net.createConnection() + ws.send()
                  </div>
                </div>

                {/* Step 3: Target Minecraft Server */}
                <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
                  <div className="text-xs text-slate-400 font-mono mb-1">Target Host</div>
                  <h3 className="text-base font-bold text-white">Minecraft TCP Server</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Vanilla, Paper, Spigot, Fabric, or Aternos. Sees incoming packets as genuine TCP Minecraft protocol handshakes.
                  </p>
                  <div className="mt-3 text-xs font-mono bg-slate-900/90 px-2.5 py-1.5 rounded text-slate-300 break-all">
                    {status?.targetHost || 'myserver.aternos.me'}:{status?.targetPort || 25565}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Connection URL Box */}
            <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h3 className="text-base font-semibold text-white">Eaglercraft Multiplayer Server Address</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Paste this WebSocket address directly into your Eaglercraft client&apos;s &quot;Add Server&quot; screen:
                </p>
                <div className="mt-2 font-mono text-sm text-emerald-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 select-all">
                  {defaultWsUrl}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => copyToClipboard(defaultWsUrl, 'overview-ws-url')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm"
                >
                  {copiedKey === 'overview-ws-url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey === 'overview-ws-url' ? 'Copied!' : 'Copy Address'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SERVER TESTER & PING */}
        {activeTab === 'tester' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Minecraft Server TCP Tester</h2>
              <p className="text-sm text-slate-400 mt-1">
                Test raw TCP socket connectivity to any Minecraft server (Aternos, Vanilla, Hypixel, etc.) to verify that
                the target host is online and accepting incoming connections.
              </p>
            </div>

            <form onSubmit={handleTestConnection} className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Target Hostname or IP
                  </label>
                  <input
                    type="text"
                    value={testHost}
                    onChange={(e) => setTestHost(e.target.value)}
                    placeholder="e.g. myserver.aternos.me or mc.hypixel.net"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    For Aternos, use your active server address (e.g. <code>user.aternos.me</code>).
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    TCP Port
                  </label>
                  <input
                    type="number"
                    value={testPort}
                    onChange={(e) => setTestPort(e.target.value)}
                    placeholder="25565"
                    className="w-full px-3.5 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                    required
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    Standard is 25565; Aternos uses dynamic ports.
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Quick presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTestHost('mc.hypixel.net');
                      setTestPort('25565');
                    }}
                    className="text-emerald-400 hover:underline"
                  >
                    Hypixel
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTestHost('myserver.aternos.me');
                      setTestPort('25565');
                    }}
                    className="text-emerald-400 hover:underline"
                  >
                    Aternos Sample
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isTesting}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isTesting ? 'Probing TCP Port...' : 'Test Connection'}</span>
                </button>
              </div>
            </form>

            {/* Test Results Display */}
            {testResult && (
              <div
                className={`border rounded-xl p-5 ${
                  testResult.success
                    ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                    : 'border-red-500/40 bg-red-950/20 text-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-white">
                        {testResult.success ? 'TCP Port Open & Reachable' : 'Connection Failed'}
                      </span>
                      {testResult.latencyMs !== undefined && (
                        <span className="text-xs font-mono tabular-nums px-2 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-200">
                          {testResult.latencyMs}ms round-trip
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">
                      {testResult.message || testResult.error}
                    </p>

                    {testResult.success && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20 text-xs text-slate-300 space-y-1">
                        <div>
                          <strong>Ready for Eaglercraft:</strong> Your proxy can bridge incoming WebSocket connections to{' '}
                          <code className="text-emerald-300 font-mono">{testResult.host}:{testResult.port}</code>.
                        </div>
                        <div className="font-mono text-emerald-400 bg-slate-950/80 p-2 rounded border border-emerald-500/30 select-all">
                          {defaultWsUrl}/?target={testResult.host}:{testResult.port}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Custom Client URL Generator */}
            <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-6 space-y-4">
              <h3 className="text-base font-semibold text-white">Eaglercraft Server Address Generator</h3>
              <p className="text-xs text-slate-400">
                If you have deployed this proxy to Render or a custom VPS domain, enter your domain below to generate the exact connection URL:
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Your Deployed Proxy Domain
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customClientDomain}
                    onChange={(e) => setCustomClientDomain(e.target.value)}
                    placeholder="e.g. my-eagler-proxy.onrender.com"
                    className="flex-1 px-3.5 py-2 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(effectiveWsUrl, 'custom-url')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors whitespace-nowrap"
                  >
                    {copiedKey === 'custom-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'custom-url' ? 'Copied' : 'Copy WSS'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                <span className="text-slate-400">Resulting Eaglercraft Address:</span>
                <div className="font-mono text-emerald-400 select-all break-all">{effectiveWsUrl}</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CODE & CONFIG FILES */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Project Files & Code</h2>
                <p className="text-xs text-slate-400 mt-1">
                  All production assets required to run the proxy or deploy to Render.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(fileContent, `file-${selectedFile}`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  {copiedKey === `file-${selectedFile}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === `file-${selectedFile}` ? 'Copied' : 'Copy File'}</span>
                </button>
                <a
                  href={`/api/files/${selectedFile}?download=1`}
                  download={selectedFile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {selectedFile}</span>
                </a>
              </div>
            </div>

            {/* File Selector Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto text-xs">
              {(['server.js', 'render.yaml', 'package.json', 'Dockerfile', '.env.example', 'README.md'] as const).map(
                (fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setSelectedFile(fileName)}
                    className={`px-3 py-1.5 rounded-md font-mono transition-colors whitespace-nowrap ${
                      selectedFile === fileName
                        ? 'bg-slate-800 text-emerald-400 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fileName}
                  </button>
                )
              )}
            </div>

            {/* Code Box */}
            <div className="border border-slate-800 rounded-xl bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-400 font-mono">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>{selectedFile}</span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  {fileContent.split('\n').length} lines · UTF-8
                </div>
              </div>
              <pre className="p-4 overflow-x-auto text-xs text-slate-200 font-mono leading-relaxed max-h-[600px] selection:bg-emerald-500/20">
                <code>{loadingFile ? '// Loading file...' : fileContent}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 4: RENDER DEPLOYMENT GUIDE */}
        {activeTab === 'deploy' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Deploy to Render in 3 Steps</h2>
              <p className="text-sm text-slate-400 mt-1">
                Render offers free automatic SSL/TLS termination, which is mandatory because web browsers refuse to connect
                to insecure WebSockets (<code className="font-mono">ws://</code>) from HTTPS sites.
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-white">Push Code to GitHub or GitLab</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Initialize a git repo with <code className="text-emerald-400 font-mono">server.js</code>,{' '}
                      <code className="text-emerald-400 font-mono">render.yaml</code>, and{' '}
                      <code className="text-emerald-400 font-mono">package.json</code>, then push to GitHub.
                    </p>
                    <div className="bg-slate-950 p-3 rounded font-mono text-xs text-slate-300 space-y-1">
                      <div>git init</div>
                      <div>git add server.js render.yaml package.json README.md</div>
                      <div>git commit -m &quot;feat: Eaglercraft Minecraft TCP proxy&quot;</div>
                      <div>git remote add origin https://github.com/YOUR_USER/minecraft-proxy.git</div>
                      <div>git push -u origin main</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-white">Create Blueprint on Render</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Go to <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">dashboard.render.com</a>,
                      click <strong>New +</strong>, then select <strong>Blueprint</strong>.
                    </p>
                    <p className="text-xs text-slate-400">
                      Render will parse your <code className="text-emerald-400 font-mono">render.yaml</code> and pre-configure
                      the Web Service, health check, Node version, and environment variables.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-white">Configure Environment Variables</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Set your Minecraft server host and port under the Environment tab:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                        <span className="text-slate-400">TARGET_HOST:</span>{' '}
                        <span className="text-emerald-400">myserver.aternos.me</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                        <span className="text-slate-400">TARGET_PORT:</span>{' '}
                        <span className="text-emerald-400">25565</span> (or dynamic port)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Health-check feature note */}
            <div className="border border-emerald-500/30 rounded-xl bg-emerald-950/10 p-5 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Always-On Health-Check Configured</span>
              </div>
              <p>
                The proxy includes an integrated HTTP endpoint at <code className="text-emerald-300 font-mono">GET /</code> that
                returns <code className="text-emerald-300 font-mono">200 OK</code>. This matches the{' '}
                <code className="text-emerald-300 font-mono">healthCheckPath: /</code> in <code className="text-emerald-300 font-mono">render.yaml</code>,
                preventing Render health check failures and enabling uptime monitoring tools (such as UptimeRobot or BetterStack).
              </p>
            </div>
          </div>
        )}

        {/* TAB 5: ATERNOS GUIDE */}
        {activeTab === 'aternos' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Aternos Server Setup Guide</h2>
              <p className="text-sm text-slate-400 mt-1">
                Because Eaglercraft runs in a web browser, it uses cracked offline authentication and connects over WebSockets.
                Here are the specific settings to make Aternos work with this proxy:
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Step 1: Enable &quot;Cracked&quot; in Aternos</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Go to <strong>Options</strong> on your Aternos dashboard. Turn <strong>Cracked: ON</strong>.
                </p>
                <div className="text-xs text-amber-300 bg-amber-950/20 border border-amber-500/30 p-3 rounded">
                  Why? Official Minecraft accounts authenticate via Microsoft OAuth with Mojang auth servers. Browser-based
                  Eaglercraft clients cannot access standard Mojang auth tokens, so your server must accept cracked clients.
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Step 2: Check Your Dynamic Port</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  When starting an Aternos server, click on <strong>Connect</strong> to see your DynIP and port:
                </p>
                <div className="bg-slate-950 p-3 rounded font-mono text-xs text-slate-300">
                  <div>Example Address: stone.aternos.me:38472</div>
                  <div className="text-slate-500 mt-1">
                    &bull; TARGET_HOST = stone.aternos.me<br />
                    &bull; TARGET_PORT = 38472 (Notice: NOT 25565)
                  </div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Step 3: Compatible Minecraft Versions</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Most Eaglercraft clients run on protocol versions 1.5.2 or 1.8.8. For best compatibility:
                </p>
                <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                  <li>Use Paper or Spigot 1.8.8 if using Eaglercraft 1.8.8</li>
                  <li>Or install <strong>ViaVersion</strong> and <strong>ViaBackwards</strong> plugins on newer servers (1.20+) to allow 1.8 clients to join</li>
                  <li>Or use <strong>EaglerXBungee</strong> plugin for BungeeCord/Waterfall networks</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: LIVE CONSOLE LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Live Event Log</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Real-time connection, disconnection, TCP bridge, and error events logged by the proxy engine.
                </p>
              </div>
              <button
                onClick={fetchStatus}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-950 p-4 font-mono text-xs max-h-[600px] overflow-y-auto space-y-2">
              {status?.recentLogs && status.recentLogs.length > 0 ? (
                status.recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-1 border-b border-slate-900/80 last:border-0">
                    <span className="text-slate-500 shrink-0 text-[11px] tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`uppercase text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                        log.type === 'connect'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : log.type === 'disconnect'
                          ? 'bg-slate-800 text-slate-300'
                          : log.type === 'error'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {log.type}
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 py-8 text-center">
                  No connection events recorded yet. Connect an Eaglercraft client to generate live traffic.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>Eaglercraft Minecraft TCP &harr; WebSocket Proxy · MIT License</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Node.js net + ws</span>
            <span aria-hidden="true">·</span>
            <span>Render Blueprint Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
