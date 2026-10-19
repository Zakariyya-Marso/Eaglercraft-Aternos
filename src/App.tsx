import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Wifi,
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
  ChevronRight,
  Sparkles,
  Bookmark,
  Trash2,
  Gamepad2
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

interface SavedServer {
  id: string;
  host: string;
  port: number;
  label?: string;
  timestamp: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'overview' | 'tester' | 'files' | 'deploy' | 'aternos' | 'logs'>('generator');
  const [status, setStatus] = useState<ProxyStatus | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Custom WSS Generator State
  const [customHost, setCustomHost] = useState('stone.aternos.me');
  const [customPort, setCustomPort] = useState('38472');
  const [proxyDomain, setProxyDomain] = useState('');
  const [urlFormat, setUrlFormat] = useState<'colon' | 'slash' | 'query'>('colon');
  const [serverLabel, setServerLabel] = useState('');

  // Live Ping/Test state for Generator
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<TestResult | null>(null);

  // Dedicated Tester Tab State
  const [testHost, setTestHost] = useState('myserver.aternos.me');
  const [testPort, setTestPort] = useState('25565');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // File Viewer State
  const [selectedFile, setSelectedFile] = useState<
    'render.yaml' | 'package.json' | 'deploy-package.json' | 'server.js' | 'Dockerfile' | '.env.example' | 'README.md'
  >('render.yaml');
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);

  // Saved Custom Servers in localStorage
  const [savedServers, setSavedServers] = useState<SavedServer[]>(() => {
    try {
      const stored = localStorage.getItem('eagler_proxy_saved_servers');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { id: '1', host: 'stone.aternos.me', port: 38472, label: 'My Aternos Survival', timestamp: Date.now() },
      { id: '2', host: 'mc.hypixel.net', port: 25565, label: 'Hypixel Network', timestamp: Date.now() - 3600000 },
    ];
  });

  // Automatically initialize proxyDomain from window.location
  useEffect(() => {
    if (typeof window !== 'undefined' && !proxyDomain) {
      setProxyDomain(window.location.host);
    }
  }, []);

  // Save servers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eagler_proxy_saved_servers', JSON.stringify(savedServers));
    } catch {}
  }, [savedServers]);

  // Fetch status on interval
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/proxy/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch proxy status:', e);
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

  // Ping verification directly inside Generator
  const handlePingServer = async (hostToTest: string, portToTest: string) => {
    if (!hostToTest.trim() || !portToTest.trim()) return;
    setIsPinging(true);
    setPingResult(null);

    try {
      const res = await fetch('/api/proxy/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: hostToTest.trim(),
          port: parseInt(portToTest.trim(), 10) || 25565,
          timeoutMs: 6000,
        }),
      });
      const data = await res.json();
      setPingResult(data);
    } catch (err: any) {
      setPingResult({
        success: false,
        host: hostToTest,
        port: parseInt(portToTest, 10) || 25565,
        error: err.message || 'Network error reaching server.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsPinging(false);
    }
  };

  // Dedicated Tab Ping Test
  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testHost || !testPort) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/proxy/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: testHost.trim(), port: parseInt(testPort.trim(), 10), timeoutMs: 6000 }),
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

  const handleSaveCurrentServer = () => {
    if (!customHost.trim()) return;
    const p = parseInt(customPort.trim(), 10) || 25565;
    const newEntry: SavedServer = {
      id: Math.random().toString(36).substring(2, 9),
      host: customHost.trim(),
      port: p,
      label: serverLabel.trim() || `${customHost.trim()}:${p}`,
      timestamp: Date.now(),
    };
    setSavedServers((prev) => [newEntry, ...prev.filter((s) => s.host !== customHost.trim() || s.port !== p)]);
    setServerLabel('');
  };

  const handleDeleteSavedServer = (id: string) => {
    setSavedServers((prev) => prev.filter((s) => s.id !== id));
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

  // Compute Active Protocol & Host
  const isHttps = typeof window !== 'undefined' ? window.location.protocol === 'https:' : true;
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
  const effectiveProxyHost = proxyDomain.trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/+$/, '') || currentHost;
  const wsScheme = isHttps ? 'wss://' : 'ws://';

  // Compute Custom WSS URL according to selected format
  const sanitizedTargetHost = customHost.trim() || 'stone.aternos.me';
  const sanitizedTargetPort = customPort.trim() || '25565';

  const getCustomWssUrl = (format: 'colon' | 'slash' | 'query') => {
    if (format === 'colon') {
      return `${wsScheme}${effectiveProxyHost}/${sanitizedTargetHost}:${sanitizedTargetPort}`;
    }
    if (format === 'slash') {
      return `${wsScheme}${effectiveProxyHost}/${sanitizedTargetHost}/${sanitizedTargetPort}`;
    }
    return `${wsScheme}${effectiveProxyHost}/?target=${sanitizedTargetHost}:${sanitizedTargetPort}`;
  };

  const activeWssUrl = getCustomWssUrl(urlFormat);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Bar Contract (1-line wordmark, 4-5 text links, 1 primary action) */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
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
              onClick={() => setActiveTab('generator')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'generator' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>WSS Generator</span>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'overview' ? 'text-emerald-400 font-semibold' : ''
              }`}
            >
              Overview & Status
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
              Code & Deploy Files
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
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => copyToClipboard(activeWssUrl, 'top-bar-custom-url')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-emerald-500/20 active:scale-[0.98]"
            >
              {copiedKey === 'top-bar-custom-url' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied WSS URL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Custom WSS</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center gap-2 px-4 py-2 border-t border-slate-800/60 overflow-x-auto text-xs">
          {(['generator', 'overview', 'tester', 'files', 'deploy', 'aternos', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md capitalize whitespace-nowrap ${
                activeTab === tab ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400'
              }`}
            >
              {tab === 'generator' ? 'WSS Generator' : tab === 'files' ? 'Code' : tab}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: CUSTOM WSS GENERATOR (PRIMARY REQUEST) */}
        {activeTab === 'generator' && (
          <div className="space-y-8">
            {/* Header intro */}
            <div className="border border-slate-800/80 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/30 p-6 sm:p-8">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                  <span>Universal Eaglercraft Bridge</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-400 font-mono">Dynamic On-Demand Routing</span>
                  <span aria-hidden="true">·</span>
                  <span>No Server Restart Required</span>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
                  Minecraft IP to Custom WSS Generator
                </h1>
                <p className="mt-2 text-slate-300 text-sm sm:text-base leading-relaxed">
                  Enter any Minecraft server IP or domain and port below. The proxy will dynamically route your browser&apos;s
                  WebSocket connection straight to that Minecraft server in real time.
                </p>
              </div>
            </div>

            {/* Generator Form & Output Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Input Form (7 Cols) */}
              <div className="lg:col-span-7 border border-slate-800/80 rounded-xl bg-slate-900/40 p-6 space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    <span>1. Enter Your Minecraft Server Details</span>
                  </h2>
                  <div className="text-[11px] text-slate-400">Vanilla · Aternos · Paper · Spigot</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Minecraft Hostname or IP Address
                    </label>
                    <input
                      type="text"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                      placeholder="e.g. stone.aternos.me or mc.hypixel.net"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Works with any Aternos domain or numeric IP (e.g. <code>123.45.67.89</code>).
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Minecraft TCP Port
                    </label>
                    <input
                      type="number"
                      value={customPort}
                      onChange={(e) => setCustomPort(e.target.value)}
                      placeholder="25565"
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-950 border border-slate-700/80 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <div className="text-[11px] text-slate-500 mt-1">
                      Standard: <code>25565</code>; Aternos uses dynamic ports like <code>38472</code>.
                    </div>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400">
                  <span className="text-slate-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomHost('stone.aternos.me');
                      setCustomPort('38472');
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
                  >
                    Aternos Sample (38472)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomHost('mc.hypixel.net');
                      setCustomPort('25565');
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
                  >
                    Hypixel (25565)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomHost('127.0.0.1');
                      setCustomPort('25565');
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
                  >
                    Localhost (25565)
                  </button>
                </div>

                {/* Optional Proxy Domain Config */}
                <div className="pt-4 border-t border-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      <span>Proxy Hosting Domain (Render / VPS / AI Studio)</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Auto-detected from browser</span>
                  </div>
                  <input
                    type="text"
                    value={proxyDomain}
                    onChange={(e) => setProxyDomain(e.target.value)}
                    placeholder="e.g. eaglercraft-minecraft-proxy.onrender.com"
                    className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <div className="text-[11px] text-slate-500">
                    If deployed on Render, type your Render URL (e.g. <code>my-service.onrender.com</code>) to generate matching Render WSS links.
                  </div>
                </div>

                {/* Optional Save to List */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={serverLabel}
                    onChange={(e) => setServerLabel(e.target.value)}
                    placeholder="Optional label (e.g. My Survival World)"
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-slate-300"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCurrentServer}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Save Server</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Generated WSS Result & Copy (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Resulting Address Box */}
                <div className="border border-emerald-500/40 rounded-xl bg-gradient-to-b from-emerald-950/20 to-slate-900/60 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Your Custom WSS Address</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Ready for Eaglercraft</span>
                  </div>

                  {/* Format Selector */}
                  <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setUrlFormat('colon')}
                      className={`flex-1 py-1 px-2 rounded font-mono transition-colors ${
                        urlFormat === 'colon' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400'
                      }`}
                      title="/host:port format"
                    >
                      /host:port
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlFormat('slash')}
                      className={`flex-1 py-1 px-2 rounded font-mono transition-colors ${
                        urlFormat === 'slash' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400'
                      }`}
                      title="/host/port format"
                    >
                      /host/port
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlFormat('query')}
                      className={`flex-1 py-1 px-2 rounded font-mono transition-colors ${
                        urlFormat === 'query' ? 'bg-slate-800 text-emerald-400 font-semibold' : 'text-slate-400'
                      }`}
                      title="?target=host:port format"
                    >
                      ?target=
                    </button>
                  </div>

                  {/* The Address Display */}
                  <div className="p-3.5 bg-slate-950 rounded-lg border border-emerald-500/30 text-emerald-300 font-mono text-xs sm:text-sm break-all select-all font-semibold shadow-inner">
                    {activeWssUrl}
                  </div>

                  {/* Big Copy Button & Ping Button */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeWssUrl, 'main-custom-url')}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors shadow-sm shadow-emerald-500/20 active:scale-[0.98]"
                    >
                      {copiedKey === 'main-custom-url' ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Copied Address!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isPinging}
                      onClick={() => handlePingServer(customHost, customPort)}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs disabled:opacity-50 transition-colors"
                    >
                      {isPinging ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{isPinging ? 'Pinging TCP...' : 'Ping Minecraft IP'}</span>
                    </button>
                  </div>

                  {/* Real-time Ping Diagnostic Result */}
                  {pingResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs space-y-1 ${
                        pingResult.success
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                          : 'border-red-500/40 bg-red-950/30 text-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          {pingResult.success ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                          <span>{pingResult.success ? 'Server Online' : 'Server Unreachable'}</span>
                        </span>
                        {pingResult.latencyMs !== undefined && (
                          <span className="font-mono tabular-nums text-[11px] bg-slate-900 px-1.5 py-0.5 rounded">
                            {pingResult.latencyMs}ms latency
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-normal">
                        {pingResult.message || pingResult.error}
                      </p>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                    <strong>Where to paste:</strong> Open Eaglercraft $\rightarrow$ Multiplayer $\rightarrow$ Add Server $\rightarrow$ paste into <strong>Server Address</strong>.
                  </div>
                </div>

                {/* Saved Custom Servers List */}
                {savedServers.length > 0 && (
                  <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Saved / Recent Servers</span>
                      <span className="text-[11px] text-slate-500">{savedServers.length} saved</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {savedServers.map((serverItem) => (
                        <div
                          key={serverItem.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs hover:border-slate-700 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setCustomHost(serverItem.host);
                              setCustomPort(serverItem.port.toString());
                              setPingResult(null);
                            }}
                            className="text-left flex-1 truncate mr-2"
                          >
                            <div className="font-medium text-white truncate">{serverItem.label || serverItem.host}</div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {serverItem.host}:{serverItem.port}
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const url = `${wsScheme}${effectiveProxyHost}/${serverItem.host}:${serverItem.port}`;
                                copyToClipboard(url, `saved-${serverItem.id}`);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                              title="Copy WSS"
                            >
                              {copiedKey === `saved-${serverItem.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedServer(serverItem.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* In-Game Minecraft Simulator / Visual Guide */}
            <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-white flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                <span>How to Add This Address in Eaglercraft</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Visual Simulator of Minecraft UI */}
                <div className="border-2 border-slate-700 bg-slate-900 rounded-lg p-5 font-mono shadow-2xl space-y-4">
                  <div className="text-center font-bold text-sm text-slate-200 tracking-wide">
                    Edit Server Info
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Server Name</label>
                    <div className="w-full bg-black border border-slate-600 px-3 py-1.5 text-xs text-white">
                      {serverLabel.trim() || 'My Minecraft Server'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-emerald-400 font-bold">Server Address (Paste Custom WSS Here)</label>
                    <div className="w-full bg-black border-2 border-emerald-500 px-3 py-2 text-xs text-emerald-300 break-all select-all font-semibold">
                      {activeWssUrl}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <div className="flex-1 bg-slate-800 border border-slate-600 text-center py-1.5 text-xs text-slate-200 font-bold shadow">
                      Done
                    </div>
                    <div className="flex-1 bg-slate-800 border border-slate-600 text-center py-1.5 text-xs text-slate-400 shadow">
                      Cancel
                    </div>
                  </div>
                </div>

                {/* Step Checklist */}
                <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      1
                    </span>
                    <p>
                      In Eaglercraft (browser client), click <strong>Multiplayer</strong>, then click <strong>Add Server</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      2
                    </span>
                    <p>
                      Paste the generated WSS address into <strong>Server Address</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      3
                    </span>
                    <p>
                      Click <strong>Done</strong>. Select your server from the multiplayer list and click <strong>Join Server</strong>!
                    </p>
                  </div>
                  <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-amber-200 text-[11px]">
                    <strong>Server requirements:</strong> Ensure your Minecraft server has <strong>Cracked: ON</strong> (or <code>online-mode=false</code> in server.properties) because browser clients cannot authenticate with official Mojang accounts.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OVERVIEW & STATUS */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Metrics KPI Row with tabular figures */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-slate-800/80 rounded-xl bg-slate-900/40 p-4">
                <div className="flex items-center justify-between text-slate-400 mb-1 text-xs">
                  <span>Default Fallback</span>
                  <Server className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-white font-mono truncate">
                  {status ? `${status.targetHost}:${status.targetPort}` : 'Loading...'}
                </div>
                <div className="text-xs text-slate-500 mt-1">When no URL target specified</div>
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
                Dynamic Bi-Directional Relay Architecture
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Step 1: Eaglercraft */}
                <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
                  <div className="text-xs text-emerald-400 font-mono mb-1">Browser Client</div>
                  <h3 className="text-base font-bold text-white">Eaglercraft 1.8.8</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Connects using standard WebSockets. Passes target IP & port directly in URL path or query!
                  </p>
                  <div className="mt-3 text-xs font-mono bg-slate-900/90 px-2.5 py-1.5 rounded text-slate-300 break-all">
                    {wsScheme}{effectiveProxyHost}/&lt;target-ip&gt;:&lt;port&gt;
                  </div>
                </div>

                {/* Step 2: This Node.js Proxy */}
                <div className="border border-emerald-500/40 bg-emerald-950/10 rounded-xl p-4 relative">
                  <div className="text-xs text-emerald-400 font-mono mb-1">Dynamic Node.js Stream Relay</div>
                  <h3 className="text-base font-bold text-white">EaglerProxy (server.js)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Extracts requested destination Minecraft IP & port from the URL. Opens an unbuffered raw TCP stream.
                  </p>
                  <div className="mt-3 text-xs font-mono bg-slate-900/90 px-2.5 py-1.5 rounded text-emerald-400">
                    parseTargetFromRequest() + net.createConnection()
                  </div>
                </div>

                {/* Step 3: Target Minecraft Server */}
                <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4">
                  <div className="text-xs text-slate-400 font-mono mb-1">Target Host</div>
                  <h3 className="text-base font-bold text-white">Any Minecraft TCP Server</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Receives pristine, unbuffered TCP Minecraft packets. Works with Aternos, Hypixel, and Vanilla.
                  </p>
                  <div className="mt-3 text-xs font-mono bg-slate-900/90 px-2.5 py-1.5 rounded text-slate-300 break-all">
                    {customHost}:{customPort}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SERVER TESTER */}
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
                      setTestHost('stone.aternos.me');
                      setTestPort('38472');
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
                          <strong>Custom WSS Address for this Server:</strong>
                        </div>
                        <div className="font-mono text-emerald-400 bg-slate-950/80 p-2 rounded border border-emerald-500/30 select-all">
                          {wsScheme}{effectiveProxyHost}/{testResult.host}:{testResult.port}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CODE & DEPLOY FILES */}
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
              {(['render.yaml', 'package.json', 'deploy-package.json', 'server.js', 'Dockerfile', '.env.example', 'README.md'] as const).map(
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

        {/* TAB 5: RENDER DEPLOY */}
        {activeTab === 'deploy' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Deploy to Render in 3 Steps</h2>
              <p className="text-sm text-slate-400 mt-1">
                Once deployed on Render, your proxy URL (e.g. <code>https://my-proxy.onrender.com</code>) will automatically
                support ANY player typing their IP/port to get custom WSS addresses!
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-2">
                <h3 className="text-base font-semibold text-white">1. Push Code to GitHub</h3>
                <p className="text-xs text-slate-300">
                  Push <code className="text-emerald-400 font-mono">server.js</code>,{' '}
                  <code className="text-emerald-400 font-mono">render.yaml</code>, and{' '}
                  <code className="text-emerald-400 font-mono">package.json</code> to your GitHub repository.
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-2">
                <h3 className="text-base font-semibold text-white">2. Deploy Blueprint on Render</h3>
                <p className="text-xs text-slate-300">
                  In Render Dashboard, click <strong>New +</strong> $\rightarrow$ <strong>Blueprint</strong> and connect your repository.
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-2">
                <h3 className="text-base font-semibold text-white">3. Share Custom WSS with Players</h3>
                <p className="text-xs text-slate-300">
                  Tell your players to visit your site or connect directly using:
                </p>
                <div className="bg-slate-950 p-2.5 rounded font-mono text-emerald-400 text-xs select-all">
                  wss://YOUR_RENDER_SERVICE.onrender.com/stone.aternos.me:38472
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ATERNOS GUIDE */}
        {activeTab === 'aternos' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Aternos Server Configuration</h2>
              <p className="text-sm text-slate-400 mt-1">
                Aternos works seamlessly with this proxy as long as you follow these two rules:
              </p>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-2">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Rule 1: Turn &quot;Cracked: ON&quot; in Aternos Options</span>
                </h3>
                <p className="text-xs text-slate-300">
                  Browser Eaglercraft clients cannot authenticate with Microsoft/Mojang OAuth servers.
                  Turning Cracked ON allows browser clients to connect offline.
                </p>
              </div>

              <div className="border border-slate-800 rounded-xl bg-slate-900/40 p-5 space-y-2">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Rule 2: Copy the Dynamic Port, NOT 25565</span>
                </h3>
                <p className="text-xs text-slate-300">
                  When starting your server, click the <strong>Connect</strong> button on Aternos. It will display a dynamic port (e.g. <code>stone.aternos.me:38472</code>).
                  Enter that exact port into the WSS Generator!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: LIVE LOGS */}
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
          <div>EaglerProxy · Dynamic Minecraft TCP &harr; WebSocket Bridge</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Dynamic URL Routing</span>
            <span aria-hidden="true">·</span>
            <span>Render Blueprint Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
