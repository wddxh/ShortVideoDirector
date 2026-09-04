import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/storyboard-to-prompt.sh');

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function project(fn) {
  const root = mkdtempSync(join(tmpdir(), 'svd-video-prompt-'));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

function shot(number = 1, duration = 8) {
  return `### shot ${number}
- 镜头类型：中景
- 镜头运动：跟
- 视频风格：写实
- 时长：${duration}s
- 出场人物：
  - [阿青](assets/characters/阿青.md)
    声音特征：清亮
  - [阿青](assets/characters/阿青.md)
    声音特征：清亮
- 引用资产：
  - [古城](assets/locations/古城.md)
  - [铜镜](assets/items/铜镜.md)
- 转场：切

**画面与声音描述：**
[0s-${duration}s] 阿青向画面右侧走到铜镜前，最终面向古城城门停下。
阿青 (压低声音): "别回头。"
远处钟声响起。`;
}

function validProject(root, block = shot()) {
  write(root, 'story/episodes/ep01/storyboard.md', `# ep01 分镜\n\n${block}\n`);
  write(root, 'assets/storyboard-sheets/ep01/shot01.md', '# sheet\n');
  for (const path of [
    'assets/images/storyboard-sheets/ep01/shot01.png',
    'assets/images/characters/阿青.png',
    'assets/images/locations/古城.png',
    'assets/images/items/铜镜.png',
  ]) write(root, path, 'png');
}

function run(root, shotNumber = 1) {
  return spawnSync('bash', [SCRIPT, 'story/episodes/ep01/storyboard.md', String(shotNumber)], {
    cwd: root,
    encoding: 'utf8',
  });
}

function fail(result, pattern, status = 1) {
  assert.equal(result.status, status, result.stderr || result.stdout);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^FAIL /);
  assert.match(result.stderr, pattern);
}

test('emits sheet first, stable deduplicated assets, duration, and verbatim shot', () => {
  project((root) => {
    const block = shot();
    validProject(root, block);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.split('\n');
    assert.equal(lines[0], 'IMAGES:assets/images/storyboard-sheets/ep01/shot01.png,assets/images/characters/阿青.png,assets/images/locations/古城.png,assets/images/items/铜镜.png');
    assert.equal(lines[1], 'DURATION:8');
    assert.equal(lines[2], '---');
    assert.match(result.stdout, /\*\*视频参考图：\*\* \[CURRENT_SHOT_STORYBOARD_SHEET:\{图片1\}\].*\[阿青:\{图片2\}\].*\[古城:\{图片3\}\].*\[铜镜:\{图片4\}\]/);
    assert.match(result.stdout, /^\*\*分镜板解释规则：\*\* /m);
    assert.ok(result.stdout.endsWith(`${block}\n`), 'shot block must remain byte-for-byte intact');
  });
});

test('selects only an exact unique shot heading', () => {
  project((root) => {
    validProject(root, `${shot(1)}\n\n### shot 10\n- 时长：5s\n`);
    assert.equal(run(root, 1).status, 0);
    write(root, 'story/episodes/ep01/storyboard.md', `${shot(1)}\n\n${shot(1)}\n`);
    fail(run(root, 1), /duplicate shot 1/);
    fail(run(root, 2), /shot 2 not found/);
  });
});

test('fails before output when duration, card, sheet PNG, or base PNG is missing', () => {
  const cases = [
    ['duration', (root) => write(root, 'story/episodes/ep01/storyboard.md', `${shot().replace('- 时长：8s\n', '')}\n`)],
    ['card', (root) => rmSync(join(root, 'assets/storyboard-sheets/ep01/shot01.md'))],
    ['storyboard sheet image', (root) => rmSync(join(root, 'assets/images/storyboard-sheets/ep01/shot01.png'))],
    ['reference image', (root) => rmSync(join(root, 'assets/images/items/铜镜.png'))],
  ];
  for (const [message, mutate] of cases) project((root) => {
    validProject(root);
    mutate(root);
    fail(run(root), new RegExp(message));
  });
});

test('runs central legacy detector before conversion and propagates exit 2', () => {
  project((root) => {
    validProject(root);
    write(root, 'story/episodes/ep01/keyframes.json', '{}');
    fail(run(root), /^FAIL legacy KF contract detected:/, 2);
  });
});
