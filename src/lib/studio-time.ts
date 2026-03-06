/**
 * Lightweight relative time formatting for Studio cards and sidebar.
 *
 * Returns compact strings like "today", "3d ago", "2w ago", "1mo ago".
 * No external dependencies; keeps bundle lean.
 */

export function relativeTime(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days < 0) return 'future';
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
