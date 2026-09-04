import React from 'react';

export type FlightStatus = 'SCHEDULED' | 'BOARDING' | 'DEPARTED' | 'DELAYED' | 'ARRIVED' | 'CANCELLED' | string;
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;

interface StatusBadgeProps {
  status: FlightStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const upper = (status || '').toUpperCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (upper) {
    case 'SCHEDULED':
      styles = 'bg-blue-50 text-blue-700 border-blue-200';
      break;
    case 'BOARDING':
      styles = 'bg-purple-50 text-purple-700 border-purple-200';
      break;
    case 'DEPARTED':
      styles = 'bg-sky-50 text-sky-700 border-sky-200';
      break;
    case 'DELAYED':
      styles = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold';
      break;
    case 'ARRIVED':
      styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'CANCELLED':
      styles = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
      break;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center rounded-md border font-mono uppercase tracking-wide ${sizeClasses} ${styles}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-75" />
      {upper}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const upper = (severity || '').toUpperCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  switch (upper) {
    case 'LOW':
      styles = 'bg-slate-100 text-slate-600 border-slate-200';
      break;
    case 'MEDIUM':
      styles = 'bg-amber-50 text-amber-800 border-amber-200';
      break;
    case 'HIGH':
      styles = 'bg-orange-50 text-orange-800 border-orange-200 font-medium';
      break;
    case 'CRITICAL':
      styles = 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono uppercase tracking-wider ${styles}`}>
      {upper}
    </span>
  );
}
