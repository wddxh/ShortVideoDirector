import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/scene-duration.sh');

function setupTmp(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-dur-'));
  const file = join(dir, 'script.md');
  writeFileSync(file, content);
  return { dir, file };
}

function run(file, ...args) {
  return spawnSync('bash', [SCRIPT, file, ...args], { encoding: 'utf8' });
}

test('PASS: 三场景 sum 落在范围内 (--target 60)', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 15s\n## 场景 2\n- 目标时长: 20s\n## 场景 3\n- 目标时长: 25s\n'
  );
  try {
    const r = run(file, '--target', '60');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /PASS/);
    assert.match(r.stdout, /sum=60s/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('PASS: sum=65 在 ±10% 容差内 (--target 60)', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 30s\n## 场景 2\n- 目标时长: 35s\n'
  );
  try {
    const r = run(file, '--target', '60');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /PASS/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: sum=70 超出 ±10% 容差上限 (--target 60)', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 30s\n## 场景 2\n- 目标时长: 40s\n'
  );
  try {
    const r = run(file, '--target', '60');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('PASS: sum 在 [target-min, target-max] 范围内', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 60s\n## 场景 2\n- 目标时长: 90s\n## 场景 3\n- 目标时长: 80s\n'
  );
  try {
    const r = run(file, '--target-min', '180', '--target-max', '300');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /PASS/);
    assert.match(r.stdout, /sum=230s/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: sum 低于 target-min', () => {
  const { dir, file } = setupTmp('## 场景 1\n- 目标时长: 100s\n');
  try {
    const r = run(file, '--target-min', '180', '--target-max', '300');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /below min/);
  } finally { rmSync(dir, { recursive: true }); }
});
