#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseImageArgs, runImages } from './generate-images-dreamina.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
try {
  if (process.argv.length === 2) {
    throw new Error('usage: generate-storyboard-sheets-dreamina.sh [--force] [--retry-missing-id] [--concurrency N] <card...>');
  }
  const { inputs, ...options } = parseImageArgs(process.argv.slice(2));
  const jobs = [];
  for (const source of new Set(inputs)) {
    if (!/^assets\/storyboard-sheets\/ep(0[1-9]|[1-9]\d+)\/shot(0[1-9]|[1-9]\d+)\.md$/.test(source)) {
      throw new Error(`noncanonical card: ${source}`);
    }
    // Keep the shell converter's legacy gate and the authoritative card parser.
    const parsed = JSON.parse(execFileSync('bash', [path.join(scripts,
      'storyboard-sheet-to-prompt.sh'), '--json', source], { encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'] }));
    jobs.push({ source, output: source.replace('assets/', 'assets/images/').replace(/\.md$/, '.png'),
      ...parsed });
  }
  process.exitCode = (await runImages(jobs, options)).status;
} catch (error) {
  if (error.stderr) process.stderr.write(error.stderr);
  else console.error(`FAIL ${error.message}`);
  process.exitCode = error.status === 2 ? 2 : 1;
}
