import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/check-episode.sh');

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function card(fileNumber, declared = fileNumber) {
  return `# shot${String(fileNumber).padStart(2, '0')} Storyboard Sheet

## 基本信息
- 所属集数：ep01
- 对应分镜：shot ${declared}
- 时长：5s
- 类型：分镜板
- Panel 数量：1
`;
}

function setup(root, { shots = [1, 2, 3], cards = shots, images = cards,
  model = 'dreamina', names = cards.map((n) => `shot${String(n).padStart(2, '0')}.md`),
  declared = {}, mode = 'short' } = {}) {
  write(root, 'config.md', `- mode: ${mode}\n- 图像模型: ${model}\n`);
  write(root, 'story/episodes/ep01/outline.md', '## 结局设计\n完成\n\n## 本集资产清单\n### 新增资产\n');
  write(root, 'story/episodes/ep01/script.md', '## 场景 1\n内容\n');
  write(root, 'story/episodes/ep01/storyboard.md', shots.map((n) => `### shot ${n}\n- 时长：5s`).join('\n\n'));
  names.forEach((name, index) => write(root, `assets/storyboard-sheets/ep01/${name}`,
    card(cards[index], declared[name] ?? cards[index])));
  images.forEach((n) => write(root,
    `assets/images/storyboard-sheets/ep01/shot${String(n).padStart(2, '0')}.png`, 'png'));
  write(root, 'story/episodes/ep01/.review-storyboard-sheet-prompts.md',
    '## 第 1 轮 (test) - 通过\n\n---\n<!-- /round-1 -->\n');
  write(root, 'story/episodes/ep01/.review-storyboard-sheets-visual.md',
    '## 第 1 轮 (test) - 通过\n\n---\n<!-- /round-1 -->\n');
}

function run(root) {
  return spawnSync('bash', [SCRIPT, 'ep01', 'config.md'], { cwd: root, encoding: 'utf8' });
}

function sheetLines(result) {
  return result.stdout.split('\n').filter((line) =>
    line.startsWith('storyboard-sheets:') || line.startsWith('storyboard-sheet-images:'));
}

function project(options, check) {
  const root = mkdtempSync(join(tmpdir(), 'svd-check-sheets-'));
  try { setup(root, options); check(run(root), root); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('enabled and none modes expose exact terminal statuses', () => {
  project({}, (result) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(sheetLines(result), ['storyboard-sheets:ok', 'storyboard-sheet-images:ok']);
    assert.match(result.stdout, /^storyboard-sheet-prompt-review:ok$/m);
    assert.match(result.stdout, /^storyboard-sheet-visual-review:ok$/m);
  });
  project({ model: 'none', images: [] }, (result) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(sheetLines(result), ['storyboard-sheets:ok', 'storyboard-sheet-images:skipped']);
    assert.match(result.stdout, /^storyboard-sheet-prompt-review:ok$/m);
    assert.match(result.stdout, /^storyboard-sheet-visual-review:skipped$/m);
  });
});

test('reports storyboard missing, duplicate, and out-of-order shot sets', () => {
  const cases = [
    [[1, 3], /storyboard:invalid:missing=2/],
    [[1, 2, 2, 3], /storyboard:invalid:duplicate=2/],
    [[1, 3, 2], /storyboard:invalid:out-of-order=3>2/],
  ];
  for (const [shots, detail] of cases) project({ shots, cards: [1, 2, 3], images: [1, 2, 3] }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, detail);
  });
});

test('reports missing and orphan card and image numbers', () => {
  project({ cards: [1, 3, 4], images: [1, 3, 4] }, (result) => {
    assert.match(result.stdout, /storyboard-sheets:invalid:missing=2;orphan=4/);
    assert.match(result.stdout, /storyboard-sheet-images:invalid:missing=2;orphan=4/);
  });
});

test('reports noncanonical card names and card metadata mismatches', () => {
  project({ names: ['shot01.md', 'shot2.md', 'shot03.md'] }, (result) => {
    assert.match(result.stdout, /storyboard-sheets:invalid:noncanonical=shot2\.md/);
  });
  project({ declared: { 'shot02.md': 3 } }, (result) => {
    assert.match(result.stdout, /storyboard-sheets:invalid:metadata=shot02\.md:shot-3/);
  });
});

test('retains base asset card completeness before sheet checks', () => {
  project({}, (result, root) => {
    write(root, 'story/episodes/ep01/outline.md', `## 结局设计
完成

## 本集资产清单
### 新增资产
- characters: 阿青
`);
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^assets:missing:阿青$/m);
  });
});

test('reports required card metadata beyond the declared shot number', () => {
  project({}, (result, root) => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    write(root, path, card(2).replace('- 类型：分镜板', '- 类型：其他'));
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /metadata=shot02\.md:type/);
  });
});

test('series requires both novel and script while short requires script', () => {
  project({ mode: 'series' }, (result, root) => {
    write(root, 'story/episodes/ep01/novel.md', '小说正文');
    rmSync(join(root, 'story/episodes/ep01/script.md'));
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^novel:ok$/m);
    assert.match(checked.stdout, /^script:missing$/m);
  });
  project({ mode: 'short' }, (result, root) => {
    write(root, 'story/episodes/ep01/script.md', '不完整');
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^script:incomplete$/m);
    assert.doesNotMatch(checked.stdout, /^novel:/m);
  });
});

test('series reports a materially incomplete novel', () => {
  project({ mode: 'series' }, (result, root) => {
    write(root, 'story/episodes/ep01/outline.md', `## 结局设计
完成
- 目标时长: 10s
## 本集资产清单
### 新增资产
`);
    write(root, 'story/episodes/ep01/novel.md', '太短');
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^novel:incomplete:/m);
    assert.match(checked.stdout, /^script:ok$/m);
  });
});

test('sheet card duration must match its storyboard shot', () => {
  project({}, (result, root) => {
    const path = 'assets/storyboard-sheets/ep01/shot02.md';
    write(root, path, card(2).replace('- 时长：5s', '- 时长：6s'));
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /metadata=shot02\.md:duration-6\/5/);
  });
});

test('each storyboard shot requires exactly one valid duration', () => {
  const cases = [
    ['- 时长：5s', '', 'shot02:missing'],
    ['- 时长：5s', '- 时长：5s\n- 时长：6s', 'shot02:duplicate'],
    ['- 时长：5s', '- 时长：0s', 'shot02:invalid'],
  ];
  for (const [original, replacement, detail] of cases) project({}, (result, root) => {
    const path = 'story/episodes/ep01/storyboard.md';
    const source = `### shot 1\n- 时长：5s\n\n### shot 2\n${original}\n\n### shot 3\n- 时长：5s`;
    write(root, path, source.replace(`### shot 2\n${original}`,
      `### shot 2\n${replacement}`));
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, new RegExp(`^storyboard:incomplete:duration=${detail}$`, 'm'));
    assert.doesNotMatch(checked.stdout, /^storyboard:ok$/m);
  });
});

test('basic image checks are limited to assets listed by this episode', () => {
  project({}, (result, root) => {
    write(root, 'assets/characters/other-episode.md', '# unrelated');
    const checked = run(root);
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
    assert.match(checked.stdout, /^images:ok$/m);
  });
});

test('basic image checks include existing assets listed by this episode', () => {
  project({}, (result, root) => {
    write(root, 'story/episodes/ep01/outline.md', `## 结局设计
完成

## 本集资产清单
### 新增资产
- characters: (无)
### 已有资产（本集出场）
- characters: 阿青 (assets/characters/阿青.md)
`);
    write(root, 'assets/characters/阿青.md', '# 阿青');
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^images:missing:阿青$/m);
  });
});

test('review gates require the latest round to be a pure pass', () => {
  const cases = [
    ['.review-storyboard-sheet-prompts.md', '', 'storyboard-sheet-prompt-review:missing'],
    ['.review-storyboard-sheet-prompts.md', '## 第 1 轮 (test) - 通过\n<!-- /round-1 -->\n## 第 2 轮 (test) - 需修改\n<!-- /round-2 -->\n', 'storyboard-sheet-prompt-review:needs_revision'],
    ['.review-storyboard-sheets-visual.md', '', 'storyboard-sheet-visual-review:missing'],
    ['.review-storyboard-sheets-visual.md', '## 第 2 轮 (test) - 通过 (1 项无法判定)\n<!-- /round-2 -->\n', 'storyboard-sheet-visual-review:needs_revision'],
  ];
  for (const [name, content, expected] of cases) project({}, (result, root) => {
    const path = join(root, 'story/episodes/ep01', name);
    if (content === '') rmSync(path);
    else writeFileSync(path, content);
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, new RegExp(`^${expected}$`, 'm'));
  });
});

test('legacy detector runs first and propagates actionable exit 2', () => {
  project({}, (result, root) => {
    write(root, 'story/episodes/ep01/keyframes.json', '{}');
    const legacy = run(root);
    assert.equal(legacy.status, 2);
    assert.equal(legacy.stdout, '');
    assert.match(legacy.stderr, /^FAIL legacy KF contract detected:/);
    assert.match(legacy.stderr, /当前版本不兼容.*旧 release.*人工迁移/);
  });
});
