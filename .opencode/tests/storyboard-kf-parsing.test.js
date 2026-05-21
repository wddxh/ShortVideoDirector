import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/parse-storyboard-kf.sh');

function setupTmp(content) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-kfparse-'));
  const file = join(dir, 'storyboard.md');
  writeFileSync(file, content);
  return { dir, file };
}

function run(file) {
  return spawnSync('bash', [SCRIPT, file], { encoding: 'utf8' });
}

const SHOT1 = `# ep01 分镜

## 场景 1: 天台 (剧本目标 20s, 切片 sum 20s ✓, 容差 ±10% → [18s, 22s])

### shot 1
- 镜头类型: 中景
- 引用资产:
  - [KF-EP01-001](assets/keyframes/ep01/KF-EP01-001.md)

**画面与声音描述：**
[0s-4s] 画面首帧是 [KF-EP01-001]，张三推门走出。
张三 (急促): "终于到了。"

[4s-8s] 画面尾帧是 [KF-EP01-002]，他停在栏杆前。

### shot 2
- 镜头类型: 特写
- 引用资产:
  - [KF-EP01-002](assets/keyframes/ep01/KF-EP01-002.md)
  - [KF-EP01-003](assets/keyframes/ep01/KF-EP01-003.md)

**画面与声音描述：**
[0s-3s] 画面首帧是 [KF-EP01-002]，特写他的手。
[3s-7s] 画面参考 [KF-EP01-003]，雨水滴落。
`;

test('PASS: 解析三种位置语义 (首帧/尾帧/参考)', () => {
  const { dir, file } = setupTmp(SHOT1);
  try {
    const r = run(file);
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trim().split('\n');
    assert.deepEqual(lines, [
      'KF-EP01-001\t首帧\t1',
      'KF-EP01-002\t尾帧\t1',
      'KF-EP01-002\t首帧\t2',
      'KF-EP01-003\t参考\t2',
    ]);
  } finally { rmSync(dir, { recursive: true }); }
});

test('PASS: 同一 KF 在多 shot 中出现，每次独立记录', () => {
  const { dir, file } = setupTmp(SHOT1);
  try {
    const r = run(file);
    assert.equal(r.status, 0);
    const occurrences = r.stdout.split('\n').filter(l => l.includes('KF-EP01-002'));
    assert.equal(occurrences.length, 2);
  } finally { rmSync(dir, { recursive: true }); }
});

test('FAIL exit 2: KF 引用缺位置语义', () => {
  const { dir, file } = setupTmp(`### shot 1

**画面与声音描述：**
[0s-4s] 这里直接 [KF-EP01-001] 没有位置语义。
`);
  try {
    const r = run(file);
    assert.equal(r.status, 2, `expected 2 got ${r.status}: ${r.stderr}`);
    assert.match(r.stderr, /PARSE_ERROR.*position marker/);
  } finally { rmSync(dir, { recursive: true }); }
});

test('PASS: 无 KF 引用 (空输出, exit 0)', () => {
  const { dir, file } = setupTmp(`### shot 1
- 镜头类型: 中景

**画面与声音描述：**
[0s-4s] 张三走出，无任何 KF 引用。
`);
  try {
    const r = run(file);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally { rmSync(dir, { recursive: true }); }
});

test('PASS: 引用资产 section 中的 markdown 链接不参与解析', () => {
  const { dir, file } = setupTmp(`### shot 1
- 引用资产:
  - [KF-EP01-001](assets/keyframes/ep01/KF-EP01-001.md)

**画面与声音描述：**
[0s-4s] 画面首帧是 [KF-EP01-001]，正常引用。
`);
  try {
    const r = run(file);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), 'KF-EP01-001\t首帧\t1');
  } finally { rmSync(dir, { recursive: true }); }
});

test('exit 1: 文件不存在', () => {
  const r = spawnSync('bash', [SCRIPT, '/nonexistent/file.md'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});

test('exit 1: 缺参数', () => {
  const r = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
  assert.equal(r.status, 1);
});
