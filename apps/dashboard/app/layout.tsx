import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '../components/Toast';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HoloMem — Encrypted memory for AI agents',
  description: 'Encrypted, auto-expiring, on-chain memory mesh for autonomous AI agent swarms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#060606] text-white antialiased font-sans">
        {/* Ambient orbs — subtle on landing, visible on inner pages */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
          <div className="absolute -top-60 -left-60 w-[800px] h-[800px] bg-violet-700/[0.07] rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-60 w-[600px] h-[600px] bg-violet-500/[0.05] rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] bg-indigo-600/[0.06] rounded-full blur-3xl" />
        </div>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
