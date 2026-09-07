import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { settingsText } from './fixtures/image-project.js';

const cli = join(process.cwd(), 'scripts/review-evidence.mjs');
async function fixture(check) {
  const api = await import('../../scripts/review-evidence.mjs');
  const root = mkdtempSync(join(tmpdir(), 'svd-evidence-'));
  const cwd = process.cwd();
  try {
    process.chdir(root);
    writeFileSync('a.md', 'card');
    writeFileSync('a.png', 'image');
    writeFileSync('b.md', 'other');
    writeFileSync('config.md', '- mode: short');
    await check(api, root);
  } finally { process.chdir(cwd); rmSync(root, { recursive: true }); }
}
const round = (scope, results, complete = true) => ({
  version: 1, kind: 'asset-prompt', scope, results, complete,
});
const pass = (api, target, paths = [target, 'config.md']) => ({
  target, status: 'pass', inputs: api.fingerprintInputs(paths), blockers: [],
});

test('asset reference fingerprints stale only the dependent visual target', async () => fixture(api => {
  const anchor = 'assets/buildings/hall.md', target = 'assets/locations/terrace.md';
  const image = p => p.replace('assets/', 'assets/images/').replace('.md', '.png');
  for (const dir of ['assets/buildings', 'assets/locations', 'assets/images/buildings',
    'assets/images/locations']) mkdirSync(dir, { recursive: true });
  writeFileSync(anchor, 'Pale stone hall');
  writeFileSync(target, `## 基本信息\n- 同实体参考：[hall](${anchor})\n`);
  const prompt = round([target], [pass(api, target, [target, 'config.md', anchor])]);
  assert.equal(api.checkCoverage([target], [prompt]).status, 'pass');
  for (const p of [image(anchor), image(target), 'b.png']) writeFileSync(p, 'PNG');
  const visual = { ...round([target, 'b.md'], [
    pass(api, target, [target, 'config.md', image(target), anchor, image(anchor)]),
    pass(api, 'b.md', ['b.md', 'config.md', 'b.png']),
  ]), kind: 'asset-visual' };
  assert.equal(api.checkCoverage([target, 'b.md'], [visual]).status, 'pass');
  for (const ref of [image(anchor), anchor]) {
    writeFileSync(ref, 'changed');
    assert.deepEqual(api.checkCoverage([target, 'b.md'], [visual]).results,
      [{ target, status: 'unknown' }, { target: 'b.md', status: 'pass' }]);
    writeFileSync(ref, ref === anchor ? 'Pale stone hall' : 'PNG');
  }
  assert.equal(api.checkCoverage([target, 'b.md'], [visual]).status, 'pass');
  writeFileSync(target, 'changed target');
  assert.equal(api.checkCoverage([target], [visual]).status, 'unknown');
}));

test('storyboard cannot omit script or active config identities', async () => fixture((api) => {
  const ep = 'story/episodes/ep01';
  mkdirSync(ep, { recursive: true });
  writeFileSync(`${ep}/script.md`, 'script');
  writeFileSync(`${ep}/storyboard.md`, 'board');
  writeFileSync('custom.md', '- mode: series');
  const target = `${ep}/storyboard.md`;
  const required = [target, `${ep}/script.md`, 'custom.md'];
  const check = (paths) => api.checkCoverage([target], [{
    ...round([target], [pass(api, target, paths)]), kind: 'storyboard',
  }], 'custom.md').status;
  assert.equal(check(required), 'pass');
  for (const omitted of required) {
    assert.equal(check(required.filter((file) => file !== omitted)), 'unknown', omitted);
  }
  assert.equal(check([target, `${ep}/script.md`, 'config.md']), 'unknown');
}));

test('sheets bind actual shot and converter references without requiring future PNGs', async () => fixture((api) => {
  const ep = 'story/episodes/ep01';
  const dir = 'assets/storyboard-sheets/ep01';
  for (const path of [ep, dir, 'assets/items', 'assets/images/items',
    'assets/images/storyboard-sheets/ep01']) mkdirSync(path, { recursive: true });
  const target = `${dir}/shot02.md`;
  const board = `${ep}/storyboard.md`;
  writeFileSync(board, '### shot 2\n- 时长：8s\n- 引用资产：[a](assets/items/./a.md)\n**画面与声音描述：**\nAction');
  writeFileSync(target, settingsText + '## 引用资产\n- [b](../../items/b.md)\n## 连续性参考\n- [shot01](./shot01.md)\n- 继承元素：position\n## Panel 规划\n### PANEL 1\nAction\n## 图像生成提示\nPrompt');
  const cards = ['assets/items/a.md', 'assets/items/b.md', `${dir}/shot01.md`];
  for (const file of cards) writeFileSync(file, 'card');
  const required = [target, 'config.md', board, ...cards];
  const check = (kind, paths) => api.checkCoverage([target], [{
    ...round([target], [pass(api, target, paths)]), kind,
  }]).status;
  assert.equal(check('sheet-prompt', required), 'pass');
  for (const omitted of required) {
    assert.equal(check('sheet-prompt', required.filter((p) => p !== omitted)), 'unknown', omitted);
  }
  const images = [target, ...cards].map((file) =>
    file.replace('assets/', 'assets/images/').replace('.md', '.png'));
  for (const file of images) writeFileSync(file, 'png');
  assert.equal(check('sheet-visual', [...required, ...images]), 'pass');
  for (const omitted of [...required, ...images]) {
    assert.equal(check('sheet-visual', [...required, ...images].filter((p) => p !== omitted)),
      'unknown', omitted);
  }
  const accepted = { ...round([target], [pass(api, target, [...required, ...images])]),
    kind: 'sheet-visual' };
  writeFileSync('assets/images/items/b.png', 'changed reference');
  assert.equal(api.checkCoverage([target], [accepted]).status, 'unknown');
  writeFileSync(board, '### shot 1\n**画面与声音描述：**\nAction');
  assert.equal(check('sheet-prompt', required), 'unknown');
}));

test('fingerprints actual bytes and checks current pass', async () => fixture((api, root) => {
  const result = pass(api, 'a.md', ['a.md', 'a.png', 'config.md']);
  assert.equal(result.inputs[0].sha256.length, 64);
  assert.equal(api.checkCoverage(['a.md'], [round(['a.md'], [result])]).status, 'pass');
  const output = spawnSync('node', [cli, 'fingerprint', 'a.md', 'a.png', 'config.md'],
    { cwd: root, encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout), result.inputs);
}));

test('changed or missing inputs need assessment, not revision', async () => fixture((api) => {
  const rounds = [round(['a.md'], [pass(api, 'a.md', ['a.md', 'a.png', 'config.md'])])];
  writeFileSync('a.png', 'changed');
  assert.equal(api.checkCoverage(['a.md'], rounds).status, 'unknown');
  rmSync('a.png');
  assert.equal(api.checkCoverage(['a.md'], rounds).status, 'unknown');
}));

test('newest claimed scope wins even with missing child or unfinished round', async () => fixture((api) => {
  const old = round(['a.md', 'b.md'], [pass(api, 'a.md'), pass(api, 'b.md')]);
  for (const latest of [round(['a.md'], []), round(['a.md'], [pass(api, 'a.md')], false)]) {
    assert.equal(api.checkCoverage(['a.md'], [old, latest]).status, 'unknown');
    assert.equal(api.checkCoverage(['b.md'], [old, latest]).status, 'pass');
  }
  assert.equal(api.checkCoverage(['b.md'], [old, { complete: false }]).status, 'unknown');
}));

test('scoped pass does not erase failure and blockers cannot pass', async () => fixture((api) => {
  const failed = { ...pass(api, 'b.md'), status: 'needs_revision', blockers: ['fix'] };
  const rounds = [round(['b.md'], [failed]), round(['a.md'], [pass(api, 'a.md')])];
  assert.equal(api.checkCoverage(['a.md', 'b.md'], rounds).status, 'needs_revision');
  assert.equal(api.checkCoverage(['a.md'], rounds).status, 'pass');
  assert.equal(api.checkCoverage(['b.md'], [round(['b.md'], [{ ...failed, status: 'pass' }])]).status, 'unknown');
}));

test('incomplete aggregate and omitted visual identity cannot pass', async () => fixture((api) => {
  const partial = round(['a.md', 'b.md'], [pass(api, 'a.md')]);
  assert.equal(api.checkCoverage(['a.md'], [partial]).status, 'unknown');
  const visual = { ...round(['a.md'], [pass(api, 'a.md')]), kind: 'asset-visual' };
  assert.equal(api.checkCoverage(['a.md'], [visual]).status, 'unknown');
  const duplicate = round(['a.md'], [pass(api, 'a.md'), pass(api, 'a.md')]);
  assert.equal(api.checkCoverage(['a.md'], [duplicate]).status, 'unknown');
  assert.throws(() => api.fingerprintInputs(['../outside.md']));
  assert.throws(() => api.fingerprintInputs(['missing.md']));
}));
