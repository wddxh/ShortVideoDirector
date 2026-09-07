import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Parse only the inventory's category rows, not arbitrary Markdown references.
export function parseAssetInventory(text) {
  const newAssets = new Set();
  const existingAssets = new Set();
  const sections = new Map([
    ['### 新增资产', newAssets],
    ['### 已有资产（本集出场）', existingAssets],
  ]);
  const seen = new Set();
  let inInventory = false;
  let target;

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (!inInventory) {
      if (line === '## 本集资产清单') inInventory = true;
      continue;
    }
    if (/^#{1,2}(?:\s|$)/.test(line)) break;
    if (/^###(?:\s|$)/.test(line)) {
      target = sections.get(line);
      if (target) {
        if (seen.has(line)) throw new Error(`Duplicate inventory subsection: ${line}`);
        seen.add(line);
      }
      continue;
    }
    if (!line.trim()) continue;
    if (!target) {
      if (seen.size === 0) throw new Error(`Expected inventory subsection: ${line}`);
      continue;
    }
    const row = /^- (characters|locations|items|buildings):\s*(.*)$/.exec(line);
    if (!row) throw new Error(`Invalid inventory row: ${line}`);
    const [, category, entries] = row;
    for (const value of entries.split(',')) {
      const entry = value.trim();
      if (!entry || entry === '(无)') continue;
      const explicit = /^([^()]+?)\s+\(([^()]+)\)$/.exec(entry);
      const name = explicit ? explicit[1].trim() : entry;
      if (/[()/\\\x00-\x1f\x7f]/.test(name)) {
        throw new Error(`Invalid asset name: ${entry}`);
      }
      const path = `assets/${category}/${name}.md`;
      if (explicit && explicit[2] !== path) {
        throw new Error(`Asset path must match category and name: ${entry}`);
      }
      target.add(path);
    }
  }

  if (!inInventory || seen.size !== sections.size) {
    throw new Error('Missing inventory or required subsection');
  }
  return { newAssets: [...newAssets], existingAssets: [...existingAssets] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, mode = 'new', ...extra] = process.argv.slice(2);
    if (!file || extra.length || !['new', 'existing', 'all'].includes(mode)) {
      throw new Error('Usage: node episode-assets.mjs SCRIPT [new|existing|all]');
    }
    const { newAssets, existingAssets } = parseAssetInventory(readFileSync(file, 'utf8'));
    const paths = mode === 'new' ? newAssets : mode === 'existing' ? existingAssets
      : [...new Set([...newAssets, ...existingAssets])];
    if (paths.length) process.stdout.write(paths.join('\n') + '\n');
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}
