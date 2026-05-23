import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/read-config.sh');

function setupConfig(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-rc-'));
  writeFileSync(join(dir, 'config.md'), content);
  return dir;
}

function run(cwd, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

test('每集时长目标: 3-5 分钟 → 字面返回', () => {
  const dir = setupConfig('- 每集时长目标: 3-5 分钟\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '3-5 分钟');
  } finally { rmSync(dir, { recursive: true }); }
});

test('每集时长目标: 240s → 字面返回', () => {
  const dir = setupConfig('- 每集时长目标: 240s\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '240s');
  } finally { rmSync(dir, { recursive: true }); }
});

test('字段缺失 → 退出码 1', () => {
  const dir = setupConfig('- 总集数: 10\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.notEqual(r.status, 0);
  } finally { rmSync(dir, { recursive: true }); }
});

test('既有用法不受影响: 总集数: 10 → 10', () => {
  const dir = setupConfig('- 总集数: 10\n');
  try {
    const r = run(dir, '总集数');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '10');
  } finally { rmSync(dir, { recursive: true }); }
});

test('注释行被忽略', () => {
  const dir = setupConfig('# - 每集时长目标: 3-5 分钟  (注释)\n- 每集时长目标: 1-2 分钟\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '1-2 分钟');
  } finally { rmSync(dir, { recursive: true }); }
});

test('inline 注释剥离: 每集时长目标: 90s # 测试用 → 90s', () => {
  const dir = setupConfig('- 每集时长目标: 90s # 测试用\n');
  try {
    const r = run(dir, '每集时长目标');
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '90s');
  } finally { rmSync(dir, { recursive: true }); }
});
