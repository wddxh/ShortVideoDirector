import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/storyboard-to-prompt.sh');

function setupTmp(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-sb2prompt-'));
  const file = join(dir, 'storyboard.md');
  writeFileSync(file, content);
  return { dir, file };
}

function run(file, shotNum) {
  return spawnSync('bash', [SCRIPT, file, String(shotNum)], { encoding: 'utf8' });
}

test('PASS: shot extraction returns IMAGES/DURATION/--- with substitutions', () => {
  const content = `# ep01 分镜

## 场景 1: 测试场景 (剧本目标 10s, 切片 sum 10s ✓)

### shot 1
- 镜头类型: 中景
- 镜头运动: 固定
- 时长：10s
- 出场人物:
  - [测试角色](assets/characters/测试角色.md)
    声音特征: 测试声音
- 引用资产:
  - [测试场景](assets/locations/测试场景.md)
  - [KF-01](assets/keyframes/ep01/KF-01.md)
- 转场: 切

**画面与声音描述：**
[0s-10s] 画面首帧是 [KF-01]，[测试角色] 走入 [测试场景]。
`;
  const { dir, file } = setupTmp(content);
  try {
    const r = run(file, 1);
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stderr=${r.stderr}`);
    assert.match(r.stdout, /^IMAGES:/m);
    assert.match(r.stdout, /^DURATION:10/m);
    assert.match(r.stdout, /^---$/m);
    assert.match(r.stdout, /\[测试角色:\{图片\d+\}\]/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('FAIL: shot not found returns FAIL message + exit 1', () => {
  const content = `### shot 1
- 时长：5s

**画面与声音描述：**
[0s-5s] something.
`;
  const { dir, file } = setupTmp(content);
  try {
    const r = run(file, 99);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /FAIL shot 99 not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PASS: same asset referenced twice in shot deduplicates in IMAGES', () => {
  const content = `### shot 1
- 时长：8s
- 出场人物:
  - [角色A](assets/characters/角色A.md)
    声音特征: 测试
  - [角色A](assets/characters/角色A.md)
    声音特征: 测试
- 引用资产:
  - [场景X](assets/locations/场景X.md)
- 转场: 切

**画面与声音描述：**
[0s-8s] [角色A] 在 [场景X] 移动。
`;
  const { dir, file } = setupTmp(content);
  try {
    const r = run(file, 1);
    assert.equal(r.status, 0);
    const imagesLine = r.stdout.split('\n').find(l => l.startsWith('IMAGES:'));
    assert.ok(imagesLine, 'IMAGES line missing');
    const paths = imagesLine.replace('IMAGES:', '').split(',').filter(Boolean);
    const unique = new Set(paths);
    assert.equal(paths.length, unique.size, `paths should be unique, got ${paths}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PASS: bare [KF-id] in body substituted to {图片N} matching header N', () => {
  const content = `### shot 1
- 时长：6s
- 引用资产:
  - [KF-77](assets/keyframes/ep01/KF-77.md)
- 转场: 切

**画面与声音描述：**
[0s-6s] 画面首帧是 [KF-77]，开场。
[3s-6s] 画面参考 [KF-77]，回响。
`;
  const { dir, file } = setupTmp(content);
  try {
    const r = run(file, 1);
    assert.equal(r.status, 0);
    const headerMatch = r.stdout.match(/\[KF-77:\{图片(\d+)\}\]/);
    assert.ok(headerMatch, 'header [KF-77:{图片N}] missing');
    const n = headerMatch[1];
    const bodyMatches = [...r.stdout.matchAll(/\[\{图片(\d+)\}\]/g)];
    assert.ok(bodyMatches.length >= 2, `body should have ≥2 [{图片N}], got ${bodyMatches.length}`);
    for (const m of bodyMatches) {
      assert.equal(m[1], n, `body {图片${m[1]}} should match header {图片${n}}`);
    }
    const bodyStart = r.stdout.indexOf('**画面与声音描述');
    const body = r.stdout.slice(bodyStart);
    assert.equal(body.includes('[KF-77]'), false, `bare [KF-77] should be substituted`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
