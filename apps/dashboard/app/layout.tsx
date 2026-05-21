import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HoloMem',
  description: 'Encrypted memory for AI agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-white antialiased">
        {/* Global background orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -left-40 w-[700px] h-[700px] bg-violet-700/15 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -right-60 w-[500px] h-[500px] bg-violet-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>
        {children}
      </body>
    </html>
  );
}
