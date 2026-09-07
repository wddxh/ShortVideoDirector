import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, readFileSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { videoProject } from './fixtures/video-project.js';

const scripts = join(process.cwd(), 'scripts');
const run = (p, script, args, config) => spawnSync('node', [join(scripts, script), ...args],
  { cwd: p.root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: config } });

test('config aliases share canonical evidence and video profile identity', (t) => {
  const p = videoProject(t);
  p.write('config.md', '- mode: series\n- 视频提供方: dreamina\n- 视频模型版本: fixture\n- 视频比例: 16:9\n- 视频分辨率: 720p\n');
  p.evidence();
  mkdirSync(join(p.root, 'settings'));
  renameSync(join(p.root, 'config.md'), join(p.root, 'settings/live.md'));
  const ep = join(p.root, 'story/episodes/ep01');
  for (const file of readdirSync(ep).filter(name => name.startsWith('.review-'))) {
    const target = join(ep, file);
    writeFileSync(target, readFileSync(target, 'utf8').replaceAll('"config.md"', '"settings/live.md"'));
  }
  p.write('config.md', '- mode: short\n- 视频提供方: none\n');
  for (const config of ['settings/live.md', './settings/live.md', join(p.root, 'settings/live.md')]) {
    const normalized = run(p, 'review-evidence.mjs', ['config-path'], config);
    assert.equal(normalized.status, 0, normalized.stderr);
    assert.equal(normalized.stdout.trim(), 'settings/live.md');
    const profile = run(p, 'video-task-inputs.mjs', ['profile', p.tasks], config);
    assert.equal(profile.status, 0, profile.stderr);
    assert.equal(JSON.parse(profile.stdout).mode, 'series');
    const review = run(p, 'review-evidence.mjs', ['check', 'ep01', '1'], config);
    assert.equal(review.status, 0, review.stdout + review.stderr);
    const checked = spawnSync('bash', [join(scripts, 'check-episode.sh'), 'ep01', normalized.stdout.trim()],
      { cwd: p.root, encoding: 'utf8' });
    assert.match(checked.stdout, /mode:series/);
    assert.match(checked.stdout, /script-review:ok/);
  }
});

test('config normalization rejects external paths without writes, permits missing local setup', (t) => {
  const p = videoProject(t);
  const outside = videoProject(t);
  symlinkSync(outside.root, join(p.root, 'external'));
  const before = readFileSync(join(p.root, p.tasks), 'utf8');
  for (const config of [join(outside.root, 'config.md'), 'external/config.md']) {
    for (const [script, args] of [['review-evidence.mjs', ['config-path']],
      ['review-evidence.mjs', ['check', 'ep01']], ['video-task-inputs.mjs', ['profile', p.tasks]]]) {
      const result = run(p, script, args, config);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /External config is unsupported/);
    }
  }
  const missing = run(p, 'review-evidence.mjs', ['config-path'], './new/settings.md');
  assert.equal(missing.status, 0, missing.stderr);
  assert.equal(missing.stdout.trim(), 'new/settings.md');
  assert.equal(readFileSync(join(p.root, p.tasks), 'utf8'), before);
});
