#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

try {
  if (process.argv.length !== 3) throw new Error('usage: image-reference-check.mjs REFS_CSV');
  const refs = process.argv[2] ? process.argv[2].split(',') : [];
  const file = 'assets/images/pending.json';
  const pending = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  if (!Array.isArray(pending)) throw new Error('cannot read pending state');
  const pendingPaths = new Set(pending.map(p => path.resolve(p.output_path)));
  for (const ref of refs) {
    if (pendingPaths.has(path.resolve(ref))) throw new Error(`reference pending: ${ref}`);
    if (fs.existsSync(`${ref}.claim`)) throw new Error(`reference claim exists: ${ref}`);
    const receipt = ref.replace(/\.png$/, '.generation.json');
    if (ref.endsWith('.png') && fs.existsSync(receipt)) {
      const record = JSON.parse(fs.readFileSync(receipt, 'utf8'));
      if (!['done', 'failed'].includes(record.status)) {
        throw new Error(`reference receipt requires reconciliation: ${ref}`);
      }
    }
    if (!fs.existsSync(ref) || !fs.statSync(ref).isFile()) {
      throw new Error(`missing dependency: ${ref}`);
    }
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
