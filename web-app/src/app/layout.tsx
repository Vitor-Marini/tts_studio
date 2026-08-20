import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: [
    { path: '../fonts/Inter-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Inter-Medium.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'XTTS Studio | Premium Voice Synthesis',
  description: 'Advanced Text-to-Speech and Voice Cloning platform powered by XTTS.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
