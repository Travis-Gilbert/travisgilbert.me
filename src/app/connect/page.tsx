import type { Metadata } from 'next';
import { ChatCircle } from '@phosphor-icons/react/dist/ssr';
import RoughLine from '@/components/rough/RoughLine';
import RoughBox from '@/components/rough/RoughBox';

export const metadata: Metadata = {
  title: 'Connect',
  description: 'How to get in touch.',
};

export default function ConnectPage() {
  return (
    <>
      <section className="py-8">
        <h1 className="font-title text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
          <ChatCircle size={32} className="text-terracotta" />
          Connect
        </h1>
        <p className="text-ink-secondary mb-8">
          I&apos;m always interested in hearing from people who think about the
          same things &mdash; design, infrastructure, systems, and the decisions
          that shape them.
        </p>
      </section>

      <div className="max-w-xl space-y-8">
        <RoughBox padding={24}>
          <div>
            <h2 className="font-title text-lg font-bold mb-4">Find me</h2>
            <ul className="space-y-3 list-none p-0 m-0">
              <li className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary w-20">
                  YouTube
                </span>
                <a
                  href="#"
                  className="font-mono text-sm hover:text-terracotta-hover"
                >
                  @travisgilbert
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary w-20">
                  GitHub
                </span>
                <a
                  href="#"
                  className="font-mono text-sm hover:text-terracotta-hover"
                >
                  @travisgilbert
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-widest text-ink-secondary w-20">
                  Email
                </span>
                <a
                  href="mailto:hello@travisgilbert.com"
                  className="font-mono text-sm hover:text-terracotta-hover"
                >
                  hello@travisgilbert.com
                </a>
              </li>
            </ul>
          </div>
        </RoughBox>

        <RoughLine />

        <section>
          <h2 className="font-title text-lg font-bold mb-3">
            What I want to hear about
          </h2>
          <ul className="space-y-2 text-ink-secondary">
            <li>
              Design decisions you&apos;ve noticed that deserve investigation
            </li>
            <li>Corrections or additional context for published work</li>
            <li>Collaboration on research or video projects</li>
            <li>Interesting reading recommendations</li>
          </ul>
        </section>

        <section>
          <h2 className="font-title text-lg font-bold mb-3">
            What I don&apos;t want to hear about
          </h2>
          <ul className="space-y-2 text-ink-secondary">
            <li>SEO services or link exchanges</li>
            <li>Unsolicited pitches for products</li>
            <li>&ldquo;Exciting partnership opportunities&rdquo;</li>
          </ul>
        </section>
      </div>
    </>
  );
}
