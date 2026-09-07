import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/script-budget.sh');
const WC = join(process.cwd(), 'scripts/word-count.sh');

function setupEp(scriptContent) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-script-budget-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(WC, join(dir, 'scripts/word-count.sh'));
  const epDir = join(dir, 'story/episodes/ep01');
  mkdirSync(epDir, { recursive: true });
  if (scriptContent !== null) writeFileSync(join(epDir, 'script.md'), scriptContent);
  return dir;
}

function run(cwd, ...args) {
  return spawnSync('bash', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}

test('H2 appendices do not inflate scenes, including the last scene', () => {
  const scene = `## 场景 1: A\n- 目标时长: 10s\n${'中'.repeat(90)}\n`;
  const dir = setupEp(scene);
  try {
    const baseline = run(dir, 'ep01');
    assert.equal(baseline.status, 0, baseline.stderr);
    const appendix = `## 本集资产清单\n### 新增资产\n- characters: ${'甲'.repeat(200)}\n`;
    writeFileSync(join(dir, 'story/episodes/ep01/script.md'), scene + appendix);
    const r = run(dir, 'ep01');
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, baseline.stdout);

    const second = scene.replace('场景 1', '场景 2');
    writeFileSync(join(dir, 'story/episodes/ep01/script.md'), scene + second);
    const twoScenes = run(dir, 'ep01');
    writeFileSync(join(dir, 'story/episodes/ep01/script.md'),
      scene + appendix + second + `## 制作备注\n${'乙'.repeat(200)}\n`);
    const withAppendices = run(dir, 'ep01');
    assert.equal(withAppendices.status, 0, withAppendices.stderr);
    assert.equal(withAppendices.stdout, twoScenes.stdout);
  } finally { rmSync(dir, { recursive: true }); }
});

test('单场景 ok: actual 在 [lower, upper]', () => {
  const script = `# ep01\n\n## 场景 1: 测试场景\n- 目标时长: 10s\n${'中'.repeat(90)}\n`;
  const dir = setupEp(script);
  try {
    const r = run(dir, 'ep01');
    assert.equal(r.status, 0, `stderr=${r.stderr}`);
    assert.match(r.stdout, /^scene:1:.*status=ok$/m);
    assert.match(r.stdout, /^summary:.*status=ok$/m);
    assert.match(r.stdout, /scene_count=1/);
    assert.match(r.stdout, /scenes_ok=1/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('单场景 fail (低): actual < lower', () => {
  const script = `## 场景 1: 短\n- 目标时长: 20s\n${'中'.repeat(50)}\n`;
  const dir = setupEp(script);
  try {
    const r = run(dir, 'ep01');
    assert.match(r.stdout, /^scene:1:.*expected_lower=160.*status=fail$/m);
    assert.match(r.stdout, /^summary:.*status=fail$/m);
  } finally { rmSync(dir, { recursive: true }); }
});
// PART1_END

test('单场景 fail (高): actual > upper', () => {
  const script = `## 场景 1: 过多\n- 目标时长: 10s\n${'中'.repeat(200)}\n`;
  const dir = setupEp(script);
  try {
    const r = run(dir, 'ep01');
    assert.match(r.stdout, /^scene:1:.*expected_upper=104.*status=fail$/m);
    assert.match(r.stdout, /^summary:.*status=fail$/m);
  } finally { rmSync(dir, { recursive: true }); }
});

test('missing:script when script.md absent', () => {
  const dir = setupEp(null);
  try {
    const r = run(dir, 'ep01');
    assert.match(r.stdout, /^status:missing:script$/m);
  } finally { rmSync(dir, { recursive: true }); }
});

test('installed budget script uses its sibling helper, not project cwd', () => {
  const dir = setupEp(`## 场景 1: A\n- 目标时长: 10s\n${'中'.repeat(90)}\n`);
  try {
    const baseline = run(dir, 'ep01');
    assert.match(baseline.stdout, /^summary:.*status=ok$/m);
    const installed = join(dir, 'installed scripts');
    mkdirSync(installed);
    copyFileSync(SCRIPT, join(installed, 'script-budget.sh'));
    copyFileSync(WC, join(installed, 'word-count.sh'));
    rmSync(join(dir, 'scripts'), { recursive: true });
    const r = spawnSync('bash', [join(installed, 'script-budget.sh'), 'ep01'],
      { cwd: dir, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, baseline.stdout);
  } finally { rmSync(dir, { recursive: true }); }
});

test('多场景 summary: 2 ok + 1 fail → status=fail', () => {
  const script = `## 场景 1: A\n- 目标时长: 10s\n${'中'.repeat(90)}\n\n## 场景 2: B\n- 目标时长: 20s\n${'中'.repeat(180)}\n\n## 场景 3: C\n- 目标时长: 30s\n${'中'.repeat(100)}\n`;
  const dir = setupEp(script);
  try {
    const r = run(dir, 'ep01');
    assert.match(r.stdout, /scene_count=3/);
    assert.match(r.stdout, /scenes_ok=2/);
    assert.match(r.stdout, /scenes_fail=1/);
    assert.match(r.stdout, /^summary:.*status=fail$/m);
  } finally { rmSync(dir, { recursive: true }); }
});
