import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("src");
const blocked = ["MOCK_", "FAKE_", "SAMPLE_", "onClick={() => {}", "onClick={() => null"];
const findings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|css)$/.test(entry.name)) {
      continue;
    }
    const content = await readFile(fullPath, "utf8");
    for (const token of blocked) {
      if (content.includes(token)) {
        findings.push(`${path.relative(process.cwd(), fullPath)} contains ${token}`);
      }
    }
  }
}

await walk(root);

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("No blocked showroom UI tokens found.");
