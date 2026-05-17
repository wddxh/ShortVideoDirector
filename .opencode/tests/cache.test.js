import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtemp, rm, mkdir, writeFile, readdir, stat } from 'fs/promises';
import os from 'os';
import { computeSourceHash, loadAndTransform, pruneOldCaches } from '../lib/cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

describe('computeSourceHash', () => {
  test('returns deterministic 16-char hash for same source', async () => {
    const h1 = await computeSourceHash(PROJECT_ROOT);
    const h2 = await computeSourceHash(PROJECT_ROOT);
    assert.equal(h1, h2);
    assert.match(h1, /^[a-f0-9]{16}$/);
  });
});

describe('loadAndTransform integration', () => {
  test('produces valid cacheSkillsDir and agents object', async () => {
    const { cacheSkillsDir, agents } = await loadAndTransform(PROJECT_ROOT);
    assert.match(cacheSkillsDir, /short-video-director/);
    assert.ok(Object.keys(agents).includes('director'));
    assert.ok(Object.keys(agents).includes('creator'));
    // 二次调用是 cache hit，结果应一致
    const second = await loadAndTransform(PROJECT_ROOT);
    assert.equal(second.cacheSkillsDir, cacheSkillsDir);
  });
});

describe('pruneOldCaches', () => {
  test('keeps newest N caches, removes older', async () => {
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
    assert.equal(remaining.length, 3);
    // 应该是最新的 hash2 / hash3 / hash4
    assert.deepStrictEqual(remaining.sort(), ['hash2', 'hash3', 'hash4']);
    await rm(tmp, { recursive: true, force: true });
  });
});
