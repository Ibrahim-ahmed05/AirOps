'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Database, 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Clock
} from 'lucide-react';

interface HealthData {
  status: 'ok' | 'degraded' | string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'connected' | 'disconnected' | string;
    latencyMs: number | null;
    error?: string;
  };
}

export default function DiagnosticsPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

  const checkHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/health`, { cache: 'no-store' });
      if (!res.ok && res.status !== 503) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      const data: HealthData = await res.json();
      setHealth(data);
      setLastCheck(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to reach API server');
      setHealth(null);
      setLastCheck(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    checkHealth();
    if (!autoRefresh) return;
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [checkHealth, autoRefresh]);

  const isApiConnected = health !== null && !error;
  const isDbConnected = health?.database?.status === 'connected';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-800" /> System Diagnostics
          </h1>
          <p className="text-xs text-slate-500 mt-1">Backend API ping test, PostgreSQL connection latency, and process metrics.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-3 py-1.5 rounded-md border transition-colors flex items-center gap-1.5 font-medium shadow-2xs ${
              autoRefresh
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {autoRefresh ? 'Auto-refresh (5s)' : 'Auto-refresh Off'}
          </button>

          <button
            onClick={checkHealth}
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Check Now
          </button>
        </div>
      </div>

      {/* Diagnostics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Fastify API Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-700" /> Fastify API Server
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${
              isApiConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {isApiConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {isApiConnected ? 'Reachable' : 'Unreachable'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Endpoint</span>
              <span className="font-mono text-slate-900 font-medium">{apiBaseUrl}/health</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Process Uptime</span>
              <span className="font-mono text-slate-900 font-medium">{health?.uptimeSeconds !== undefined ? `${health.uptimeSeconds}s` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* PostgreSQL DB Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-700" /> PostgreSQL Database
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border ${
              isDbConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {isDbConnected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {isDbConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Engine</span>
              <span className="font-mono text-slate-900 font-medium">PostgreSQL 16</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ORM</span>
              <span className="font-mono text-slate-900 font-medium">Drizzle ORM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Query Latency</span>
              <span className="font-mono text-slate-900 font-medium">{health?.database?.latencyMs !== null && health?.database?.latencyMs !== undefined ? `${health.database.latencyMs} ms` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Payload Output */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>JSON Response</span>
            <span className="font-mono text-slate-400">{lastCheck || 'Checking...'}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-md border border-slate-200 text-xs font-mono overflow-x-auto max-h-48">
            {health ? (
              <pre className="text-slate-800 whitespace-pre-wrap">{JSON.stringify(health, null, 2)}</pre>
            ) : error ? (
              <div className="text-rose-700">{error}</div>
            ) : (
              <div className="text-slate-400">Connecting...</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
