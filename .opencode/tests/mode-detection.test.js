import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/detect-mode.sh');

function setupTmpProject(configContent, hasArc) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-mode-'));
  if (configContent !== null) {
    writeFileSync(join(dir, 'config.md'), configContent);
  }
  if (hasArc) {
    mkdirSync(join(dir, 'story'), { recursive: true });
    writeFileSync(join(dir, 'story/arc.md'), '# arc');
  }
  return dir;
}

function runIn(dir) {
  return spawnSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8' });
}

test('config.md mode=series → series', () => {
  const dir = setupTmpProject('mode: series\n其他: x', false);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'series');
  } finally { rmSync(dir, { recursive: true }); }
});

test('config.md mode=short → short', () => {
  const dir = setupTmpProject('mode: short', false);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'short');
  } finally { rmSync(dir, { recursive: true }); }
});

test('config.md 无 mode 字段 + story/arc.md 存在 → series', () => {
  const dir = setupTmpProject('其他: x\n非 mode 字段: y', true);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'series');
  } finally { rmSync(dir, { recursive: true }); }
});

test('config.md 无 mode + 无 story/arc.md → short', () => {
  const dir = setupTmpProject('其他: x', false);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'short');
  } finally { rmSync(dir, { recursive: true }); }
});

test('config.md 不存在 + story/arc.md 存在 → series', () => {
  const dir = setupTmpProject(null, true);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'series');
  } finally { rmSync(dir, { recursive: true }); }
});

test('config.md 不存在 + 无 arc.md → short', () => {
  const dir = setupTmpProject(null, false);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'short');
  } finally { rmSync(dir, { recursive: true }); }
});
