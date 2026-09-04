'use client';

/**
 * QueryProvider
 *
 * Wraps the app in TanStack Query's QueryClientProvider.
 * Must be a client component because QueryClient uses browser APIs.
 * The QueryClient instance is created once per browser session.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
