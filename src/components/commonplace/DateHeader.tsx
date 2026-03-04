'use client';

/**
 * DateHeader: sticky date separator for the timeline feed.
 *
 * Shows relative date labels ("Today", "Yesterday") or full
 * formatted dates. Courier Prime monospace uppercase text with
 * a subtle terracotta rule underneath. Sticks to the top of
 * the scroll container within its date group.
 */

interface DateHeaderProps {
  label: string;
}

export default function DateHeader({ label }: DateHeaderProps) {
  return (
    <div className="cp-date-header">
      <span>{label}</span>
    </div>
  );
}
