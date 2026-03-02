type DateStampTint = 'terracotta' | 'teal' | 'gold';

const TINT_CLASSES: Record<DateStampTint, string> = {
  terracotta: 'text-terracotta-light bg-terracotta/[0.06]',
  teal: 'text-teal-light bg-teal/[0.06]',
  gold: 'text-gold-light bg-gold/[0.06]',
};

interface DateStampProps {
  date: Date;
  /** Brand color matching the parent section (default: terracotta) */
  tint?: DateStampTint;
}

export default function DateStamp({ date, tint = 'terracotta' }: DateStampProps) {
  const d = date instanceof Date ? date : new Date(date);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate().toString().padStart(2, '0');
  const year = d.getFullYear();

  return (
    <time
      dateTime={d.toISOString()}
      className={`inline-block w-fit font-mono text-[11px] uppercase tracking-widest px-2 py-0.5 rounded select-none ${TINT_CLASSES[tint]}`}
    >
      {month} {day}, {year}
    </time>
  );
}
