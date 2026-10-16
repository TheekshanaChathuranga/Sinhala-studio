'use client';

import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { TimelineIssue } from '@/lib/types';

interface ValidationBadgeProps {
  issues: TimelineIssue[];
  compact?: boolean;
}

export default function ValidationBadge({ issues, compact = false }: ValidationBadgeProps) {
  if (!issues || issues.length === 0) return null;

  const hasError = issues.some((i) => i.severity === 'error');
  const Icon = hasError ? AlertCircle : AlertTriangle;

  if (compact) {
    return (
      <span
        title={issues.map((i) => i.message).join('\n')}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
          hasError
            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
        }`}
      >
        <Icon className="w-3 h-3" />
        <span>{issues.length}</span>
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {issues.map((issue, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-1.5 text-xs px-2 py-1 rounded ${
            issue.severity === 'error'
              ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
              : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
          }`}
        >
          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}
