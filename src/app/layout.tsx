import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CarbonTrace | Audit-Ready EU CBAM Agent Team',
  description:
    'Turn messy factory bills and supplier invoices into an audit-ready EU CBAM carbon report where every number links to its source document.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--ct-bg)] text-[var(--ct-ink)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
