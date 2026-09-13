import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { videoProject } from './fixtures/video-project.js';
import { qualification, visualException } from './fixtures/visual-exception.js';

const receipt = 'story/decisions/ep01/task01.shot-input-visual-exception.json';
const read = (f, file) => fs.readFileSync(path.join(f.root, file), 'utf8');
const ready = (f, ...shots) => f.cli('review-evidence.mjs', ['check', 'ep01', ...shots]);
const ok = r => assert.equal(r.status, 0, r.stderr + r.stdout);

test('explicit acceptance preserves unknown and history; same checker serves whole and scoped ready', t => {
  const f = videoProject(t), old = read(f, f.reviews['shot-input'][0]);
  const x = visualException(t, f);
  ok(x.finish());
  const review = read(f, f.reviews['shot-input'][0]);
  assert.ok(review.startsWith(old));
  assert.equal(ready(f, '1').status, 1);
  ok(x.record()); ok(x.check());
  for (const r of [ready(f), ready(f, '1')]) {
    ok(r); assert.match(r.stdout, /shot-input-review:unknown/);
    assert.match(r.stdout, /shot-input-acceptance:user_visual_exception:/);
  }
  const independent = f.cli('review-evidence.mjs', ['check-target', 'shot-input', 'ep01', x.target]);
  assert.equal(independent.status, 1);
  assert.equal(JSON.parse(independent.stdout).status, 'unknown');
  assert.equal(read(f, f.reviews['shot-input'][0]), review);
  assert.equal(x.record().status, 1);
  assert.equal(JSON.parse(read(f, receipt)).grants_submission, false);
});

test('all required and extra dependencies, source and new review invalidate without renewal', t => {
  const f = videoProject(t);
  f.write('references/boundary.txt', 'Boundary evidence');
  const x = visualException(t, f, qualification(), ['references/boundary.txt']);
  ok(x.finish()); ok(x.record());
  const stored = read(f, receipt), record = JSON.parse(stored);
  for (const file of [...record.inputs.map(i => i.path), record.source.path, record.review.path]) {
    const old = read(f, file);
    f.write(file, old + '\nchanged');
    assert.equal(x.check().status, 1, file);
    assert.equal(ready(f, '1').status, 1, file);
    f.write(file, old);
  }
  fs.unlinkSync(path.join(f.root, 'references/scene.blend'));
  assert.equal(x.check().status, 1);
  f.write('references/scene.blend', 'scene');
  ok(x.check());
  f.write(record.review.path, read(f, record.review.path) + '\n## 第 3 轮\n');
  assert.equal(x.check().status, 1);
  assert.equal(read(f, receipt), stored);
});

test('wrong identity, config and membership cannot reuse acceptance', t => {
  const f = videoProject(t), x = visualException(t, f);
  ok(x.finish()); ok(x.record());
  const stored = JSON.parse(read(f, receipt));
  for (const [key, value] of [['root', '/tmp/other'], ['config_path', 'other.md'],
    ['episode', 'ep02'], ['task_id', 'task02'], ['shots', [1, 2]], ['type', 'pass'],
    ['actor', 'reviewer'], ['grants_submission', true], ['inputs', []]]) {
    f.write(receipt, JSON.stringify({ ...stored, [key]: value }));
    assert.equal(x.check().status, 1, key);
  }
});

test('request scope, provenance and symlink aliases fail closed', t => {
  const f = videoProject(t), x = visualException(t, f);
  ok(x.finish());
  for (const delta of [{ shots: [] }, { shots: [1, 2] }, { shots: [2] },
    { decision: 'Invented approval' }, { source: '../outside.md' },
    { source: '/tmp/outside.md' }, { source: 'story/decisions/missing.md' }, { extra: true }]) {
    fs.writeFileSync(x.request, JSON.stringify({ ...x.data, ...delta }));
    assert.equal(x.record().status, 1, JSON.stringify(delta));
  }
  fs.writeFileSync(x.request, JSON.stringify(x.data));
  const sourceText = read(f, x.source);
  f.write('story/decisions/real.md', sourceText);
  fs.unlinkSync(path.join(f.root, x.source));
  fs.symlinkSync('real.md', path.join(f.root, x.source));
  assert.equal(x.record().status, 1);
  fs.unlinkSync(path.join(f.root, x.source)); f.write(x.source, sourceText);
  fs.symlinkSync('/tmp/opencode', path.join(f.root, 'story/decisions/ep01'));
  assert.equal(x.record().status, 1);
  fs.unlinkSync(path.join(f.root, 'story/decisions/ep01'));
  ok(x.record());
  const saved = read(f, receipt);
  fs.unlinkSync(path.join(f.root, receipt));
  f.write('story/decisions/copy.json', saved);
  fs.symlinkSync('../copy.json', path.join(f.root, receipt));
  assert.equal(x.check().status, 1);
});

test('qualification rejects other blockers and is removed on evidence errors', t => {
  const f = videoProject(t), x = visualException(t, f);
  const good = qualification(), q = good.visual_exception_qualification;
  for (const result of [{ ...good, status: 'pass' }, { ...good, status: 'needs_revision' },
    { ...good, blockers: [...good.blockers, 'Token binding unknown'] },
    ...[{ non_visual: 'unknown' }, { external_boundaries: 'unknown' },
      { remaining: 'all' }, { extra: true }].map(delta => ({ ...good,
      visual_exception_qualification: { ...q, ...delta } }))]) {
    fs.writeFileSync(x.payload, JSON.stringify({ result }));
    assert.equal(x.finish().status, 1);
  }
  fs.writeFileSync(x.payload, JSON.stringify({ result: good }));
  f.write(f.video, 'Changed during review');
  const finished = x.finish(); ok(finished);
  assert.ok(JSON.parse(finished.stdout).evidence_issues.length);
  assert.doesNotMatch(read(f, f.reviews['shot-input'][0]), /visual_exception_qualification/);
  assert.equal(x.record().status, 1);
});

test('acceptance never waives other review gates or global structure', t => {
  const f = videoProject(t, 1, 2), x = visualException(t, f);
  ok(x.finish()); ok(x.record());
  for (const kind of ['script', 'storyboard', 'asset-visual', 'shot-input']) {
    const file = f.reviews[kind][kind === 'shot-input' ? 1 : 0], old = read(f, file);
    fs.unlinkSync(path.join(f.root, file));
    assert.equal(ready(f).status, 1, kind);
    if (kind === 'shot-input') ok(ready(f, '1'));
    f.write(file, old);
  }
  const second = x.target.replace('task01', 'task02');
  f.write(second, JSON.stringify({ ...JSON.parse(read(f, second)), shots: [1] }));
  assert.equal(ready(f, '1').status, 1);
});

test('explicit configuration and valid qualified history are mandatory', t => {
  const f = videoProject(t), x = visualException(t, f);
  assert.equal(x.record().status, 1); // unfinished round
  ok(x.finish());
  const review = f.reviews['shot-input'][0], old = read(f, review);
  for (const text of ['invalid', old.replaceAll('"external_boundaries":"pass"',
    '"external_boundaries":"unknown"'), old.replace('<!-- /round-2 -->', '')]) {
    f.write(review, text); assert.equal(x.record().status, 1);
  }
  f.write(review, old);
  const command = value => spawnSync('node', [path.resolve('scripts/shot-input-visual-exception.mjs'),
    'record', 'ep01', 'task01', x.request], { cwd: f.root, encoding: 'utf8',
    env: { ...process.env, SVD_CONFIG: value } });
  f.write('other.md', read(f, 'config.md'));
  for (const value of ['', 'UNRESOLVED', 'other.md', '/tmp/outside-config.md']) {
    assert.equal(command(value).status, 1, value);
  }
  ok(x.record());
  const original = read(f, receipt), parsed = JSON.parse(original);
  f.write(receipt, JSON.stringify(Object.fromEntries(Object.entries(parsed).reverse())));
  ok(x.check());
  fs.unlinkSync(path.join(f.root, 'config.md'));
  fs.symlinkSync('other.md', path.join(f.root, 'config.md'));
  assert.equal(x.check().status, 1);
});

test('multi-shot acceptance selects the entire ordered group only', t => {
  const f = videoProject(t, 1, 2);
  const first = 'story/episodes/ep01/task-inputs/task01.json';
  const second = first.replace('task01', 'task02');
  f.write(first, JSON.stringify({ ...JSON.parse(read(f, first)), shots: [1, 2] }));
  fs.unlinkSync(path.join(f.root, second));
  const x = visualException(t, f);
  ok(x.finish());
  assert.equal(x.record().status, 1);
  for (const shots of [[2, 1], [2], [1, 2, 3]]) {
    fs.writeFileSync(x.request, JSON.stringify({ ...x.data, shots }));
    assert.equal(x.record().status, 1);
  }
  fs.writeFileSync(x.request, JSON.stringify({ ...x.data, shots: [1, 2] }));
  ok(x.record()); ok(ready(f, '1', '2'));
  assert.equal(ready(f, '1').status, 1);
  assert.equal(ready(f, '2').status, 1);
  const source = 'references/scene.blend';
  fs.unlinkSync(path.join(f.root, source));
  fs.symlinkSync(x.request, path.join(f.root, source));
  assert.equal(x.check().status, 1);
  assert.equal(ready(f, '1', '2').status, 1);
});
