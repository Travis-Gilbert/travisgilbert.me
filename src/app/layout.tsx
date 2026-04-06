import type { Metadata } from 'next';
import { fontVariableClasses } from './fonts';
import ThemeProvider from '@/components/ThemeProvider';
import { auth } from '@/lib/auth';
import { OwnerProvider } from '@/components/OwnerProvider';
import { getSiteConfig } from '@/lib/siteConfig';
import '@/styles/global.css';
import '@/styles/print.css';

export async function generateMetadata(): Promise<Metadata> {
  const config = getSiteConfig();
  return {
    title: {
      default: 'Travis Gilbert',
      template: config.seo.titleTemplate || '%s | Travis Gilbert',
    },
    description:
      config.seo.description ||
      'Exploring how design decisions shape human outcomes. Essays, field notes, and projects on design, policy, and the built environment.',
    metadataBase: new URL('https://travisgilbert.me'),
    openGraph: {
      type: 'website',
      locale: 'en_US',
      siteName: 'Travis Gilbert',
    },
    twitter: {
      card: 'summary_large_image',
    },
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
    manifest: '/manifest.json',
    alternates: {
      types: {
        'application/rss+xml': '/rss.xml',
      },
    },
  };
}

/**
 * Root layout: minimal shell shared by all route groups.
 *
 * Provides html/body, font variables, theme provider, and global CSS.
 * All visual chrome (TopNav, Footer, DotGrid, etc.) lives in the
 * (main) route group layout. The (networks) route group adds its own
 * dark themed chrome.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isOwner = session?.user?.isOwner === true;
  // Blocking script: reads localStorage / matchMedia, sets data-theme on <html>
  // before first paint. Hardcoded string (no user input), safe for inline use.
  const themeScript = [
    '(function(){',
    "var t=localStorage.getItem('theme');",
    "if(!t){t=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}",
    "document.documentElement.setAttribute('data-theme',t)",
    '})()',
  ].join('');

  return (
    <html lang="en" className={fontVariableClasses} data-scroll-behavior="smooth" suppressHydrationWarning>
      {/* Built with curiosity and too much coffee. */}
      <body
        className="min-h-screen flex flex-col overflow-x-clip"
        style={{ isolation: 'isolate' }}
      >
        {/* Theme detection runs before paint. Content is a hardcoded string with no user input. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <OwnerProvider isOwner={isOwner}>
            {children}
          </OwnerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
