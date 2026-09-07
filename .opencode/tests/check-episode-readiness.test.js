import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { videoProject } from './fixtures/video-project.js';

const ep = 'story/episodes/ep01';
const input = `${ep}/shot-inputs/shot01.json`;
const script = join(process.cwd(), 'scripts/check-episode.sh');
const run = (f, config = 'config.md') => spawnSync('bash', [script, 'ep01', config], { cwd: f.root, encoding: 'utf8' });
const read = (f, file) => readFileSync(join(f.root, file), 'utf8');

test('scoped checker resolves selected manifests and rejects invalid selections', t => {
  const f = videoProject(t, 1, 2);
  rmSync(join(f.root, input.replace('shot01', 'shot02')));
  assert.equal(f.cli('check-shot-inputs.mjs', ['ep01', '1']).status, 0);
  assert.equal(f.cli('review-evidence.mjs', ['check', 'ep01', '1']).status, 0);
  for (const args of [['ep01'], ['ep01', '2'], ['ep01', '9'], ['ep01', '--unknown']]) {
    assert.equal(f.cli('check-shot-inputs.mjs', args).status, 1);
  }
});

test('scoped shot 15 accepts gaps but rejects duplicate or decreasing provided headings', t => {
  const f = videoProject(t);
  const board = `${ep}/storyboard.md`, target = input.replace('shot01', 'shot15');
  const block = read(f, board).replace('shot 1', 'shot 15');
  f.write(target, read(f, input));
  rmSync(join(f.root, input));
  const renew = () => {
    for (const [kind, file, path] of [['script', 'script', `${ep}/script.md`],
      ['storyboard', 'storyboard', board], ['asset-visual', 'basic-assets-visual', 'assets/items/lamp.md'],
      ['shot-input', 'shot-inputs', target]]) {
      const required = f.cli('review-evidence.mjs', ['required', kind, path]);
      assert.equal(required.status, 0, required.stderr);
      const inputs = JSON.parse(f.cli('review-evidence.mjs', ['fingerprint', ...JSON.parse(required.stdout)]).stdout);
      f.write(`${ep}/.review-${file}.md`, '## 第 1 轮\n<!-- svd-review-evidence -->\n```json\n' +
        JSON.stringify({ kind, scope: [path],
          results: [{ target: path, status: 'pass', inputs, blockers: [] }] }) + '\n```\n<!-- /round-1 -->\n');
    }
  };
  const check = (...shots) => f.cli('check-shot-inputs.mjs', ['ep01', ...shots]);
  const review = (...shots) => f.cli('review-evidence.mjs', ['check', 'ep01', ...shots]);
  f.write(board, block); renew();
  assert.equal(check('15').status, 0);
  assert.equal(review('15').status, 0);
  assert.equal(check().status, 1);
  assert.equal(review().status, 1);
  f.write(board, `### shot 3\n\n${block}\n### shot 20\n`); renew();
  assert.equal(check('15').status, 0);
  assert.equal(review('15').status, 0);
  for (const headings of ['### shot 3\n### shot 3', '### shot 4\n### shot 3', '### shot 20']) {
    f.write(board, `${headings}\n\n${block}`); renew();
    assert.equal(check('15').status, 1, headings);
    assert.equal(review('15').status, 1, headings);
  }
  f.write(board, `${block}\n${block}`);
  assert.equal(check('15').status, 1);
  assert.equal(review('15').status, 1);
});

test('selected review checks only referenced assets; reused assets still need current visuals', t => {
  const f = videoProject(t);
  const text = read(f, `${ep}/script.md`);
  f.write(`${ep}/script.md`, text.replace('- characters: (无)', '- items: reused (assets/items/reused.md)'));
  f.write('assets/items/reused.md', 'card');
  f.write('assets/images/items/reused.png', 'PNG');
  f.evidence();
  const check = (...shots) => f.cli('review-evidence.mjs', ['check', 'ep01', ...shots]);
  assert.equal(check('1').status, 0);
  assert.equal(check().status, 1);
  assert.equal(check('9').status, 1);
  rmSync(join(f.root, 'assets/images/items/reused.png'));
  assert.match(run(f).stdout, /^images:missing:reused$/m);
  f.write(f.image, 'changed');
  assert.match(check('1').stdout, /^asset-visual-review:unknown$/m);
  rmSync(join(f.root, f.image)); assert.equal(check('1').status, 1);
});

test('interrupted scoped evidence and heading-only reviews cannot establish acceptance', t => {
  const f = videoProject(t, 1, 2), file = `${ep}/.review-shot-inputs.md`;
  const old = read(f, file), target = input.replace('shot01', 'shot02');
  const start = '\n## 第 2 轮\n<!-- svd-review-evidence -->\n```json\n';
  const check = shot => f.cli('review-evidence.mjs', ['check', 'ep01', shot]);
  for (const suffix of [JSON.stringify({ kind: 'shot-input', scope: [target], results: [] }),
    `{"kind":"shot-input","scope":["${target}"],"results":[`]) {
    f.write(file, old + start + suffix);
    assert.equal(check('1').status, 0);
    assert.equal(check('2').status, 1);
  }
  for (const text of [old + start + '{', '## 第 1 轮\n<!-- /round-1 -->\n']) {
    f.write(file, text); assert.equal(check('1').status, 1);
  }
  rmSync(join(f.root, file)); assert.equal(check('1').status, 1);
});

test('neighbor review extra input hashes stale only the dependent shot', t => {
  const f = videoProject(t, 1, 3);
  const neighbor = `${ep}/.review-neighbor.md`;
  f.write(neighbor, 'visual observation');
  const extra = JSON.parse(f.cli('review-evidence.mjs', ['fingerprint', neighbor]).stdout)[0];
  edit(f, '.review-shot-inputs.md', r => { r.results[1].inputs.push(extra); });
  const check = shot => f.cli('review-evidence.mjs', ['check', 'ep01', String(shot)]);
  assert.equal(check(2).status, 0);
  f.write(neighbor, 'new visual observation');
  assert.equal(check(1).status, 0);
  assert.equal(check(2).status, 1);
  assert.equal(check(3).status, 0);
});

test('base inventory completeness and provider-independent image checks stay scoped', t => {
  const f = videoProject(t);
  f.write('config.md', '- mode: short\n- 图像提供方: none\n'); f.evidence();
  f.write('assets/characters/unrelated.md', 'card');
  assert.equal(run(f).status, 0);
  rmSync(join(f.root, f.image));
  assert.match(run(f).stdout, /^images:missing:lamp$/m);
  f.write(f.image, 'PNG'); f.evidence();
  rmSync(join(f.root, 'assets/items/lamp.md'));
  assert.match(run(f).stdout, /^assets:missing:lamp$/m);
  f.write(`${ep}/script.md`, 'incomplete');
  assert.match(run(f).stdout, /^script:incomplete$/m);
  f.write(`${ep}/script.md`, '## 场景 1\n');
  assert.match(run(f).stdout, /^images:unknown$/m);
  rmSync(join(f.root, `${ep}/script.md`));
  assert.match(run(f).stdout, /^script:missing$/m);
});

test('active custom config requires its own fingerprints, never default fallback', t => {
  const f = videoProject(t);
  f.write('custom.md', '- mode: short\n');
  assert.equal(run(f, 'custom.md').status, 1);
  const hash = JSON.parse(f.cli('review-evidence.mjs', ['fingerprint', 'custom.md']).stdout)[0];
  for (const file of ['script', 'storyboard', 'basic-assets-visual', 'shot-inputs']) {
    edit(f, `.review-${file}.md`, r => {
      for (const result of r.results) result.inputs = result.inputs.map(i => i.path === 'config.md' ? hash : i);
    });
  }
  assert.equal(run(f, 'custom.md').status, 0);
  f.write('config.md', '- mode: invalid\n'); assert.equal(run(f, 'custom.md').status, 0);
  f.write('custom.md', '- mode: series\n'); assert.equal(run(f, 'custom.md').status, 1);
});

test('preparatory approval binds episode and current nonempty planning inputs', t => {
  const f = videoProject(t);
  const record = { episode: 'ep01', required: ['outline'], approval: null };
  const config = () => f.write('config.md', '- mode: short\n## 制作前确认 ep01\n```json\n' + JSON.stringify(record) + '\n```\n');
  config(); f.evidence();
  assert.match(run(f).stdout, /preparatory-review:unknown/);
  f.write(`${ep}/outline.md`, 'plan');
  record.approval = { decision: 'Approved', inputs: JSON.parse(f.cli('review-evidence.mjs', ['fingerprint', `${ep}/outline.md`]).stdout) };
  config(); f.evidence();
  assert.equal(run(f).status, 0);
  f.write(`${ep}/outline.md`, 'changed'); assert.equal(run(f).status, 1);
  f.write(`${ep}/outline.md`, '');
  record.approval.inputs = JSON.parse(f.cli('review-evidence.mjs', ['fingerprint', `${ep}/outline.md`]).stdout);
  config(); f.evidence(); assert.equal(run(f).status, 1);
  f.write('config.md', '- mode: short\n## 制作前确认 ep01\n```json\n{');
  assert.equal(run(f).status, 1);
  f.write('config.md', '- mode: short\n## 制作前确认 ep02\n```json\n{');
  f.evidence(); assert.equal(run(f).status, 0);
});

test('inline mode comments and unrequested optional plans are accepted', t => {
  const f = videoProject(t);
  f.write('config.md', '- mode: series # series project\n');
  f.write(`${ep}/outline.md`, 'unfinished'); f.write(`${ep}/novel.md`, 'short'); f.evidence();
  const result = run(f);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^mode:series$/m);
  assert.doesNotMatch(result.stdout, /^novel:/m);
});

test('numbering and exactly one positive duration remain mandatory', t => {
  const f = videoProject(t, 1, 3), board = `${ep}/storyboard.md`;
  const original = read(f, board);
  for (const changed of [original.replace('shot 2', 'shot 4'), original.replace('shot 2', 'shot 1'),
    original.replace('shot 2', 'shot X').replace('shot 3', 'shot 2').replace('shot X', 'shot 3'),
    ...['', '- 时长：0s', '- 时长：10s\n- 时长：6s', '- 时长：10s\n- 时长：bad'].map(
      line => original.replace('- 时长：10s', line))]) {
    f.write(board, changed);
    assert.equal(f.cli('check-shot-inputs.mjs', ['ep01']).status, 1, changed);
    assert.equal(run(f).status, 1);
  }
  f.write(board, original);
  assert.equal(f.cli('check-shot-inputs.mjs', ['ep01']).status, 0);
});

test('required dependency omissions and missing manifests cannot preserve pass', t => {
  const f = videoProject(t);
  for (const file of ['.review-storyboard.md', '.review-shot-inputs.md']) {
    const original = read(f, `${ep}/${file}`);
    const record = JSON.parse(/```json\n([^`]+)\n```/.exec(original)[1]);
    for (const omitted of record.results[0].inputs) {
      edit(f, file, r => { r.results[0].inputs = r.results[0].inputs.filter(i => i.path !== omitted.path); });
      assert.equal(run(f).status, 1, omitted.path);
      f.write(`${ep}/${file}`, original);
    }
  }
  rmSync(join(f.root, input));
  assert.equal(run(f).status, 1);
  assert.equal(f.cli('review-evidence.mjs', ['check', 'ep01', '1']).status, 1);
});
function edit(f, file, change) {
  const text = read(f, `${ep}/${file}`);
  const block = /```json\n([^`]+)\n```/.exec(text);
  const record = JSON.parse(block[1]); change(record);
  f.write(`${ep}/${file}`, text.replace(block[1], JSON.stringify(record)));
}

test('readiness requires script, storyboard, asset visual and shot input reviews', t => {
  const f = videoProject(t);
  rmSync(join(f.root, `${ep}/.review-asset-prompts.md`));
  const result = run(f);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const stage of ['script', 'storyboard', 'asset-visual', 'shot-input']) assert.ok(result.stdout.includes(`${stage}-review:ok`));
  assert.doesNotMatch(result.stdout, /asset-prompt-review/);
  assert.equal(result.stdout.split('shot-inputs:ok').length - 1, 1);
  assert.equal(result.stdout.split('storyboard:ok').length - 1, 1);
  for (const file of ['script', 'storyboard', 'basic-assets-visual', 'shot-inputs']) {
    const review = `${ep}/.review-${file}.md`, saved = read(f, review);
    rmSync(join(f.root, review));
    assert.equal(run(f).status, 1, file);
    f.write(review, saved);
  }
  f.write(input, '{');
  for (const checked of [run(f), f.cli('review-evidence.mjs', ['check', 'ep01', '1'])]) {
    assert.equal(checked.status, 1);
    assert.match(checked.stdout, /^shot-inputs:invalid:shot1:/m);
  }
});
