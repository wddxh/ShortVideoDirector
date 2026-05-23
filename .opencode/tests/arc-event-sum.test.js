import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/arc-event-sum.sh');

function setupArc(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-arcsum-'));
  const file = join(dir, 'arc.md');
  writeFileSync(file, content);
  return { dir, file };
}

function run(file) {
  return spawnSync('bash', [SCRIPT, file], { encoding: 'utf8' });
}

const PASS_ARC = `## 主线 (A 线)

### 节点 1: 入职 (ep01-03, 节点预算 ~900s)
- 核心事件:
  - 主角被逐出师门 (~180s, 必需)
  - 流落街头加入平台 (~150s, 必需)
  - 摸清平台规则 (~200s, 必需)
  - 首单嘴炮翻盘 (~280s, 必需)
- 推进目标: 立人设
- 关键转折: ep01 师门除名
`;

test('PASS: 全 bullet 含标记 sum ≤ 预算', () => {
  const { dir, file } = setupArc(PASS_ARC);
  try {
    const r = run(file);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /PASS/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: sum > 预算', () => {
  const arc = PASS_ARC.replace('(~280s', '(~500s');
  const { dir, file } = setupArc(arc);
  try {
    const r = run(file);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /sum=/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: bullet 缺估时', () => {
  const arc = PASS_ARC.replace('(~280s, 必需)', '(必需)');
  const { dir, file } = setupArc(arc);
  try {
    const r = run(file);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /schema/i);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: bullet 缺必需|可选', () => {
  const arc = PASS_ARC.replace('(~280s, 必需)', '(~280s)');
  const { dir, file } = setupArc(arc);
  try {
    const r = run(file);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: 标记顺序错位 (必需, ~Ns)', () => {
  const arc = PASS_ARC.replace('(~280s, 必需)', '(必需, ~280s)');
  const { dir, file } = setupArc(arc);
  try {
    const r = run(file);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('WARN PASS: 可选 sum >40%', () => {
  const arc = `## 主线 (A 线)

### 节点 1: 入职 (ep01-03, 节点预算 ~900s)
- 核心事件:
  - 主角被逐出师门 (~100s, 必需)
  - 街头偶遇 1 (~100s, 可选)
  - 街头偶遇 2 (~100s, 可选)
  - 街头偶遇 3 (~200s, 可选)
- 推进目标: 立人设
`;
  const { dir, file } = setupArc(arc);
  try {
    const r = run(file);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /WARN/);
    assert.match(r.stdout, /可选/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: 节点 header 缺预算字段', () => {
  const arc = PASS_ARC.replace('(ep01-03, 节点预算 ~900s)', '(ep01-03)');
  const { dir, file } = setupArc(arc);
  try {
    const r = run(file);
    assert.notEqual(r.status, 0);
    assert.match(r.stdout, /FAIL/);
    assert.match(r.stdout, /节点预算/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL: arc.md 不存在', () => {
  const r = spawnSync('bash', [SCRIPT, '/nonexistent/arc.md'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});
