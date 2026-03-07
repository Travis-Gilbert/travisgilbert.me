/**
 * Fetch recent commits from GitHub and filter by conventional commit prefix.
 * Writes categorized entries to src/data/changelog.json.
 *
 * Called during build: npx tsx scripts/fetch-changelog.ts
 * Requires GITHUB_TOKEN env var.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const REPO = 'Travis-Gilbert/travisgilbert.me';
const BRANCH = 'main';
const MAX_PAGES = 5;
const MAX_ENTRIES = 100;

interface ChangelogEntry {
  sha: string;
  message: string;
  category: string;
  label: string;
  color: string;
  date: string;
  url: string;
  scope?: string;
}

const PREFIX_MAP: { prefix: string; category: string; label: string; color: string }[] = [
  { prefix: 'feat(content):', category: 'content', label: 'NEW CONTENT', color: '#B45A2D' },
  { prefix: 'feat(', category: 'feature', label: 'NEW FEATURE', color: '#2D5F6B' },
  { prefix: 'fix(', category: 'fix', label: 'FIX', color: '#C49A4A' },
  { prefix: 'refactor(', category: 'refactor', label: 'REFACTOR', color: '#9A8E82' },
  { prefix: 'style(', category: 'design', label: 'DESIGN', color: '#B45A2D' },
  { prefix: 'docs(', category: 'docs', label: 'DOCUMENTATION', color: '#9A8E82' },
];

function categorize(message: string): (typeof PREFIX_MAP)[0] | null {
  for (const entry of PREFIX_MAP) {
    if (message.startsWith(entry.prefix)) return entry;
  }
  return null;
}

function extractScope(message: string): string | undefined {
  const match = message.match(/^\w+\(([^)]+)\):/);
  return match?.[1];
}

async function fetchCommits(): Promise<ChangelogEntry[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('GITHUB_TOKEN not set. Writing empty changelog.');
    return [];
  }

  const entries: ChangelogEntry[] = [];

  for (let page = 1; page <= MAX_PAGES && entries.length < MAX_ENTRIES; page++) {
    const url = `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&per_page=30&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!res.ok) {
      console.error(`GitHub API error: ${res.status}`);
      break;
    }

    interface GitHubCommit {
      sha: string;
      commit: {
        message: string;
        author: { date: string };
      };
      html_url: string;
      parents: unknown[];
    }

    const commits: GitHubCommit[] = await res.json();
    if (commits.length === 0) break;

    for (const commit of commits) {
      // Skip merge commits
      if (commit.parents.length > 1) continue;

      const firstLine = commit.commit.message.split('\n')[0];
      const cat = categorize(firstLine);
      if (!cat) continue;

      entries.push({
        sha: commit.sha.slice(0, 7),
        message: firstLine,
        category: cat.category,
        label: cat.label,
        color: cat.color,
        date: commit.commit.author.date,
        url: commit.html_url,
        scope: extractScope(firstLine),
      });

      if (entries.length >= MAX_ENTRIES) break;
    }
  }

  return entries;
}

async function main() {
  const entries = await fetchCommits();
  const outDir = join(process.cwd(), 'src', 'data');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'changelog.json'), JSON.stringify(entries, null, 2));
  console.log(`Changelog: ${entries.length} entries written to src/data/changelog.json`);
}

main().catch(console.error);
