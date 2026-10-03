'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plane, LayoutDashboard, Table, Activity, Server } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Navigation() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<{ server: boolean; db: boolean } | null>(null);

  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

  useEffect(() => {
    let isMounted = true;
    const checkApi = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/health`, { cache: 'no-store' });
        const isServerUp = res.status === 200 || res.status === 503;
        let isDbUp = false;
        if (isServerUp) {
          try {
            const data = await res.json();
            isDbUp = data?.database?.status === 'connected';
          } catch { }
        }
        if (isMounted) setApiStatus({ server: isServerUp, db: isDbUp });
      } catch {
        if (isMounted) setApiStatus({ server: false, db: false });
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiBaseUrl]);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/flights', label: 'Flight Operations', icon: Table },
    { href: '/diagnostics', label: 'Diagnostics', icon: Activity },
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 py-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="p-2 bg-slate-900 text-white rounded-lg shadow-sm">
                <Plane className="w-4 h-4" />
              </div>
              <div>
                <span className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  AirOps
                </span>
                <span className="block text-[11px] text-slate-500 font-normal">Operations Platform</span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors ${isActive
                      ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* System Status Pill */}
          <div className="flex items-center gap-3">
            <Link
              href="/diagnostics"
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono hover:bg-slate-100 transition-colors"
            >
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 hidden sm:inline">API:</span>
              <span className={`font-semibold ${apiStatus?.server
                ? 'text-emerald-700'
                : apiStatus?.server === false
                  ? 'text-rose-700'
                  : 'text-slate-500'
                }`}>
                {apiStatus?.server ? 'ONLINE' : apiStatus?.server === false ? 'OFFLINE' : 'CHECKING'}
              </span>

              <span className="text-slate-300">|</span>

              <span className="text-slate-600 hidden sm:inline">DB:</span>
              <span className={`font-semibold ${apiStatus?.db
                ? 'text-emerald-700'
                : 'text-amber-700'
                }`}>
                {apiStatus?.db ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
