import Link from 'next/link';
import DateStamp from './DateStamp';
import TagList from './TagList';
import RoughBox from './rough/RoughBox';
import { CompactTracker, NOTE_STAGES } from './ProgressTracker';

interface FeaturedFieldNoteProps {
  title: string;
  date: Date;
  excerpt?: string;
  tags: string[];
  href: string;
  status?: string;
  callout?: string;
}

export default function FeaturedFieldNote({
  title,
  date,
  excerpt,
  tags,
  href,
  status,
  callout,
}: FeaturedFieldNoteProps) {
  return (
    <RoughBox padding={24} hover tint="teal" elevated>
      <div className="group card-link-stretch">
        <Link
          href={href}
          className="card-link-main block no-underline text-ink hover:text-ink"
        >
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <DateStamp date={date} tint="teal" />
              {status && (
                <CompactTracker
                  stages={NOTE_STAGES}
                  currentStage={status}
                  color="var(--color-teal)"
                />
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-title font-bold group-hover:text-teal transition-colors m-0">
              {title}
            </h3>
            {excerpt && (
              <p className="text-sm sm:text-base text-ink-secondary m-0 leading-relaxed">
                {excerpt}
              </p>
            )}
            {callout && (
              <p
                className="font-mono text-teal m-0 opacity-80"
                style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
              >
                {callout}
              </p>
            )}
          </div>
        </Link>
        {tags.length > 0 && (
          <div className="card-tags pt-4">
            <TagList tags={tags} tint="teal" />
          </div>
        )}
      </div>
    </RoughBox>
  );
}
