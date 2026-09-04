import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import QueryProvider from '@/components/QueryProvider';

export const metadata: Metadata = {
  title: 'AirOps - Enterprise Airline Operations Center',
  description: 'Production-realistic airline operations dashboard built for performance, load testing, and scalability.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-slate-900 selection:text-white flex flex-col">
        <Navigation />
        <QueryProvider>
          <div className="flex-1">
            {children}
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
