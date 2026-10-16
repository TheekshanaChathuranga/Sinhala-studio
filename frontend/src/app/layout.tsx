import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Sinhala Subtitle Generator - AI Speech Recognition & Translation',
  description: 'Generate accurate, frame-synchronized Sinhala subtitles from video and audio using faster-whisper AI and natural Sinhala translation.',
  keywords: 'Sinhala subtitles, AI subtitle generator, Whisper Sinhala, Video translation, Sri Lanka, Sinhala SRT',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="si" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <footer className="border-t border-border/40 py-6 text-center text-xs text-slate-500">
          <p>
            Sinhala Subtitle Generator © {new Date().getFullYear()} — Powered by Whisper AI & Contextual NLP
          </p>
        </footer>
      </body>
    </html>
  );
}
