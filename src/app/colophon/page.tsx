import type { Metadata } from 'next';
import RoughLine from '@/components/rough/RoughLine';
import RoughBox from '@/components/rough/RoughBox';
import DrawOnIcon from '@/components/rough/DrawOnIcon';

export const metadata: Metadata = {
  title: 'Colophon',
  description: 'About this site: design decisions, tech stack, and philosophy.',
};

type StackCategory = {
  label: string;
  tint: 'terracotta' | 'teal' | 'gold' | 'neutral';
  color: string;
  items: { key: string; value: string; note?: string }[];
};

const STACK_CATEGORIES: StackCategory[] = [
  {
    label: 'Foundation',
    tint: 'terracotta',
    color: 'var(--color-terracotta)',
    items: [
      { key: 'Framework', value: 'Next.js 15', note: 'App Router, static generation' },
      { key: 'UI', value: 'React 19' },
      { key: 'Hosting', value: 'Vercel', note: 'auto-deploy from git' },
    ],
  },
  {
    label: 'Presentation',
    tint: 'teal',
    color: 'var(--color-teal)',
    items: [
      { key: 'Styling', value: 'Tailwind CSS v4', note: 'CSS custom properties' },
      { key: 'Hand-drawn', value: 'rough.js + rough-notation' },
      { key: 'Typography', value: '7 fonts via next/font', note: 'Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, Space Mono, Amarna' },
      { key: 'Primitives', value: 'Radix UI', note: 'Accordion, Collapsible, Tooltip' },
      { key: 'Icons', value: 'Phosphor + SketchIcon system' },
    ],
  },
  {
    label: 'Content Pipeline',
    tint: 'gold',
    color: 'var(--color-gold)',
    items: [
      { key: 'Content', value: 'Markdown + gray-matter + remark' },
      { key: 'Validation', value: 'Zod schemas' },
      { key: 'RSS', value: 'feed package' },
    ],
  },
  {
    label: 'Publishing',
    tint: 'neutral',
    color: 'var(--color-ink-muted)',
    items: [
      { key: 'Studio', value: 'Django + HTMX', note: 'GitHub Contents API pipeline' },
    ],
  },
];

export default function ColophonPage() {
  return (
    <>
      <section className="py-8">
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <DrawOnIcon name="info" size={32} color="var(--color-terracotta)" />
          Colophon
        </h1>
        <p className="text-ink-secondary mb-8">
          About this site and the thinking behind it.
        </p>
      </section>

      <div className="space-y-8 max-w-2xl">
        <section>
          <h2 className="font-title text-xl font-bold mb-3">
            Why It Looks This Way
          </h2>
          <p className="leading-relaxed">
            This site is designed to feel like a patent drawing come to life
            : warm parchment, india ink, and the careful precision of
            technical documentation. The dot-grid background, hand-drawn accents,
            and editorial typography are deliberate. They signal that this is a
            working space for someone who reads footnotes and visits primary
            sources.
          </p>
          <p className="leading-relaxed">
            The aesthetic borrows from engineering notebooks, architectural
            blueprints, and field journals. If the site feels like something
            you&apos;d find on a drafting table rather than in a boardroom,
            that&apos;s the intention.
          </p>
        </section>

        <RoughLine />

        <section>
          <h2 className="font-title text-xl font-bold mb-4">Tech Stack</h2>
          <RoughLine label="Bill of Materials" labelColor="var(--color-ink-light)" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            {STACK_CATEGORIES.map((cat) => (
              <RoughBox key={cat.label} padding={20} tint={cat.tint} elevated>
                <span
                  className="font-mono block mb-3"
                  style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: cat.color,
                  }}
                >
                  {cat.label}
                </span>

                <dl className="space-y-2 m-0">
                  {cat.items.map((item) => (
                    <div key={item.key}>
                      <dt className="font-mono text-[11px] uppercase tracking-widest text-ink-faint">
                        {item.key}
                      </dt>
                      <dd className="m-0 text-sm font-semibold text-ink">
                        {item.value}
                        {item.note && (
                          <span className="font-normal text-ink-secondary ml-1">
                            ({item.note})
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </RoughBox>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-title text-xl font-bold mb-3">Typography</h2>
          <p className="leading-relaxed">
            The site uses three typography systems that shift by context.{' '}
            <strong className="font-title">Vollkorn</strong> carries editorial
            weight in headings: a sturdy, old-style serif that grounds
            every page title. <strong>Cabin</strong> handles most body text as a
            humanist sans that shows the calligrapher&apos;s hand without
            shouting about it.
          </p>
          <p className="leading-relaxed">
            For essays and technical pages,{' '}
            <strong>IBM Plex Sans</strong> steps in as the body face,
            more clinical, more precise. Labels and metadata are always set in{' '}
            <span className="font-mono text-sm">Courier Prime</span>:
            uppercase, tracked, monospaced, evoking typewritten case
            files and document stamps.
          </p>
          <p className="leading-relaxed">
            The toolkit pages use{' '}
            <strong className="font-title-alt">Ysabeau</strong>, a glyphic
            humanist sans that suggests letters chiseled into stone. It gives
            those pages an architectural, structural feel distinct from the
            editorial warmth elsewhere.
          </p>
          <p className="leading-relaxed">
            The masthead uses{' '}
            <strong>Amarna</strong>, a self-hosted semi-glyphic humanist sans
            with a carved, naturalistic quality at larger sizes. It is the only
            locally hosted font; the remaining six load via Google Fonts
            through <span className="font-mono text-sm">next/font</span>.
          </p>
        </section>

        <section>
          <h2 className="font-title text-xl font-bold mb-3">
            Design Philosophy
          </h2>
          <p className="leading-relaxed">
            Every design decision on this site was made with the same question
            in mind: does this serve the content, or does it serve the ego of
            the designer? Ornament for its own sake is out. Warmth and texture
            that invite you to read are in.
          </p>
          <p className="leading-relaxed">
            The hand-drawn underline on the homepage is the only rough.js
            element that&apos;s truly decorative, and it&apos;s a
            statement. It says: this work is in progress. The ideas are real,
            but they&apos;re still being shaped. Nothing here pretends to be
            final.
          </p>
        </section>

        <section>
          <h2 className="font-title text-xl font-bold mb-3">Credits</h2>
          <p className="leading-relaxed">
            Built with{' '}
            <a href="https://nextjs.org">Next.js</a>, styled
            with <a href="https://tailwindcss.com">Tailwind CSS</a>, illustrated
            with <a href="https://roughjs.com">rough.js</a> by Preet Shihn.
            Accessible UI primitives from{' '}
            <a href="https://www.radix-ui.com">Radix</a>.
            Fonts served via next/font. Hosted on Vercel.
          </p>
          <p className="leading-relaxed">
            Claude Code handled much of the implementation, but every design
            decision, every color choice, and every layout judgment was made by
            a human. The tool writes markup; the person decides what the site
            should feel like.
          </p>
        </section>
      </div>
    </>
  );
}
