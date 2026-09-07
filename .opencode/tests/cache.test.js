import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdtemp, rm, mkdir, writeFile, readdir, stat, cp, readFile } from 'fs/promises';
import os from 'os';
import { ROLE_HANDOFF_GUIDANCE, USER_INVOCABLE_ENTRY_WORKFLOWS } from '../lib/tool-mapping.js';
// Cache integration must never prune or rebuild the developer's installed cache.
const originalHome = process.env.HOME;
const testHome = await mkdtemp(path.join(os.tmpdir(), 'svd-cache-home-'));
process.env.HOME = testHome;
const { computeSourceHash, loadAndTransform, pruneOldCaches } = await import('../lib/cache.js');
after(async () => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  await rm(testHome, { recursive: true, force: true });
});

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
  test('decision rule reaches source entries, cached entries and loaded roles', async () => {
    const rule = 'skills/_meta/rules/user-decision-relay.md';
    const sourceRule = await readFile(path.join(PROJECT_ROOT, rule), 'utf8');
    const { cacheSkillsDir, agents } = await loadAndTransform(PROJECT_ROOT);
    const cachedRule = path.join(cacheSkillsDir, '_meta/rules/user-decision-relay.md');
    assert.equal(await readFile(cachedRule, 'utf8'), sourceRule);
    for (const name of USER_INVOCABLE_ENTRY_WORKFLOWS) {
      const source = await readFile(path.join(PROJECT_ROOT, 'skills', name, 'SKILL.md'), 'utf8');
      assert.ok(source.includes('${CLAUDE_PLUGIN_ROOT}/' + rule), name);
      const cached = await readFile(path.join(cacheSkillsDir, name, 'SKILL.md'), 'utf8');
      assert.ok(cached.includes(cachedRule), name);
      assert.ok(cached.includes(ROLE_HANDOFF_GUIDANCE), name);
    }
    for (const name of ['director', 'writer', 'scriptwriter', 'storyboarder', 'creator']) {
      const source = await readFile(path.join(PROJECT_ROOT, 'agents', name + '.md'), 'utf8');
      const link = '../' + rule;
      assert.ok(source.includes(`](${link})`), name);
      const { prompt } = agents[name];
      const anchor = prompt.match(/^Source role file: `([^`]+)`/);
      assert.ok(anchor, `${name}: runtime prompt missing source anchor`);
      assert.ok(path.isAbsolute(anchor[1]), name);
      const relative = prompt.match(/\]\((\.\.\/skills\/_meta\/rules\/user-decision-relay\.md)\)/);
      assert.ok(relative, name);
      const resolved = path.resolve(path.dirname(anchor[1]), relative[1]);
      assert.equal(await readFile(resolved, 'utf8'), sourceRule);
      assert.ok(prompt.includes(ROLE_HANDOFF_GUIDANCE), name);
    }
  });

  test('deleted skills and guides are absent from the new cache', async () => {
    const root = path.join(testHome, 'plugin');
    await mkdir(path.join(root, 'skills', 'demo'), { recursive: true });
    await mkdir(path.join(root, 'skills', 'retired'), { recursive: true });
    await mkdir(path.join(root, 'scripts'));
    await cp(path.join(PROJECT_ROOT, 'agents'), path.join(root, 'agents'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), '{"version":"0.0.1"}');
    for (const name of ['demo', 'retired']) {
      await writeFile(path.join(root, 'skills', name, 'SKILL.md'),
        `---\nname: ${name}\ndescription: fixture\n---\nBody`);
    }
    await writeFile(path.join(root, 'skills/demo/old.md'), 'old guide');
    const first = await loadAndTransform(root);
    await rm(path.join(root, 'skills/retired'), { recursive: true });
    await rm(path.join(root, 'skills/demo/old.md'));
    const second = await loadAndTransform(root);
    assert.notEqual(second.cacheSkillsDir, first.cacheSkillsDir);
    for (const relative of ['retired/SKILL.md', 'demo/old.md']) {
      await assert.rejects(readFile(path.join(second.cacheSkillsDir, relative)), { code: 'ENOENT' });
    }
    assert.equal(await readFile(path.join(first.cacheSkillsDir, 'demo/old.md'), 'utf8'), 'old guide');
  });

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

describe('computeSourceHash includes scripts/', () => {
  test('changes when a script file is modified', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'svd-hash-'));
    // 构造最小 plugin 结构：package.json + skills/ + agents/ + scripts/
    await writeFile(path.join(tmp, 'package.json'), '{"version":"0.0.1"}');
    await mkdir(path.join(tmp, 'skills'));
    await mkdir(path.join(tmp, 'agents'));
    await mkdir(path.join(tmp, 'scripts'));
    await writeFile(path.join(tmp, 'scripts', 'foo.sh'), '#!/bin/bash\necho v1\n');

    const h1 = await computeSourceHash(tmp);

    // 修改 scripts/foo.sh（内容 + 触碰 mtime）
    await new Promise(r => setTimeout(r, 10));
    await writeFile(path.join(tmp, 'scripts', 'foo.sh'), '#!/bin/bash\necho v2\n');

    const h2 = await computeSourceHash(tmp);
    assert.notEqual(h1, h2, 'hash should differ after scripts/ modification');

    await rm(tmp, { recursive: true, force: true });
  });
});

describe('computeSourceHash includes OpenCode transform inputs', () => {
  for (const relative of [
    '.opencode/lib/helper.js',
    '.opencode/lib/helper.txt',
    '.opencode/skill-overrides/demo/SKILL.md',
    '.opencode/skill-overrides/demo/loop.sh',
    '.opencode/skill-overrides/demo/cron-prompt.txt',
  ]) {
    test(`changes when ${relative} changes`, async () => {
      const tmp = await mkdtemp(path.join(os.tmpdir(), 'svd-oc-hash-'));
      await writeFile(path.join(tmp, 'package.json'), '{"version":"0.0.1"}');
      for (const dir of ['skills', 'agents', 'scripts', '.opencode/lib', '.opencode/skill-overrides/demo']) {
        await mkdir(path.join(tmp, dir), { recursive: true });
      }
      const target = path.join(tmp, relative);
      await writeFile(target, 'v1');
      const first = await computeSourceHash(tmp);
      await writeFile(target, 'version-two');
      assert.notEqual(await computeSourceHash(tmp), first);
      await rm(tmp, { recursive: true, force: true });
    });
  }
});

describe('loadAndTransform copies shared skill resources (skills/_*\/)', () => {
  test('cache miss creates cacheSkillsDir/_meta/rules/ with rule files', async () => {
    // 强制 cache miss：先算 hash 找到 cache dir 并删除
    const hash = await computeSourceHash(PROJECT_ROOT);
    const cacheDir = path.join(os.homedir(), '.cache', 'short-video-director', hash);
    await rm(cacheDir, { recursive: true, force: true });

    const { cacheSkillsDir } = await loadAndTransform(PROJECT_ROOT);
    const metaDir = path.join(cacheSkillsDir, '_meta', 'rules');

    // _meta/rules/ 目录应存在
    const metaStat = await stat(metaDir);
    assert.ok(metaStat.isDirectory(), 'cacheSkillsDir/_meta/rules/ should be a directory');

    // 4 个共享 rules 文件全部存在
    const expected = [
      'output-language.md',
      'review-meta-rules.md',
      'visual-prompt-craft-common.md',
      'visual-prompt-craft-video.md',
    ];
    for (const f of expected) {
      const fStat = await stat(path.join(metaDir, f));
      assert.ok(fStat.isFile(), `${f} should be copied to cache`);
    }
  });
});

describe('loadAndTransform copies scripts/', () => {
  test('cache miss creates cacheDir/scripts/ preserving source file modes', async () => {
    const { cacheSkillsDir } = await loadAndTransform(PROJECT_ROOT);
    const cacheRoot = path.dirname(cacheSkillsDir);
    const cacheScriptsDir = path.join(cacheRoot, 'scripts');

    // scripts/ 目录应存在
    const scriptsStat = await stat(cacheScriptsDir);
    assert.ok(scriptsStat.isDirectory(), 'cacheDir/scripts/ should be a directory');

    // 至少应包含 storyboard-to-prompt.sh
    const targetScript = path.join(cacheScriptsDir, 'storyboard-to-prompt.sh');
    const targetStat = await stat(targetScript);
    assert.ok(targetStat.isFile(), 'storyboard-to-prompt.sh should be copied');

    // .sh 文件应保留源文件 mode（fs.copyFile 默认保留 mode 位；
    // 注：此 repo 源 scripts/*.sh 实际为 0644，通过 `bash script.sh` 调用，
    // 故断言"mode 与源一致"而非"必有 +x"）
    if (process.platform !== 'win32') {
      const srcScript = path.join(PROJECT_ROOT, 'scripts', 'storyboard-to-prompt.sh');
      const srcStat = await stat(srcScript);
      const srcMode = srcStat.mode & 0o777;
      const dstMode = targetStat.mode & 0o777;
      assert.equal(dstMode, srcMode, `target mode should match source (src=${srcMode.toString(8)} dst=${dstMode.toString(8)})`);
    }
  });

  test('cache hit does not trigger second copy (mtime stable)', async () => {
    // 第 1 次：cache miss → 复制
    const r1 = await loadAndTransform(PROJECT_ROOT);
    const cacheRoot = path.dirname(r1.cacheSkillsDir);
    const scriptPath = path.join(cacheRoot, 'scripts', 'storyboard-to-prompt.sh');
    const mtime1 = (await stat(scriptPath)).mtimeMs;

    // 等几毫秒确保 mtime 分辨率足够
    await new Promise(r => setTimeout(r, 10));

    // 第 2 次：cache hit → 不应重新复制
    const r2 = await loadAndTransform(PROJECT_ROOT);
    assert.equal(r2.cacheSkillsDir, r1.cacheSkillsDir);
    const mtime2 = (await stat(scriptPath)).mtimeMs;
    assert.equal(mtime2, mtime1, 'cache hit should not re-copy scripts (mtime should stay)');
  });
});
