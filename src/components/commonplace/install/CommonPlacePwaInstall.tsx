'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'iconoir-react';

type InstallSurface = 'page' | 'commonplace-shell';

type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isiOS = /iPad|iPhone|iPod/.test(ua);
  const isWebKit = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isiOS && isWebKit;
}

export default function CommonPlacePwaInstall({ surface = 'page' }: { surface?: InstallSurface }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [status, setStatus] = useState<'idle' | 'installing' | 'dismissed'>('idle');

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/commonplace-sw.js', { scope: '/commonplace/' }).catch(() => {});
    }

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setStatus('idle');
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = useMemo(() => isIosSafari(), []);
  const compact = surface === 'commonplace-shell';

  async function install() {
    if (!installEvent) return;
    setStatus('installing');
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    setStatus(choice.outcome === 'accepted' ? 'idle' : 'dismissed');
  }

  if (installed && compact) return null;
  if (!installEvent && compact) return null;

  if (installEvent) {
    return (
      <div
        className={compact ? 'fixed bottom-4 left-4 z-40' : ''}
        data-pagefind-ignore
      >
        <button
          type="button"
          onClick={install}
          disabled={status === 'installing'}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[rgba(42,36,32,0.18)] bg-[#FBF0E2] px-3 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-[#2A2420] shadow-[0_8px_24px_rgba(42,36,32,0.14)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <Download width={16} height={16} strokeWidth={2} />
          {status === 'installing' ? 'Opening prompt' : 'Install app'}
        </button>
      </div>
    );
  }

  if (installed) {
    return (
      <p className="m-0 font-mono text-[12px] uppercase tracking-[0.08em] text-gold">
        CommonPlace is installed on this device.
      </p>
    );
  }

  if (!ios) {
    return (
      <p className="m-0 text-sm text-ink-secondary">
        In Chrome or Edge, the install button appears when the browser confirms the app shell is ready.
      </p>
    );
  }

  return (
    <div className="space-y-2 text-sm text-ink-secondary">
      <p className="m-0">On iOS Safari, use Share, then Add to Home Screen.</p>
      {status === 'dismissed' && <p className="m-0">The browser install prompt was dismissed. You can open it again after reloading.</p>}
    </div>
  );
}
