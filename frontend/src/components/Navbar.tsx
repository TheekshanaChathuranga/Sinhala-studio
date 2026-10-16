'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, PlusCircle, FolderHeart } from 'lucide-react';
import { fetchHealth } from '@/lib/api';

export default function Navbar() {
  const pathname = usePathname();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetchHealth()
      .then((res) => setApiOnline(res?.status === 'healthy'))
      .catch(() => setApiOnline(false));
  }, []);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/upload', label: 'New Project', icon: PlusCircle },
    { href: '/projects', label: 'Projects', icon: FolderHeart },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                Sinhala Studio
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded">
                CapCut AI
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block -mt-1 font-medium sinhala-text">
              සිංහල වීඩියෝ සංස්කාරකය
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-300 hover:text-white hover:bg-surface-elevated'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* System status pill */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5 rounded-full bg-surface-elevated border border-border">
          <span
            className={`w-2 h-2 rounded-full ${
              apiOnline === true
                ? 'bg-emerald-400 animate-pulse'
                : apiOnline === false
                ? 'bg-rose-500'
                : 'bg-amber-400'
            }`}
          />
          <span>
            {apiOnline === true ? 'Video Engine Ready' : apiOnline === false ? 'API Offline' : 'Connecting...'}
          </span>
        </div>
      </div>
    </header>
  );
}
