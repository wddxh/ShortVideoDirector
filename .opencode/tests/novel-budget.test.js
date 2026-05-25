import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/novel-budget.sh');
const WC = join(process.cwd(), 'scripts/word-count.sh');

function setupEp(outlineContent, novelContent) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-novel-budget-'));
  const epDir = join(dir, 'story/episodes/ep01');
  mkdirSync(epDir, { recursive: true });
  // copy word-count.sh into temp's scripts/ so relative call from SCRIPT works
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(WC, join(dir, 'scripts/word-count.sh'));
  if (outlineContent !== null) writeFileSync(join(epDir, 'outline.md'), outlineContent);
  if (novelContent !== null) writeFileSync(join(epDir, 'novel.md'), novelContent);
  return dir;
}

function run(cwd, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

function parse(stdout) {
  const out = {};
  for (const line of stdout.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

test('status=ok: actual 在 ±30% 内', () => {
  const outline = `## 场景 1\n- **目标时长:** 10s\n## 场景 2\n- **目标时长:** 10s\n`;
  const novel = '中'.repeat(200) + '\n';
  const dir = setupEp(outline, novel);
  try {
    const r = run(dir, 'ep01');
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    const out = parse(r.stdout);
    assert.equal(out.status, 'ok');
    assert.equal(out.duration_sum, '20');
    assert.equal(out.expected_lower, '140');
    assert.equal(out.expected_upper, '260');
    assert.equal(out.actual, '200');
  } finally { rmSync(dir, { recursive: true }); }
});

test('status=fail: actual 远低于 expected', () => {
  const outline = `## 场景 1\n- **目标时长:** 100s\n`;
  const novel = '中'.repeat(50) + '\n';
  const dir = setupEp(outline, novel);
  try {
    const r = run(dir, 'ep01');
    const out = parse(r.stdout);
    assert.equal(out.status, 'fail');
    assert.equal(out.actual, '50');
  } finally { rmSync(dir, { recursive: true }); }
});

test('status=missing:outline 当 outline 不存在', () => {
  const dir = setupEp(null, '中'.repeat(100));
  try {
    const r = run(dir, 'ep01');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^status:missing:outline$/m);
  } finally { rmSync(dir, { recursive: true }); }
});

test('status=missing:novel 当 novel 不存在', () => {
  const outline = `## 场景 1\n- **目标时长:** 10s\n`;
  const dir = setupEp(outline, null);
  try {
    const r = run(dir, 'ep01');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^status:missing:novel$/m);
  } finally { rmSync(dir, { recursive: true }); }
});

test('status=missing:duration 当 outline 无目标时长字段', () => {
  const outline = `## 场景 1\n（无目标时长字段）\n`;
  const dir = setupEp(outline, '中'.repeat(100));
  try {
    const r = run(dir, 'ep01');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^status:missing:duration$/m);
  } finally { rmSync(dir, { recursive: true }); }
});

test('status=ok with no-bold outline format (- 目标时长: 45s)', () => {
  const outline = `## 场景 1\n- 目标时长: 45s\n## 场景 2\n- 目标时长: 40s\n`;
  const novel = '中'.repeat(800);
  const dir = setupEp(outline, novel);
  try {
    const r = run(dir, 'ep01');
    const out = parse(r.stdout);
    assert.equal(out.status, 'ok');
    assert.equal(out.duration_sum, '85');
  } finally { rmSync(dir, { recursive: true }); }
});

test('status=ok with 全角 colon + 秒 unit', () => {
  const outline = `## 场景 1\n- **目标时长**：45 秒\n## 场景 2\n- **目标时长**：40 秒\n`;
  const novel = '中'.repeat(800);
  const dir = setupEp(outline, novel);
  try {
    const r = run(dir, 'ep01');
    const out = parse(r.stdout);
    assert.equal(out.status, 'ok');
    assert.equal(out.duration_sum, '85');
  } finally { rmSync(dir, { recursive: true }); }
});
