// scripts/export-icons.mjs
// Exports site icon SVGs to PNG at all required sizes.
// Usage: node scripts/export-icons.mjs

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src', 'assets', 'icons');
const OUT = join(ROOT, 'public');

const ICONS = [
  {
    name: 'main-site',
    file: 'main-site.svg',
    outputs: [
      { size: 16, filename: 'favicon-16x16.png' },
      { size: 32, filename: 'favicon-32x32.png' },
      { size: 180, filename: 'apple-touch-icon.png' },
      { size: 192, filename: 'icon-192.png' },
      { size: 512, filename: 'icon-512.png' },
    ],
  },
  {
    name: 'studio',
    file: 'studio.svg',
    outputs: [
      { size: 16, filename: 'studio/favicon-16x16.png' },
      { size: 32, filename: 'studio/favicon-32x32.png' },
      { size: 180, filename: 'studio/apple-touch-icon.png' },
      { size: 192, filename: 'studio/icon-192.png' },
      { size: 512, filename: 'studio/icon-512.png' },
    ],
  },
  {
    name: 'commonplace',
    file: 'commonplace.svg',
    outputs: [
      { size: 16, filename: 'commonplace/favicon-16x16.png' },
      { size: 32, filename: 'commonplace/favicon-32x32.png' },
      { size: 180, filename: 'commonplace/apple-touch-icon.png' },
      { size: 192, filename: 'commonplace/icon-192.png' },
      { size: 512, filename: 'commonplace/icon-512.png' },
    ],
  },
];

async function exportIcon(icon) {
  const svgBuffer = readFileSync(join(SRC, icon.file));
  console.log(`\nExporting ${icon.name}...`);

  for (const output of icon.outputs) {
    const outPath = join(OUT, output.filename);
    const outDir = dirname(outPath);

    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }

    await sharp(svgBuffer)
      .resize(output.size, output.size, { fit: 'contain', background: { r: 15, g: 16, b: 18, alpha: 1 } })
      .png()
      .toFile(outPath);

    console.log(`  ${output.size}x${output.size} -> ${output.filename}`);
  }
}

async function main() {
  console.log('Site Icon Export');
  console.log('================');

  for (const icon of ICONS) {
    await exportIcon(icon);
  }

  // Also copy SVGs to public for browsers that support SVG favicons
  const { copyFileSync } = await import('fs');
  copyFileSync(join(SRC, 'main-site.svg'), join(OUT, 'icon.svg'));
  copyFileSync(join(SRC, 'studio.svg'), join(OUT, 'studio', 'icon.svg'));
  copyFileSync(join(SRC, 'commonplace.svg'), join(OUT, 'commonplace', 'icon.svg'));
  console.log('\nSVG copies placed in public/');

  console.log('\nDone. Run `npm run build` to verify.');
}

main().catch(console.error);
