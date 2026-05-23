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

test('FAIL: script.md 无任何场景目标时长字段', () => {
  const { dir, file } = setupTmp('## 场景 1\n(没有时长字段)\n');
  try {
    const r = run(file, '--target', '60');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /sum=0s/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('exit code 2: 缺少参数', () => {
  const r = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('exit code 2: 未知 flag', () => {
  const { dir, file } = setupTmp('## 场景 1\n- 目标时长: 60s\n');
  try {
    const r = run(file, '--bogus', '60');
    assert.equal(r.status, 2);
  } finally { rmSync(dir, { recursive: true }); }
});

// outline 阶段调用 fixtures (spec §9.1)
test('outline: 范围 3-5 分钟, sum=240s → PASS', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 60s\n## 场景 2\n- 目标时长: 90s\n## 场景 3\n- 目标时长: 90s\n'
  );
  try {
    const r = run(file, '--target-min', '180', '--target-max', '300');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /PASS/);
    assert.match(r.stdout, /sum=240s/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('outline: 范围 3-5 分钟, sum=150s → FAIL below', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 50s\n## 场景 2\n- 目标时长: 100s\n'
  );
  try {
    const r = run(file, '--target-min', '180', '--target-max', '300');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /below min/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('outline: 范围 3-5 分钟, sum=350s → FAIL exceeds', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 150s\n## 场景 2\n- 目标时长: 200s\n'
  );
  try {
    const r = run(file, '--target-min', '180', '--target-max', '300');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /exceeds max/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('outline: 单值 240s, sum=220s → PASS (±10%)', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 100s\n## 场景 2\n- 目标时长: 120s\n'
  );
  try {
    const r = run(file, '--target', '240');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /PASS/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('outline: 单值 240s, sum=280s → FAIL 超 ±10%', () => {
  const { dir, file } = setupTmp(
    '## 场景 1\n- 目标时长: 140s\n## 场景 2\n- 目标时长: 140s\n'
  );
  try {
    const r = run(file, '--target', '240');
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
  } finally { rmSync(dir, { recursive: true }); }
});
