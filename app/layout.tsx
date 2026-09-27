import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ShipLog — Automated Release & Retention SaaS Engine',
    template: '%s | ShipLog',
  },
  description:
    'Automated developer-first release notes and retention engine that ingests GitHub PRs, filters noise, synthesizes user-facing release notes using Gemini 1.5 Flash structured JSON, and distributes via <5 KB embeddable widgets.',
  keywords: [
    'changelog',
    'release notes',
    'github webhook',
    'saas',
    'embeddable widget',
    'gemini',
    'developer tools',
  ],
  authors: [{ name: 'ShipLog Team' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
