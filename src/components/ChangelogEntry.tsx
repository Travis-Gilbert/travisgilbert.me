interface ChangelogEntryProps {
  sha: string;
  message: string;
  label: string;
  color: string;
  date: string;
  url: string;
  scope?: string;
}

export default function ChangelogEntry({
  sha, message, label, color, date, url, scope,
}: ChangelogEntryProps) {
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex items-start gap-3 py-2">
      {/* Timeline dot */}
      <div
        className="shrink-0 mt-1.5 w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 border rounded"
            style={{ color, borderColor: color }}
          >
            {label}
          </span>
          {scope && (
            <span className="font-mono text-[10px] text-ink-light">
              ({scope})
            </span>
          )}
          <span className="font-mono text-[10px] text-ink-light ml-auto shrink-0">
            {dateStr}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-ink m-0">
          {message.replace(/^\w+\([^)]*\):\s*/, '')}
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-ink-light hover:text-terracotta no-underline"
        >
          {sha}
        </a>
      </div>
    </div>
  );
}
