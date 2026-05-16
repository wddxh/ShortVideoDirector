import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtemp, rm, mkdir, writeFile, readdir, stat } from 'fs/promises';
import os from 'os';
import { computeSourceHash, loadAndTransform, pruneOldCaches } from '../lib/cache.js';

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

describe('loadAndTransform integration', () => {
  it('produces valid cacheSkillsDir and agents object', async () => {
    const { cacheSkillsDir, agents } = await loadAndTransform(PROJECT_ROOT);
    expect(cacheSkillsDir).toMatch(/short-video-director/);
    expect(Object.keys(agents)).toContain('director');
    expect(Object.keys(agents)).toContain('creator');
    // 二次调用是 cache hit，结果应一致
    const second = await loadAndTransform(PROJECT_ROOT);
    expect(second.cacheSkillsDir).toBe(cacheSkillsDir);
  });
});

describe('pruneOldCaches', () => {
  it('keeps newest N caches, removes older', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'svd-prune-'));
    // 创建 5 个假 cache 目录，逐渐增加 mtime
    for (let i = 0; i < 5; i++) {
      const dir = path.join(tmp, `hash${i}`);
      await mkdir(dir);
      await writeFile(path.join(dir, 'marker'), '');
      // 调整 mtime
      const ts = Date.now() / 1000 + i;
      const { utimes } = await import('fs/promises');
      await utimes(dir, ts, ts);
    }
    await pruneOldCaches(tmp, 3);
    const remaining = await readdir(tmp);
    expect(remaining.length).toBe(3);
    // 应该是最新的 hash2 / hash3 / hash4
    expect(remaining.sort()).toEqual(['hash2', 'hash3', 'hash4']);
    await rm(tmp, { recursive: true, force: true });
  });
});
