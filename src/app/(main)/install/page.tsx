import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ServerConnection } from 'iconoir-react';
import RoughBox from '@/components/rough/RoughBox';
import RoughLine from '@/components/rough/RoughLine';
import CommonPlacePwaInstall from '@/components/commonplace/install/CommonPlacePwaInstall';
import DesktopDownloadPanel from '@/components/install/DesktopDownloadPanel';
import McpInstallPanel from '@/components/install/McpInstallPanel';
import { RAILWAY_TEMPLATE_PUBLISHED, RAILWAY_TEMPLATE_URL } from '@/lib/install-surfaces';

export const metadata: Metadata = {
  title: 'Install',
  description: 'Connect an agent, install CommonPlace, download the desktop app, or self-host Theorem.',
  manifest: '/commonplace/manifest.webmanifest',
};

export default function InstallPage() {
  return (
    <div className="space-y-10 py-4 sm:py-8">
      <section className="space-y-4">
        <span className="block font-mono text-sm font-bold uppercase tracking-[0.1em] text-terracotta">
          Install
        </span>
        <h1 className="max-w-3xl font-title text-3xl font-bold leading-tight md:text-5xl">
          Use CommonPlace, connect your agent, or run Theorem on your own Railway account.
        </h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-secondary">
          Pick the path by intent. CommonPlace installs as a browser app or native desktop app.
          The harness connects to Claude Code, Claude Desktop, Cursor, Codex, or raw MCP over one authenticated endpoint.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <RoughBox tint="gold" padding={20}>
          <div className="space-y-3">
            <h2 className="m-0 font-title text-2xl font-bold">Use CommonPlace</h2>
            <p className="m-0 text-sm leading-relaxed text-ink-secondary">
              Install the web app without signing, or use the native desktop build when you want the local node bundled with the shell.
            </p>
            <CommonPlacePwaInstall />
            <DesktopDownloadPanel />
          </div>
        </RoughBox>

        <RoughBox tint="teal" padding={20}>
          <div className="space-y-4">
            <div>
              <h2 className="m-0 font-title text-2xl font-bold">Run your own</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">
                Self-host the harness and graph engine. Provider keys stay in your Railway project.
              </p>
            </div>
            <a
              href={RAILWAY_TEMPLATE_URL}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-teal bg-teal px-4 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-cream no-underline transition-transform hover:-translate-y-0.5"
            >
              <ServerConnection width={16} height={16} strokeWidth={2} />
              {RAILWAY_TEMPLATE_PUBLISHED ? 'Deploy on Railway' : 'Open template source'}
            </a>
            <p className="m-0 text-sm text-ink-secondary">
              {RAILWAY_TEMPLATE_PUBLISHED
                ? 'This is the free self-host path. Managed hosted sync remains separate.'
                : 'The template source is ready. Publishing it to Railway turns this into a one-click deploy button.'}
            </p>
          </div>
        </RoughBox>
      </div>

      <section className="space-y-4">
        <RoughLine label="Connect your agent" labelColor="var(--color-terracotta)" />
        <McpInstallPanel />
      </section>

      <section className="flex flex-wrap gap-4 border-t border-border-light pt-6">
        <Link
          href="/commonplace"
          className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.08em] text-gold no-underline hover:text-gold/80"
        >
          Open CommonPlace <ArrowRight width={14} height={14} strokeWidth={2.5} />
        </Link>
        <Link
          href="/projects/theseus"
          className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.08em] text-teal no-underline hover:text-teal/80"
        >
          Read the Theseus project <ArrowRight width={14} height={14} strokeWidth={2.5} />
        </Link>
      </section>
    </div>
  );
}
