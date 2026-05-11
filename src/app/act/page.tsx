import type { Metadata } from 'next';
import AntiConspiracyPage from '@/components/act/AntiConspiracyPage';
import AntiConspiracyPageBlueprint from '@/components/act/AntiConspiracyPageBlueprint';

export const metadata: Metadata = {
  title: 'Anti-Conspiracy Theorem | Travis Gilbert',
  description:
    'A working public lab for the Anti-Conspiracy Theorem browser extension and ACC claim scoring engine.',
  openGraph: {
    title: 'Anti-Conspiracy Theorem',
    description:
      'A working public lab for the Anti-Conspiracy Theorem browser extension and ACC claim scoring engine.',
  },
};

type ActPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * /act surface.
 *
 * Default renders the parchment field-lab page (AntiConspiracyPage).
 * When `?bp=1` is on the URL, renders the Blueprint redesign instead.
 * The flag stays in place until the Do Not Downgrade gate passes (see
 * Index-API/docs/plans/act-evidence-cockpit/track-e-public-site-design/
 * implementation-plan.md E18). Once the flag is flipped, Blueprint
 * becomes the default and the legacy parchment module moves to legacy/.
 */
export default async function ActPage({ searchParams }: ActPageProps) {
  const params = await searchParams;
  const bp = params?.bp;
  const blueprintActive = bp === '1' || bp === 'true';

  return blueprintActive ? <AntiConspiracyPageBlueprint /> : <AntiConspiracyPage />;
}
