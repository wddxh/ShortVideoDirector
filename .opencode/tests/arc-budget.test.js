import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/arc-budget.sh');

function setupConfig(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-budget-'));
  writeFileSync(join(dir, 'config.md'), content);
  return dir;
}

function run(cwd, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

test('范围分钟: 3-5 分钟, 3 集 → 900', () => {
  const dir = setupConfig('- 每集时长目标: 3-5 分钟\n');
  try {
    const r = run(dir, '3');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '900');
  } finally { rmSync(dir, { recursive: true }); }
});

test('范围秒: 60-120 秒, 3 集 → 360', () => {
  const dir = setupConfig('- 每集时长目标: 60-120 秒\n');
  try {
    const r = run(dir, '3');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '360');
  } finally { rmSync(dir, { recursive: true }); }
});

test('单值分钟 4 分钟: 3 集 → 720', () => {
  const dir = setupConfig('- 每集时长目标: 4 分钟\n');
  try {
    const r = run(dir, '3');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '720');
  } finally { rmSync(dir, { recursive: true }); }
});

test('ep_count=0 → 退出码 1', () => {
  const dir = setupConfig('- 每集时长目标: 3-5 分钟\n');
  try {
    const r = run(dir, '0');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ep_count/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('config 缺字段 → 退出码 1', () => {
  const dir = setupConfig('- 总集数: 10\n');
  try {
    const r = run(dir, '3');
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /每集时长目标/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('config 文件不存在 → 退出码 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'svd-budget-noconfig-'));
  try {
    const r = run(dir, '3');
    assert.notEqual(r.status, 0);
  } finally { rmSync(dir, { recursive: true }); }
});

test('单值秒 90s: 3 集 → 270', () => {
  const dir = setupConfig('- 每集时长目标: 90s\n');
  try {
    const r = run(dir, '3');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), '270');
  } finally { rmSync(dir, { recursive: true }); }
});
