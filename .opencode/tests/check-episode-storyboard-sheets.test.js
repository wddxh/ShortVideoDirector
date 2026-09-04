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
  declared = {} } = {}) {
  write(root, 'config.md', `- 图像模型: ${model}\n`);
  write(root, 'story/episodes/ep01/outline.md', '## 结局设计\n完成\n\n## 本集资产清单\n### 新增资产\n');
  write(root, 'story/episodes/ep01/script.md', '## 场景 1\n内容\n');
  write(root, 'story/episodes/ep01/storyboard.md', shots.map((n) => `### shot ${n}\n- 时长：5s`).join('\n\n'));
  names.forEach((name, index) => write(root, `assets/storyboard-sheets/ep01/${name}`,
    card(cards[index], declared[name] ?? cards[index])));
  images.forEach((n) => write(root,
    `assets/images/storyboard-sheets/ep01/shot${String(n).padStart(2, '0')}.png`, 'png'));
}

function run(root) {
  return spawnSync('bash', [SCRIPT, 'ep01', 'config.md'], { cwd: root, encoding: 'utf8' });
}

function sheetLines(result) {
  return result.stdout.split('\n').filter((line) => line.startsWith('storyboard-'));
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
  });
  project({ model: 'none', images: [] }, (result) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(sheetLines(result), ['storyboard-sheets:ok', 'storyboard-sheet-images:skipped']);
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
