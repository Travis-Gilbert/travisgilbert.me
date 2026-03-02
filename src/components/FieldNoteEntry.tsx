import Link from 'next/link';
import DateStamp from './DateStamp';
import TagList from './TagList';
import RoughBox from './rough/RoughBox';
import { CompactTracker, NOTE_STAGES } from './ProgressTracker';

interface FieldNoteEntryProps {
  title: string;
  date: Date;
  excerpt?: string;
  tags: string[];
  href: string;
  status?: string;
}

export default function FieldNoteEntry({
  title,
  date,
  excerpt,
  tags,
  href,
  status,
}: FieldNoteEntryProps) {
  return (
    <RoughBox padding={20} hover tint="teal">
      <div className="group">
        <Link href={href} className="block no-underline text-ink hover:text-ink">
          <div className="flex flex-col gap-2">
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
            <h3 className="text-lg font-title font-bold group-hover:text-terracotta transition-colors m-0">
              {title}
            </h3>
            {excerpt && (
              <p className="text-sm text-ink-secondary m-0 line-clamp-3">
                {excerpt}
              </p>
            )}
          </div>
        </Link>
        {tags.length > 0 && (
          <div className="pt-3">
            <TagList tags={tags} tint="teal" />
          </div>
        )}
      </div>
    </RoughBox>
  );
}
