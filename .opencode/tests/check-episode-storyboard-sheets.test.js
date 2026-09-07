import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/check-episode.sh');
const EVIDENCE = join(process.cwd(), 'scripts/review-evidence.mjs');
const EP = 'story/episodes/ep01';
const BASE = 'assets/items/base.md';
const BASE_IMAGE = 'assets/images/items/base.png';
const inventory = '\n## 本集资产清单\n### 新增资产\n- items: (无)\n### 已有资产（本集出场）\n';
function identities(root, paths) {
  return paths.map((path) => ({ path,
    sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') }));
}
function review(root, kind, file, targets, inputs = (target) => [target]) {
  const dependencies = kind === 'storyboard' ? [`${EP}/script.md`]
    : kind.startsWith('sheet-') ? [`${EP}/storyboard.md`, BASE,
      ...(kind === 'sheet-visual' ? [BASE_IMAGE] : [])] : [];
  const evidence = { version: 1, kind, scope: targets, results: targets.map((target) => ({
    target, status: 'pass', inputs: identities(root,
      [...new Set([...inputs(target), 'config.md', ...dependencies])]), blockers: [],
  })) };
  write(root, `${EP}/${file}`, `## 第 1 轮 (test) - 通过\n<!-- svd-review-evidence -->\n\`\`\`json\n${JSON.stringify(evidence)}\n\`\`\`\n<!-- /round-1 -->\n`);
}

function write(root, path, content = '') {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function editEvidence(root, file, edit) {
  const path = `${EP}/${file}`;
  const text = readFileSync(join(root, path), 'utf8');
  const block = /```json\n([^`]+)\n```/.exec(text);
  const record = JSON.parse(block[1]);
  edit(record);
  write(root, path, text.replace(block[1], JSON.stringify(record)));
}

function renewConfig(root) {
  for (const file of ['.review-script.md', '.review-storyboard.md', '.review-asset-prompts.md',
    '.review-basic-assets-visual.md', '.review-storyboard-sheet-prompts.md',
    '.review-storyboard-sheets-visual.md']) {
    editEvidence(root, file, (record) => {
      for (const result of record.results) result.inputs = result.inputs.map((input) =>
        input.path === 'config.md' ? identities(root, ['config.md'])[0] : input);
    });
  }
}

function card(fileNumber, declared = fileNumber) {
  return `# shot${String(fileNumber).padStart(2, '0')} Storyboard Sheet

## 基本信息
- 已解析图像提供方：dreamina
- 已解析图像模型版本：future-model
- 已解析图片比例：9:16
- 已解析图片分辨率：4k
- 所属集数：ep01
- 对应分镜：shot ${declared}
- 时长：5s
- 类型：分镜板
- Panel 数量：1
## 引用资产
- [base](../../items/base.md)
## 连续性参考
无
## Panel 规划
### PANEL 1 [0s-5s]
Show the base prop.
## 图像生成提示
Show the base prop.
`;
}

function setup(root, { shots = [1, 2, 3], cards = shots, images = cards,
  model = 'dreamina', names = cards.map((n) => `shot${String(n).padStart(2, '0')}.md`),
  declared = {}, mode = 'short' } = {}) {
  write(root, 'config.md', `- mode: ${mode}\n- 图像模型: ${model}\n`);
  write(root, `${EP}/script.md`, '## 场景 1\n内容\n' + inventory + '- items: base\n');
  write(root, BASE, 'base card');
  write(root, BASE_IMAGE, 'base png');
  write(root, `${EP}/storyboard.md`, shots.map((n) => `### shot ${n}\n- 时长：5s\n**画面与声音描述：**\nAction`).join('\n\n'));
  names.forEach((name, index) => write(root, `assets/storyboard-sheets/ep01/${name}`,
    card(cards[index], declared[name] ?? cards[index])));
  images.forEach((n) => write(root,
    `assets/images/storyboard-sheets/ep01/shot${String(n).padStart(2, '0')}.png`, 'png'));
  review(root, 'script', '.review-script.md', [`${EP}/script.md`]);
  review(root, 'asset-prompt', '.review-asset-prompts.md', [BASE]);
  review(root, 'asset-visual', '.review-basic-assets-visual.md', [BASE],
    (target) => [target, BASE_IMAGE]);
  review(root, 'storyboard', '.review-storyboard.md', [`${EP}/storyboard.md`],
    (target) => [target, `${EP}/script.md`]);
  const targets = names.map((name) => `assets/storyboard-sheets/ep01/${name}`);
  review(root, 'sheet-prompt', '.review-storyboard-sheet-prompts.md', targets,
    (target) => [target, `${EP}/storyboard.md`]);
  review(root, 'sheet-visual', '.review-storyboard-sheets-visual.md', targets,
    (target) => [target, target.replace('assets/', 'assets/images/').replace('.md', '.png')]
      .filter((file) => { try { readFileSync(join(root, file)); return true; } catch { return false; } }));
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

test('readiness accepts inline comments in configured mode', () => {
  project({ mode: 'short # single episode' }, (result) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /^mode:short$/m);
  });
});

test('omitted production dependencies cannot preserve stale passes', () => {
  const cases = [
    ['.review-storyboard.md', `${EP}/script.md`, 'storyboard-review'],
    ['.review-storyboard.md', 'config.md', 'storyboard-review'],
    ['.review-storyboard-sheet-prompts.md', `${EP}/storyboard.md`, 'storyboard-sheet-prompt-review'],
    ['.review-storyboard-sheet-prompts.md', BASE, 'storyboard-sheet-prompt-review'],
    ['.review-storyboard-sheets-visual.md', BASE_IMAGE, 'storyboard-sheet-visual-review'],
  ];
  for (const [file, omitted, label] of cases) project({ shots: [1] }, (result, root) => {
    assert.equal(result.status, 0, result.stdout);
    editEvidence(root, file, (record) => {
      for (const entry of record.results) entry.inputs = entry.inputs.filter((i) => i.path !== omitted);
    });
    for (const changed of [false, true]) {
      if (changed) write(root, omitted, readFileSync(join(root, omitted), 'utf8') + '\n## Note\nchanged');
      const checked = run(root);
      assert.equal(checked.status, 1);
      assert.match(checked.stdout, new RegExp(`^${label}:unknown$`, 'm'));
    }
  });
});

test('preparatory approval is episode-specific and bound to current nonempty inputs', () => {
  project({}, (result, root) => {
    assert.equal(result.status, 0, result.stdout);
    const record = { episode: 'ep01', required: ['outline'], approval: null };
    const config = () => write(root, 'config.md', '- mode: short\n## 制作前确认 ep01\n```json\n' +
      JSON.stringify(record) + '\n```\n');
    config();
    assert.match(run(root).stdout, /^preparatory-review:unknown$/m);
    write(root, `${EP}/outline.md`, 'plan');
    record.approval = { decision: 'User approved this plan', inputs: identities(root, [`${EP}/outline.md`]) };
    config();
    renewConfig(root);
    assert.equal(run(root).status, 0, run(root).stdout);
    write(root, `${EP}/outline.md`, 'changed');
    assert.equal(run(root).status, 1);
    write(root, `${EP}/outline.md`, '');
    record.approval.inputs = identities(root, [`${EP}/outline.md`]);
    config();
    assert.equal(run(root).status, 1);
    write(root, 'config.md', '- mode: short\n## 制作前确认 ep01\n```json\n{');
    assert.equal(run(root).status, 1);
    write(root, 'config.md', '- mode: short\n## 制作前确认 ep02\n```json\n{');
    renewConfig(root);
    assert.equal(run(root).status, 0);
  });
});

test('required images are checked regardless of provider', () => {
  project({}, (result) => {
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(sheetLines(result), ['storyboard-sheets:ok', 'storyboard-sheet-images:ok']);
    assert.match(result.stdout, /^storyboard-sheet-prompt-review:ok$/m);
    assert.match(result.stdout, /^storyboard-sheet-visual-review:ok$/m);
  });
  project({ model: 'none', images: [] }, (result) => {
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.deepEqual(sheetLines(result), ['storyboard-sheets:ok', 'storyboard-sheet-images:invalid:missing=1,2,3']);
    assert.match(result.stdout, /^storyboard-sheet-prompt-review:ok$/m);
    assert.match(result.stdout, /^storyboard-sheet-visual-review:unknown$/m);
  });
  project({ model: 'none' }, (result) => assert.equal(result.status, 0, result.stdout));
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

test('a sheet PNG cannot report ready without its required card', () => {
  project({ cards: [1, 3], images: [1, 2, 3] }, (result) => {
    assert.equal(result.status, 1);
    assert.match(result.stdout, /^storyboard-sheet-images:invalid:missing-card=2$/m);
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
    write(root, 'story/episodes/ep01/script.md', `## 场景 1
完成

## 本集资产清单
### 新增资产
- characters: 阿青
### 已有资产（本集出场）
`);
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^assets:missing:阿青$/m);
    assert.match(checked.stdout, /^images:missing:阿青$/m);
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

test('series without planning is ready but still requires script', () => {
  project({ mode: 'series' }, (result, root) => {
    assert.equal(result.status, 0, result.stdout);
    rmSync(join(root, 'story/episodes/ep01/script.md'));
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.doesNotMatch(checked.stdout, /^novel:/m);
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

test('unrequested optional planning is not a readiness prerequisite', () => {
  project({ mode: 'series' }, (result, root) => {
    write(root, 'story/episodes/ep01/outline.md', `## 结局设计
完成
- 目标时长: 10s
## 本集资产清单
### 新增资产
`);
    write(root, 'story/episodes/ep01/novel.md', '太短');
    const checked = run(root);
    assert.equal(checked.status, 0, checked.stdout);
    assert.doesNotMatch(checked.stdout, /^novel:/m);
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
    write(root, 'story/episodes/ep01/script.md', `## 场景 1
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

test('heading-only reviews cannot establish acceptance', () => {
  const cases = [
    ['.review-storyboard-sheet-prompts.md', '', 'storyboard-sheet-prompt-review:missing'],
    ['.review-storyboard-sheet-prompts.md', '## 第 1 轮 (test) - 通过\n<!-- /round-1 -->\n## 第 2 轮 (test) - 需修改\n<!-- /round-2 -->\n', 'storyboard-sheet-prompt-review:unknown'],
    ['.review-storyboard-sheets-visual.md', '', 'storyboard-sheet-visual-review:missing'],
    ['.review-storyboard-sheets-visual.md', '## 第 2 轮 (test) - 通过 (1 项无法判定)\n<!-- /round-2 -->\n', 'storyboard-sheet-visual-review:unknown'],
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

test('an affected impact failure keeps the visual review nonterminal', () => {
  project({}, (result, root) => {
    write(root, 'story/episodes/ep01/.review-storyboard-sheets-visual.md', `## 第 1 轮 (test) - 通过

---
<!-- /round-1 -->

## 第 2 轮 (test) - 需修改 (1 shots)

### 连续性影响评估
shot01|shot02|affected|align state|fix_failed

### dirty list
assets/storyboard-sheets/ep01/shot02.md|assets/images/storyboard-sheets/ep01/shot02.png

---
<!-- /round-2 -->
`);
    const checked = run(root);
    assert.equal(checked.status, 1);
    assert.match(checked.stdout,
      /^storyboard-sheet-visual-review:unknown$/m);
  });
});

test('impact prose alone cannot renew identities', () => {
  for (const status of ['unaffected', 'no_dependency']) project({}, (result, root) => {
    write(root, 'story/episodes/ep01/.review-storyboard-sheets-visual.md', `## 第 1 轮 (test) - 通过

---
<!-- /round-1 -->

## 第 2 轮 (test) - 通过

### 连续性影响评估
{"upstream":"shot01","downstream":"shot02","status":"${status}","reason":"fixture reason","fix_direction":""}

---
<!-- /round-2 -->
`);
    const checked = run(root);
    assert.equal(checked.status, 1, checked.stdout + checked.stderr);
    assert.match(checked.stdout, /^storyboard-sheet-visual-review:unknown$/m);
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

test('CLI selects shot references without accepting unrelated failed targets', () => {
  project({ model: 'none' }, (result, root) => {
    const a = 'assets/items/a.md';
    const b = 'assets/items/b.md';
    write(root, `${EP}/script.md`, '## 场景 1\n' + inventory + '- items: a, b\n');
    for (const file of [a, b]) {
      write(root, file, 'card');
      write(root, file.replace('assets/', 'assets/images/').replace('.md', '.png'), 'image');
    }
    write(root, `${EP}/storyboard.md`, `### shot 1\n- 时长：5s\n- 引用资产：[a](${a})\n**画面与声音描述：**\nAction`);
    review(root, 'script', '.review-script.md', [`${EP}/script.md`]);
    review(root, 'storyboard', '.review-storyboard.md', [`${EP}/storyboard.md`]);
    review(root, 'asset-prompt', '.review-asset-prompts.md', [a]);
    review(root, 'asset-visual', '.review-basic-assets-visual.md', [a],
      (target) => [target, 'assets/images/items/a.png']);
    const sheet = 'assets/storyboard-sheets/ep01/shot01.md';
    review(root, 'sheet-prompt', '.review-storyboard-sheet-prompts.md', [sheet],
      (target) => [target, a]);
    review(root, 'sheet-visual', '.review-storyboard-sheets-visual.md', [sheet],
      (target) => [target, a, 'assets/images/items/a.png',
        'assets/images/storyboard-sheets/ep01/shot01.png']);
    const runCLI = (...shots) => spawnSync('node', [EVIDENCE, 'check', 'ep01', ...shots],
      { cwd: root, encoding: 'utf8' });
    assert.equal(runCLI('1').status, 0, runCLI('1').stdout);
    assert.equal(runCLI().status, 1);
    assert.equal(runCLI('9').status, 1);
    write(root, 'assets/images/items/a.png', 'replacement');
    assert.match(runCLI('1').stdout, /^asset-visual-review:unknown$/m);
    rmSync(join(root, 'assets/images/items/a.png'));
    assert.equal(runCLI('1').status, 1);
  });
});

test('provider none still requires reused basic images and their current reviews', () => {
  project({ model: 'none' }, (result, root) => {
    const target = 'assets/items/reused.md';
    write(root, `${EP}/script.md`, '## 场景 1\n' + inventory + '- items: reused\n');
    write(root, target, 'card');
    assert.match(run(root).stdout, /^images:missing:reused$/m);
    write(root, 'assets/images/items/reused.png', 'image');
    review(root, 'script', '.review-script.md', [`${EP}/script.md`]);
    review(root, 'storyboard', '.review-storyboard.md', [`${EP}/storyboard.md`],
      (file) => [file, `${EP}/script.md`]);
    review(root, 'asset-prompt', '.review-asset-prompts.md', [target]);
    review(root, 'asset-visual', '.review-basic-assets-visual.md', [target],
      (file) => [file, 'assets/images/items/reused.png']);
    assert.equal(run(root).status, 0, run(root).stdout);
  });
});

test('interrupted claimed scope blocks only that scope; unreadable scope blocks the kind', () => {
  project({}, (result, root) => {
    const file = `${EP}/.review-storyboard-sheets-visual.md`;
    const old = readFileSync(join(root, file), 'utf8');
    const target = 'assets/storyboard-sheets/ep01/shot02.md';
    const start = '\n## 第 2 轮 (test) - pending\n<!-- svd-review-evidence -->\n```json\n';
    for (const suffix of [JSON.stringify({ version: 1, kind: 'sheet-visual', scope: [target], results: [] }),
      `{"version":1,"kind":"sheet-visual","scope":["${target}"],"results":[`]) {
      write(root, file, old + start + suffix);
      const check = (shot) => spawnSync('node', [EVIDENCE, 'check', 'ep01', shot],
        { cwd: root, encoding: 'utf8' });
      assert.equal(check('1').status, 0, check('1').stdout);
      assert.equal(check('2').status, 1);
    }
    write(root, file, old + start + '{');
    assert.equal(spawnSync('node', [EVIDENCE, 'check', 'ep01', '1'], { cwd: root }).status, 1);
  });
});

test('missing inventory and custom config cannot fall back to old project inputs', () => {
  project({}, (result, root) => {
    write(root, 'custom.md', '- mode: invalid\n');
    assert.equal(spawnSync('bash', [SCRIPT, 'ep01', 'custom.md'], { cwd: root }).status, 1);
    write(root, `${EP}/script.md`, '## 场景 1\n');
    assert.match(run(root).stdout, /^images:unknown$/m);
  });
});

test('active custom config must be fingerprinted rather than default config', () => {
  project({ shots: [1] }, (result, root) => {
    write(root, 'custom.md', '- mode: short\n');
    const check = () => spawnSync('bash', [SCRIPT, 'ep01', 'custom.md'],
      { cwd: root, encoding: 'utf8' });
    assert.equal(check().status, 1);
    for (const file of ['.review-script.md', '.review-storyboard.md', '.review-asset-prompts.md',
      '.review-basic-assets-visual.md', '.review-storyboard-sheet-prompts.md',
      '.review-storyboard-sheets-visual.md']) {
      editEvidence(root, file, (record) => {
        for (const entry of record.results) entry.inputs = entry.inputs.map((input) =>
          input.path === 'config.md' ? identities(root, ['custom.md'])[0] : input);
      });
    }
    assert.equal(check().status, 0, check().stdout);
    write(root, 'config.md', '- mode: invalid\n');
    assert.equal(check().status, 0, check().stdout);
    write(root, 'custom.md', '- mode: series\n');
    assert.equal(check().status, 1);
  });
});
