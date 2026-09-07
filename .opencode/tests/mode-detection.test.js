import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/detect-mode.sh');

test('uses supplied config and rejects invalid mode', () => {
  const dir = setupTmpProject('mode: short', true);
  try {
    writeFileSync(join(dir, 'custom.md'), '- mode: series\n');
    assert.equal(runIn(dir, 'custom.md').stdout.trim(), 'series');
    writeFileSync(join(dir, 'custom.md'), '- mode: invalid\n');
    assert.equal(runIn(dir, 'custom.md').status, 1);
  } finally { rmSync(dir, { recursive: true }); }
});

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

function runIn(dir, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
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

test('accepts the bullet mode format written by entry workflows', () => {
  for (const mode of ['series', 'short']) {
    const dir = setupTmpProject(`- mode: ${mode}\n`, false);
    try {
      const result = runIn(dir);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), mode);
    } finally { rmSync(dir, { recursive: true }); }
  }
});

test('accepts inline comments in bullet mode from the supplied config', () => {
  const dir = setupTmpProject('- mode: series\n', false);
  try {
    writeFileSync(join(dir, 'custom.md'), '- mode: short # single episode\n');
    const result = runIn(dir, 'custom.md');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'short\n');
  } finally { rmSync(dir, { recursive: true }); }
});

test('missing mode is rejected even with an arc', () => {
  const dir = setupTmpProject('其他: x\n非 mode 字段: y', true);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
  } finally { rmSync(dir, { recursive: true }); }
});

test('missing mode is not implicitly short', () => {
  const dir = setupTmpProject('其他: x', false);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
  } finally { rmSync(dir, { recursive: true }); }
});

test('missing config with arc is rejected', () => {
  const dir = setupTmpProject(null, true);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
  } finally { rmSync(dir, { recursive: true }); }
});

test('missing config without arc is rejected', () => {
  const dir = setupTmpProject(null, false);
  try {
    const r = runIn(dir);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
  } finally { rmSync(dir, { recursive: true }); }
});
