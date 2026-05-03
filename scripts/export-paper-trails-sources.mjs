import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const contentDir = path.resolve(
  repoRoot,
  process.argv[2] ?? 'src/content/essays',
);
const outputPath = process.argv[3] ? path.resolve(repoRoot, process.argv[3]) : null;

const files = (await readdir(contentDir))
  .filter((name) => name.endsWith('.md'))
  .map((name) => path.join(contentDir, name));
const items = [];

for (const file of files.sort()) {
  const { data } = matter.read(file);
  const sources = Array.isArray(data.sources)
    ? data.sources
        .filter((source) => source && typeof source.title === 'string')
        .map((source) => ({
          title: source.title,
          url: source.url ?? '',
          author: source.author ?? source.creator ?? '',
          year: source.year ?? null,
          role: source.role ?? 'reference',
          source_type: source.source_type ?? source.type ?? '',
          publication: source.publication ?? '',
        }))
    : [];

  if (sources.length === 0) {
    continue;
  }

  items.push({
    content_slug: path.basename(file, '.md'),
    content_title: data.title ?? path.basename(file, '.md'),
    sources,
  });
}

const json = `${JSON.stringify({ items }, null, 2)}\n`;

if (outputPath) {
  await writeFile(outputPath, json);
} else {
  process.stdout.write(json);
}
