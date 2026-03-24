/**
 * Library view data helpers.
 * Server-safe: no hooks, no DOM access, no 'use client'.
 */

import { getObjectTypeIdentity, type ObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Time formatting
   ───────────────────────────────────────────────── */

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

/* ─────────────────────────────────────────────────
   Text helpers
   ───────────────────────────────────────────────── */

export function countWords(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}

export function truncate(text: string, limit = 140): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}\u2026`;
}

/* ─────────────────────────────────────────────────
   Color utilities
   ───────────────────────────────────────────────── */

export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

/* ─────────────────────────────────────────────────
   Signal color map (for resurface cards)
   ───────────────────────────────────────────────── */

export const SIGNAL_COLORS: Record<string, string> = {
  'fading connection': '#C4503C',
  'fading_connection': '#C4503C',
  'bridge node': '#2D5F6B',
  'bridge_node': '#2D5F6B',
  'lonely island': '#C49A4A',
  'lonely_island': '#C49A4A',
  'unsupported': '#B06080',
};

export function signalColor(signal: string): string {
  return SIGNAL_COLORS[signal.toLowerCase()] ?? '#B06080';
}

/* ─────────────────────────────────────────────────
   Type identity convenience wrapper
   ───────────────────────────────────────────────── */

export function typeIdentity(slug: string): ObjectTypeIdentity {
  return getObjectTypeIdentity(slug);
}
