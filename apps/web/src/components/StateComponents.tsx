/**
 * Reusable State Components
 *
 * Loading, Error, Empty, and Skeleton components for consistent
 * failure handling across the application
 */

import React from 'react';
import { RefreshCw, AlertCircle, AlertTriangle, Wifi, Clock, Inbox, XCircle, ChevronRight } from 'lucide-react';

/**
 * Loading Skeleton - Animated placeholder
 */
export interface SkeletonProps {
  /** Number of skeleton rows/items */
  count?: number;
  /** Component variant */
  variant?: 'card' | 'table-row' | 'metric' | 'list-item';
}

export function Skeleton({ count = 3, variant = 'card' }: SkeletonProps) {
  const items = Array.from({ length: count });

  return (
    <>
      {items.map((_, i) => (
        <div key={i} className="animate-pulse">
          {variant === 'metric' && (
            <div className="rounded-lg bg-slate-200 h-24 mb-4" />
          )}
          {variant === 'table-row' && (
            <div className="h-12 bg-slate-100 rounded mb-2" />
          )}
          {variant === 'card' && (
            <>
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </>
          )}
          {variant === 'list-item' && (
            <>
              <div className="h-4 bg-slate-200 rounded mb-1" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
            </>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * Loading State
 */
export interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Show spinner */
  spinner?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  message = 'Loading...',
  spinner = true,
  size = 'md',
}: LoadingStateProps) {
  const spinnerSize =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-sm' : 'text-sm';
  const containerPadding =
    size === 'sm' ? 'py-2' : size === 'lg' ? 'py-12' : 'py-6';

  return (
    <div className={`text-center text-slate-500 ${containerPadding}`}>
      {spinner && (
        <RefreshCw
          className={`${spinnerSize} animate-spin mx-auto mb-2 text-slate-600`}
        />
      )}
      <p className={`${textSize} font-mono`}>{message}</p>
    </div>
  );
}

/**
 * Error State
 */
export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message/description */
  message?: string;
  /** Error type for icon selection */
  type?: 'server' | 'timeout' | 'network' | 'unavailable' | 'generic';
  /** Retry callback */
  onRetry?: () => void;
  /** Additional actions */
  actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'secondary' }>;
  /** Show detailed error */
  details?: string;
}

export function ErrorState({
  title = 'Error',
  message = 'Something went wrong',
  type = 'generic',
  onRetry,
  actions = [],
  details,
}: ErrorStateProps) {
  // Select icon based on error type
  const Icon =
    type === 'timeout'
      ? Clock
      : type === 'network'
        ? Wifi
        : type === 'unavailable'
          ? AlertTriangle
          : type === 'server'
            ? AlertCircle
            : XCircle;

  const bgColor =
    type === 'unavailable' ? 'bg-orange-50' : 'bg-rose-50';
  const borderColor =
    type === 'unavailable' ? 'border-orange-200' : 'border-rose-200';
  const iconColor =
    type === 'unavailable' ? 'text-orange-600' : 'text-rose-600';
  const textColor =
    type === 'unavailable' ? 'text-orange-900' : 'text-rose-900';

  return (
    <div
      className={`p-4 rounded-lg border ${borderColor} ${bgColor} ${textColor} text-sm space-y-3`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1">{title}</h3>
          <p className="text-xs leading-relaxed">{message}</p>
          {details && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-mono opacity-75 hover:opacity-100">
                Details
              </summary>
              <pre className="mt-1 text-xs bg-black/5 p-2 rounded font-mono overflow-auto max-h-32">
                {details}
              </pre>
            </details>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {(onRetry || actions.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-current/10">
          {onRetry && (
            <button
              onClick={onRetry}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                type === 'unavailable'
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              Retry
            </button>
          )}
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                action.variant === 'primary'
                  ? type === 'unavailable'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-current/10 hover:bg-current/20 text-current'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Empty State
 */
export interface EmptyStateProps {
  /** Empty state title */
  title?: string;
  /** Empty state message */
  message?: string;
  /** Empty state type for icon/styling */
  type?: 'no-results' | 'no-data' | 'no-items' | 'filtered';
  /** Primary action */
  action?: { label: string; onClick: () => void };
  /** Secondary action */
  secondaryAction?: { label: string; onClick: () => void };
  /** Icon to display */
  Icon?: React.ReactNode;
}

export function EmptyState({
  title = 'No Results',
  message = 'Nothing to display',
  type = 'no-results',
  action,
  secondaryAction,
  Icon,
}: EmptyStateProps) {
  // Default icons
  const DefaultIcon =
    type === 'no-data' ? AlertCircle : type === 'filtered' ? Filter : Inbox;

  return (
    <div className="py-12 text-center space-y-4">
      <div className="flex justify-center mb-4">
        {Icon ? (
          Icon
        ) : (
          <DefaultIcon className="w-8 h-8 text-slate-400" />
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          {title}
        </h3>
        <p className="text-xs text-slate-500">{message}</p>
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-white text-slate-900 border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Metric Skeleton - Loading state for dashboard metrics
 */
export function MetricSkeleton() {
  return (
    <div className="rounded-lg bg-slate-100 border border-slate-200 p-6 animate-pulse space-y-3">
      <div className="h-3 bg-slate-200 rounded w-1/3" />
      <div className="h-8 bg-slate-200 rounded w-1/2" />
      <div className="h-2 bg-slate-200 rounded w-1/4" />
    </div>
  );
}

/**
 * Table Row Skeleton - Loading state for table rows
 */
export function TableRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-100">
          <td className="py-3 px-4">
            <div className="h-3 bg-slate-200 rounded w-3/4" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3 bg-slate-200 rounded w-1/3" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </td>
          <td className="py-3 px-4">
            <div className="h-3 bg-slate-200 rounded w-1/4" />
          </td>
        </tr>
      ))}
    </>
  );
}

/**
 * Inline error - Compact error for specific form field or widget
 */
export interface InlineErrorProps {
  message: string;
  onDismiss?: () => void;
}

export function InlineError({ message, onDismiss }: InlineErrorProps) {
  return (
    <div className="p-2 rounded text-xs bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        {message}
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-rose-600 hover:text-rose-900 font-semibold"
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Partial Error - When part of a page fails but rest is OK
 */
export interface PartialErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function PartialError({
  title = 'Widget Unavailable',
  message = 'This section could not be loaded',
  onRetry,
}: PartialErrorProps) {
  return (
    <div className="p-6 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 text-center space-y-3">
      <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Progress indicator for loading
 */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 transition-all duration-300"
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

// Missing import
function Filter() {
  return <Inbox className="w-8 h-8 text-slate-400" />;
}
