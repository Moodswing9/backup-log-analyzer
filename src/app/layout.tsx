import type { Metadata } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Backup Log Analyzer',
  description: 'Paste any backup or infrastructure log — Claude identifies errors, root causes, and fix commands in seconds.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full`}>
      <body className="min-h-full bg-[#080b0f] text-[#c8d6e5] antialiased">
        {children}
      </body>
    </html>
  );
}
