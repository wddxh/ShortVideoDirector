import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeSourceHash } from '../lib/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('computeSourceHash', () => {
  it('returns deterministic 16-char hash for same source', async () => {
    const h1 = await computeSourceHash(PROJECT_ROOT);
    const h2 = await computeSourceHash(PROJECT_ROOT);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{16}$/);
  });
});
