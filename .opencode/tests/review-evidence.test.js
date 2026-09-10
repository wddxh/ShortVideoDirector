import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = join(process.cwd(), 'scripts/review-evidence.mjs');
const a = 'assets/items/a.md', b = 'assets/items/b.md';
const image = p => p.replace('assets/', 'assets/images/').replace(/\.md$/, '.png');
const write = (file, text) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
async function fixture(check) {
  const api = await import('../../scripts/review-evidence.mjs');
  const root = mkdtempSync(join(tmpdir(), 'svd-evidence-'));
  const cwd = process.cwd();
  try {
    process.chdir(root);
    write(a, 'card');
    write(image(a), 'image');
    write(b, 'other');
    writeFileSync('config.md', '- mode: short');
    await check(api, root);
  } finally { process.chdir(cwd); rmSync(root, { recursive: true }); }
}
const round = (scope, results) => ({ kind: 'asset-prompt', scope, results });
const pass = (api, target, paths = [target, 'config.md']) => ({
  target, status: 'pass', inputs: api.fingerprintInputs(paths), blockers: [],
});
const evidence = (api, target, records, kind = 'asset-prompt', episode = 'ep01') => {
  const file = api.reviewPath(kind, target, episode);
  write(file, records.map((record, i) => `## 第 ${i + 1} 轮\n<!-- svd-review-evidence -->\n\`\`\`json\n${JSON.stringify(record)}\n\`\`\`\n<!-- /round-${i + 1} -->\n`).join('\n'));
  return file;
};
const check = (api, targets = [a], kind = 'asset-prompt', config = 'config.md') =>
  api.checkCoverage(kind, targets, 'ep01', config);

function shotInputFixture() {
  const ep = 'story/episodes/ep01', target = `${ep}/task-inputs/task01.json`;
  write(`${ep}/script.md`, '## 场景 1\nAction\n');
  write(`${ep}/storyboard.md`, `### shot 1\n- 视频风格：写实\n- 时长：5s\n- 引用资产：[a](${a})\n**画面与声音描述：**\nAction\n`);
  write('references/motion.mp4', 'MP4');
  write('references/scene.blend', 'scene');
  const manifest = { shots: [1], references: [{ kind: 'local', media: 'video',
    path: 'references/motion.mp4', use: 'Camera', sources: ['references/scene.blend'] }],
  prompt: '  Final prompt: hold the camera.\nKeep the pause.  \n' };
  write(target, JSON.stringify(manifest));
  return { ep, target, manifest };
}

test('prompt-only edits invalidate shot-input pass through the existing manifest fingerprint', async () => fixture(api => {
  const { target, manifest } = shotInputFixture();
  const paths = api.requiredInputs('shot-input', target, 'config.md');
  assert.ok(paths.includes(target));
  evidence(api, target, [{ kind: 'shot-input', scope: [target], results: [pass(api, target, paths)] }], 'shot-input');
  assert.equal(check(api, [target], 'shot-input').status, 'pass');
  write(target, JSON.stringify({ ...manifest, prompt: manifest.prompt + 'New sound bridge.\n' }));
  assert.equal(check(api, [target], 'shot-input').status, 'unknown');
}));

test('current fingerprints cannot establish final evidence for a draft or blank prompt', async () => fixture(api => {
  const { target, manifest } = shotInputFixture();
  const paths = api.requiredInputs('shot-input', target, 'config.md');
  for (const prompt of [undefined, '', ' \n\t ']) {
    write(target, JSON.stringify({ ...manifest, prompt }));
    evidence(api, target, [{ kind: 'shot-input', scope: [target],
      results: [pass(api, target, paths)] }], 'shot-input');
    assert.throws(() => api.requiredInputs('shot-input', target, 'config.md'), /prompt/i);
    assert.equal(check(api, [target], 'shot-input').status, 'unknown');
  }
}));

test('local PNG and source evidence is mandatory and stales only dependent asset scopes', async () => fixture(api => {
  const local = { images: ['references/shot/layout.png'], sources: ['references/shot/scene.py'] };
  const section = '\n## 本地制作参考\n```json\n' + JSON.stringify(local) + '\n```\n';
  write(a, 'Asset' + section);
  write(image(b), 'png');
  for (const file of [...local.images, ...local.sources]) write(file, 'original');
  for (const kind of ['asset-prompt', 'asset-visual']) {
    const target = a;
    const paths = [target, 'config.md', ...local.images, ...local.sources];
    if (kind.endsWith('-visual')) paths.push(image(a));
    const record = { ...round([target], [pass(api, target, paths)]), kind };
    evidence(api, target, [record], kind);
    assert.equal(check(api, [target], kind).status, 'pass', kind);
    for (const file of [...local.images, ...local.sources]) {
      const omitted = { ...record, results: [pass(api, target, paths.filter(p => p !== file))] };
      evidence(api, target, [omitted], kind);
      assert.equal(check(api, [target], kind).status, 'unknown');
      evidence(api, target, [record], kind);
      writeFileSync(file, 'changed');
      assert.equal(check(api, [target], kind).status, 'unknown');
      evidence(api, b, [round([b], [pass(api, b)])]);
      assert.equal(check(api, [b]).status, 'pass');
      writeFileSync(file, 'original');
    }
    evidence(api, target, [{ ...record,
      results: [{ ...record.results[0], status: 'needs_revision', blockers: ['Unfaithful render'] }] }], kind);
    assert.equal(check(api, [target], kind).status, 'needs_revision');
  }
}));

test('asset reference fingerprints stale only the dependent visual target', async () => fixture(api => {
  const anchor = 'assets/buildings/hall.md', target = 'assets/locations/terrace.md';
  for (const dir of ['assets/buildings', 'assets/locations', 'assets/images/buildings',
    'assets/images/locations']) mkdirSync(dir, { recursive: true });
  writeFileSync(anchor, 'Pale stone hall');
  writeFileSync(target, `## 基本信息\n- 同实体参考：[hall](${anchor})\n`);
  const prompt = round([target], [pass(api, target, [target, 'config.md', anchor])]);
  evidence(api, target, [prompt]);
  assert.equal(check(api, [target]).status, 'pass');
  for (const p of [image(anchor), image(target), image(b)]) write(p, 'PNG');
  const visual = { ...round([target], [
    pass(api, target, [target, 'config.md', image(target), anchor, image(anchor)]),
  ]), kind: 'asset-visual' };
  evidence(api, target, [visual], 'asset-visual');
  evidence(api, b, [{ ...round([b], [pass(api, b, [b, 'config.md', image(b)])]), kind: 'asset-visual' }], 'asset-visual');
  assert.equal(check(api, [target, b], 'asset-visual').status, 'pass');
  for (const ref of [image(anchor), anchor]) {
    writeFileSync(ref, 'changed');
    assert.deepEqual(check(api, [target, b], 'asset-visual').results.map(r => r.status), ['unknown', 'pass']);
    writeFileSync(ref, ref === anchor ? 'Pale stone hall' : 'PNG');
  }
  assert.equal(check(api, [target, b], 'asset-visual').status, 'pass');
  writeFileSync(target, 'changed target');
  assert.equal(check(api, [target], 'asset-visual').status, 'unknown');
}));

test('storyboard cannot omit script or active config identities', async () => fixture((api) => {
  const ep = 'story/episodes/ep01';
  mkdirSync(ep, { recursive: true });
  writeFileSync(`${ep}/script.md`, 'script');
  writeFileSync(`${ep}/storyboard.md`, 'board');
  writeFileSync('custom.md', '- mode: series');
  const target = `${ep}/storyboard.md`;
  const required = [target, `${ep}/script.md`, 'custom.md'];
  const assess = (paths) => {
    evidence(api, target, [{ ...round([target], [pass(api, target, paths)]), kind: 'storyboard' }], 'storyboard');
    return check(api, [target], 'storyboard', 'custom.md').status;
  };
  assert.equal(assess(required), 'pass');
  for (const omitted of required) {
    assert.equal(assess(required.filter((file) => file !== omitted)), 'unknown', omitted);
  }
  assert.equal(assess([target, `${ep}/script.md`, 'config.md']), 'unknown');
}));

test('unsupported review kinds cannot establish coverage', async () => fixture(api => {
  for (const kind of ['other', '']) {
    assert.throws(() => api.requiredInputs(kind, 'a.md', 'config.md'), /Unsupported/);
    evidence(api, a, [{ ...round([a], [pass(api, a)]), kind }]);
    assert.equal(check(api).status, 'unknown');
  }
}));

test('fingerprints actual bytes and checks current pass', async () => fixture((api, root) => {
  const result = pass(api, a, [a, image(a), 'config.md']);
  assert.equal(result.inputs[0].sha256.length, 64);
  evidence(api, a, [round([a], [result])]);
  assert.equal(check(api).status, 'pass');
  const output = spawnSync('node', [cli, 'fingerprint', a, image(a), 'config.md'],
    { cwd: root, encoding: 'utf8' });
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout), result.inputs);
}));

test('changed or missing inputs need assessment, not revision', async () => fixture((api) => {
  evidence(api, a, [round([a], [pass(api, a, [a, image(a), 'config.md'])])]);
  write(image(a), 'changed');
  assert.equal(check(api).status, 'unknown');
  rmSync(image(a));
  assert.equal(check(api).status, 'unknown');
}));

test('latest invalid round owns only its file and never falls back to an older pass', async () => fixture((api) => {
  const old = round([a], [pass(api, a)]);
  evidence(api, b, [round([b], [pass(api, b)])]);
  for (const latest of [round([a], []), round([b], [pass(api, b)]), { complete: false }]) {
    evidence(api, a, [old, latest]);
    assert.deepEqual(check(api, [a, b]).results.map(r => r.status), ['unknown', 'pass']);
  }
  rmSync(api.reviewPath('asset-prompt', a, 'ep01'));
  assert.deepEqual(check(api, [a, b]).results.map(r => r.status), ['unknown', 'pass']);
}));

test('scoped pass does not erase failure and blockers cannot pass', async () => fixture((api) => {
  const failed = { ...pass(api, b), status: 'needs_revision', blockers: ['fix'] };
  evidence(api, b, [round([b], [failed])]);
  evidence(api, a, [round([a], [pass(api, a)])]);
  assert.equal(check(api, [a, b]).status, 'needs_revision');
  assert.equal(check(api).status, 'pass');
  evidence(api, b, [round([b], [{ ...failed, status: 'pass' }])]);
  assert.equal(check(api, [b]).status, 'unknown');
}));

test('multi-target scopes and duplicate results cannot pass', async () => fixture((api) => {
  for (const record of [round([a, b], [pass(api, a)]), round([a, b], [pass(api, a), pass(api, b)]),
    round([a], [pass(api, a), pass(api, a)])]) {
    evidence(api, a, [record]);
    assert.equal(check(api).status, 'unknown');
  }
  assert.throws(() => api.fingerprintInputs(['../outside.md']));
  assert.throws(() => api.fingerprintInputs(['missing.md']));
}));

test('canonical review paths preserve episode, category and full Unicode hierarchy', async () => fixture((api, root) => {
  const paths = new Set();
  for (const ep of ['ep01', 'ep02']) {
    for (const kind of ['script', 'storyboard']) {
      assert.equal(api.reviewPath(kind, `story/episodes/${ep}/${kind}.md`, ep), `reviews/${ep}/${kind}.md`);
    }
    assert.equal(api.reviewPath('shot-input', `story/episodes/${ep}/task-inputs/task02.json`, ep),
      `reviews/${ep}/task-inputs/task02.md`);
    for (const category of ['items', 'characters', 'buildings', 'locations']) {
      for (const kind of ['asset-prompt', 'asset-visual']) {
        const target = `assets/${category}/夜景/灯 甲.md`;
        const file = api.reviewPath(kind, target, ep);
        assert.equal(file, `reviews/${ep}/assets/${category}/夜景/灯 甲.${kind}.md`);
        paths.add(file);
        const output = spawnSync('node', [cli, 'path', kind, ep, target], { cwd: root, encoding: 'utf8' });
        assert.equal(output.status, 0, output.stderr);
        assert.equal(output.stdout.trim(), file);
      }
    }
  }
  assert.equal(paths.size, 16);
}));

test('path rejects aliases, wrong episodes, kinds and noncanonical targets', async () => fixture(api => {
  for (const [kind, target, episode] of [
    ['asset-prompt', a, undefined], ['asset-prompt', a, 'ep1'], ['unsupported', a, 'ep01'],
    ['script', 'story/episodes/ep02/script.md', 'ep01'], ['storyboard', a, 'ep01'],
    ['shot-input', 'story/episodes/ep02/task-inputs/task01.json', 'ep01'],
    ['shot-input', 'story/episodes/ep01/task-inputs/task1.json', 'ep01'],
    ...['/assets/items/a.md', './assets/items/a.md', 'assets/items/../a.md',
      'assets/items//a.md', 'assets/items/a.md\n', 'assets\\items\\a.md',
      'assets/images/items/a.md', 'assets/items/a.png'].map(target => ['asset-prompt', target, 'ep01']),
  ]) assert.throws(() => api.reviewPath(kind, target, episode));
}));

test('shared asset evidence is per episode and check-target CLI uses the same acceptance', async () => fixture((api, root) => {
  evidence(api, a, [round([a], [pass(api, a)])]);
  assert.equal(api.checkTarget('asset-prompt', a, 'ep01').status, 'pass');
  assert.equal(api.checkTarget('asset-prompt', a, 'ep02').status, 'unknown');
  for (const ep of ['ep01', 'ep02']) {
    const output = spawnSync('node', [cli, 'check-target', 'asset-prompt', ep, a],
      { cwd: root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: 'config.md' } });
    assert.equal(output.status, ep === 'ep01' ? 0 : 1);
    assert.deepEqual(JSON.parse(output.stdout), api.checkTarget('asset-prompt', a, ep));
  }
}));

test('malformed, wrong-kind and wrong-target latest records cannot reuse pass', async () => fixture(api => {
  const old = round([a], [pass(api, a)]);
  evidence(api, b, [round([b], [pass(api, b)])]);
  for (const record of [{ ...old, kind: 'script' }, round([a], [pass(api, b)]), null]) {
    evidence(api, a, [old, record]);
    assert.deepEqual(check(api, [a, b]).results.map(r => r.status), ['unknown', 'pass']);
  }
  const file = evidence(api, a, [old]);
  const text = readFileSync(file, 'utf8');
  for (const invalid of ['', '{', text.replace('<!-- /round-1 -->', '<!-- /round-2 -->'),
    text + '\n## 第 2 轮\n', text + '\n## 第 2 轮\n<!-- svd-review-evidence -->\n```json\n{',
    text.replace('<!-- /round-1 -->', '<!-- /round-1 -->\n<!-- /round-1 -->')]) {
    write(file, invalid);
    assert.deepEqual(check(api, [a, b]).results.map(r => r.status), ['unknown', 'pass']);
  }
  const visual = { ...old, kind: 'asset-visual' };
  evidence(api, a, [visual], 'asset-visual');
  assert.equal(check(api, [a], 'asset-visual').status, 'unknown');
  evidence(api, a, [old, round([a], []), old]);
  assert.equal(check(api).status, 'pass');
}));

test('review and dependency symlink escapes fail closed only for their owner', async () => fixture(api => {
  const outside = mkdtempSync(join(tmpdir(), 'svd-external-evidence-'));
  try {
    const file = evidence(api, a, [round([a], [pass(api, a)])]);
    evidence(api, b, [round([b], [pass(api, b)])]);
    write(join(outside, 'review.md'), readFileSync(file));
    rmSync(file);
    symlinkSync(join(outside, 'review.md'), file);
    assert.deepEqual(check(api, [a, b]).results.map(r => r.status), ['unknown', 'pass']);
    rmSync(file);
    evidence(api, a, [round([a], [pass(api, a)])]);
    write(join(outside, 'card.md'), readFileSync(a));
    rmSync(a);
    symlinkSync(join(outside, 'card.md'), a);
    assert.throws(() => api.fingerprintInputs([a]), /escapes project/);
    assert.deepEqual(check(api, [a, b]).results.map(r => r.status), ['unknown', 'pass']);
    rmSync(a);
    write(a, 'card');
    rmSync('reviews', { recursive: true });
    symlinkSync(outside, 'reviews');
    write(join(outside, 'ep01/assets/items/a.asset-prompt.md'), readFileSync(join(outside, 'review.md')));
    assert.equal(check(api).status, 'unknown');
  } finally { rmSync(outside, { recursive: true }); }
}));

test('legacy shared records never supply coverage and checks do not persist aggregates', async () => fixture(api => {
  const file = evidence(api, a, [round([a], [pass(api, a)])]);
  const text = readFileSync(file, 'utf8');
  write('story/episodes/ep01/.review-asset-prompts.md', text);
  rmSync(file);
  assert.equal(check(api).status, 'unknown');
  evidence(api, a, [round([a], [pass(api, a)])]);
  const other = 'assets/characters/a.md';
  write(other, 'other category');
  const otherFile = evidence(api, other, [round([other], [pass(api, other)])]);
  const original = readFileSync(otherFile, 'utf8');
  write(file, '{');
  const result = check(api, [a, other]);
  assert.deepEqual(result.results.map(r => r.status), ['unknown', 'pass']);
  assert.equal(readFileSync(file, 'utf8'), '{');
  assert.equal(readFileSync(otherFile, 'utf8'), original);
  assert.equal(readFileSync('story/episodes/ep01/.review-asset-prompts.md', 'utf8'), text);
}));
