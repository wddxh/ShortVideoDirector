import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { groupedVideo } from './fixtures/grouped-video.js';
import { readTaskPlan, selectTaskGroups, taskInputPath, assembleTask, resolveTaskInputs } from '../../scripts/shot-inputs.mjs';
import { resolveDreaminaMaterials } from '../../scripts/storyboard-materials-dreamina.mjs';

const scripts = join(process.cwd(), 'scripts');

test('each resolver snapshots selected manifest before access and parses it once', t => {
  const f = groupedVideo(t), cwd = process.cwd();
  const read = fs.readFileSync, realpath = fs.realpathSync;
  process.chdir(f.root);
  try {
    for (const resolve of [assembleTask, resolveTaskInputs, resolveDreaminaMaterials]) {
      f.write(f.input, JSON.stringify(f.manifest));
      const hashes = new Map();
      const hash = file => createHash('sha256').update(read(file)).digest('hex');
      let reads = 0;
      t.mock.method(fs, 'realpathSync', file => {
        if (file === f.input) assert.ok(hashes.has(file), 'callback precedes path access');
        return realpath(file);
      });
      t.mock.method(fs, 'readFileSync', (...args) => {
        if (args[0] === f.input) {
          assert.ok(hashes.has(f.input), 'callback precedes manifest read');
          reads++;
        }
        return read(...args);
      });
      const result = resolve(f.board, 'task01', 'ep01', file => {
        assert.equal(hashes.has(file), false, `callback runs once for ${file}`);
        hashes.set(file, hash(file));
        if (file === 'assets/items/lamp.md') {
          f.write(f.input, JSON.stringify({ ...f.manifest, prompt: 'Changed after first read' }));
        }
      });
      assert.equal(reads, 1);
      assert.notEqual(hashes.get(f.input), hash(f.input));
      if (resolve === resolveTaskInputs) assert.equal(result.prompt, f.manifest.prompt);
      else if (resolve === resolveDreaminaMaterials) assert.ok(result.materials);
      else {
        assert.deepEqual(Object.keys(result).sort(), ['common', 'manifest', 'members', 'referenceDetails']);
        assert.deepEqual(result.referenceDetails, [
          { media: 'image', path: f.image, name: 'lamp', markdown: 'assets/items/lamp.md' },
          { media: 'video', path: f.video, use: f.manifest.references[0].use },
        ]);
        assert.equal(result.manifest.prompt, f.manifest.prompt);
      }
      t.mock.restoreAll();
    }
  } finally { t.mock.restoreAll(); process.chdir(cwd); }
});

function submissionFixture(t) {
  const f = groupedVideo(t);
  const grant = { decision: 'Submit this group', episode: 'ep01', task_id: 'task01', shots: [1, 2, 3], constraints: [] };
  f.task.initial_authorization = grant;
  f.task.submission = JSON.parse(f.cli('video-task-inputs.mjs',
    ['capture', f.tasks, 'task01', 'dreamina', 'model', '16:9', '1080p']).stdout);
  f.save();
  const calls = join(f.root, 'calls');
  writeFileSync(join(f.root, 'dreamina'), '#!/usr/bin/env bash\nprintf "%s\\0" "$@" >> "$CALLS"\nprintf "%s" \'{"submit_id":"group-job"}\'\n', { mode: 0o755 });
  const run = () => spawnSync('bash', [join(scripts, 'video-gen-dreamina.sh'), '--references-json',
    f.task.prompt, f.output, JSON.stringify(f.task.references), '12', '16:9', 'model', '1080p'],
  { cwd: f.root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: 'config.md',
    PATH: `${f.root}:${process.env.PATH}`, CALLS: calls } });
  return { ...f, grant, calls, run };
}

test('one group makes one provider call and protects its submitted record', t => {
  const f = submissionFixture(t), result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.run().status, 1);
  const args = readFileSync(f.calls, 'utf8').split('\0');
  assert.equal(args.filter(a => a === 'multimodal2video').length, 1);
  assert.ok(args.includes('--duration=12'));
  const record = JSON.parse(readFileSync(join(f.root, f.tasks)))[0];
  assert.deepEqual(record.shots, [1, 2, 3]);
  assert.equal(record.submit_id, 'group-job');
  assert.equal(record.status, 'submitted');
});

test('pending recorded ID blocks capture/payment; confirmed failure may use its retry grant', t => {
  const f = submissionFixture(t);
  f.task.submit_id = 'previous-job'; f.save();
  assert.equal(f.run().status, 1);
  assert.equal(f.cli('video-task-inputs.mjs', ['capture', f.tasks, 'task01',
    'dreamina', 'model', '16:9', '1080p']).status, 1);
  assert.equal(existsSync(f.calls), false);
  f.task.status = 'failed';
  f.task.retry_authorization = { ...f.grant, max_attempts: 1, attempts: 0 }; f.save();
  assert.equal(f.run().status, 0);
  const record = JSON.parse(readFileSync(join(f.root, f.tasks)))[0];
  assert.equal(record.retry_authorization.attempts, 1);
  assert.equal(record.submit_id, 'group-job');
});

for (const invalid of ['truncated', 'unexpected-token']) {
test(`${invalid} unselected manifest reports a safe error before payment or record mutation`, t => {
  const f = submissionFixture(t);
  const other = f.input.replace('task01', 'task02');
  const sentinel = 'SECRET_PROMPT_SENTINEL';
  const malformed = invalid === 'truncated'
    ? JSON.stringify({ shots: [4], references: [], prompt: sentinel }).slice(0, -1)
    : `{"prompt":${sentinel}}`;
  f.write(other, malformed);
  const message = `Invalid JSON in ${other}` + (invalid === 'truncated'
    ? ` at position ${malformed.length} (line 1 column ${malformed.length + 1})` : '');
  const cwd = process.cwd();
  process.chdir(f.root);
  try {
    assert.throws(() => resolveTaskInputs(f.board, 'task01', 'ep01'), { message });
  } finally { process.chdir(cwd); }
  const before = readFileSync(join(f.root, f.tasks));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.ok((result.stdout + result.stderr).includes(message));
  assert.doesNotMatch(result.stdout + result.stderr, /SECRET|prompt/);
  assert.equal(existsSync(f.calls), false);
  assert.deepEqual(readFileSync(join(f.root, f.tasks)), before);
});
}

test('manifest, record and grant membership drift reject before payment or retry reservation', t => {
  const f = submissionFixture(t);
  const original = structuredClone(f.task);
  const mutations = [
    () => { f.task.shots = [1, 2]; },
    () => { f.task.initial_authorization.shots = [1]; },
    () => { f.task.initial_authorization.task_id = 'task02'; },
    () => { f.task.task_id = 'task02'; },
    () => f.write(f.input, JSON.stringify({ ...f.manifest, shots: [2, 3] })),
    () => { f.task.status = 'failed'; f.task.retry_authorization = { ...f.grant,
      shots: [1, 2], max_attempts: 2, attempts: 0 }; },
    () => { f.task.status = 'failed'; f.task.retry_authorization = { ...f.grant,
      max_attempts: 2, attempts: 0 };
      f.write(f.input, JSON.stringify({ ...f.manifest, shots: [2, 3] })); },
  ];
  for (const mutate of mutations) {
    for (const key of Object.keys(f.task)) delete f.task[key];
    Object.assign(f.task, structuredClone(original));
    f.write(f.input, JSON.stringify(f.manifest));
    mutate(); f.save();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
});
test('three photographic shots retain duration, prose and cuts in one derived task timeline', t => {
  const f = groupedVideo(t), r = f.resolved;
  assert.equal(r.task_id, 'task01');
  assert.deepEqual(r.shots, [1, 2, 3]);
  assert.equal(r.duration, 12);
  assert.deepEqual(r.timeline, [{ shot: 1, start: 0, end: 3 },
    { shot: 2, start: 3, end: 7 }, { shot: 3, start: 7, end: 12 }]);
  assert.equal(r.prompt, f.manifest.prompt);
  assert.deepEqual(r.references, [{ media: 'image', path: f.image }, { media: 'video', path: f.video }]);
  assert.deepEqual(r.sources, ['references/scene.blend']);
  f.write(f.board, f.blocks.join('\n\n').replaceAll('\n', '\r\n'));
  assert.deepEqual(JSON.parse(f.convert().stdout), r);
});

test('lengthening one canonical shot grows the group and downstream offsets without compensation', t => {
  const f = groupedVideo(t);
  const records = readFileSync(join(f.root, f.tasks), 'utf8');
  const blocks = [...f.blocks];
  blocks[1] = blocks[1].replace('- 时长：4s', '- 时长：6s')
    .replace('[1s-4s]', '[1s-6s]');
  f.write(f.board, blocks.join('\n\n'));
  const result = f.convert();
  assert.equal(result.status, 0, result.stderr);
  const revised = JSON.parse(result.stdout);
  assert.equal(revised.duration, f.resolved.duration + 2);
  assert.deepEqual(revised.timeline, [{ shot: 1, start: 0, end: 3 },
    { shot: 2, start: 3, end: 9 }, { shot: 3, start: 9, end: 14 }]);
  assert.deepEqual(revised.timeline.map(({ start, end }) => end - start), [3, 6, 5]);
  assert.equal(revised.prompt, f.resolved.prompt);
  assert.deepEqual(revised.shots, f.resolved.shots);
  assert.deepEqual(revised.references, f.resolved.references);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), records);
});

test('task APIs select whole groups, report partial scope and preserve stable identity', t => {
  const f = groupedVideo(t), cwd = process.cwd();
  process.chdir(f.root);
  try {
    assert.equal(taskInputPath('ep01', 'task01'), f.input);
    const plan = readTaskPlan(f.board, 'ep01');
    assert.deepEqual(plan.shots, [1, 2, 3]);
    assert.equal(selectTaskGroups(plan).length, 1);
    assert.throws(() => selectTaskGroups(plan, [1, 3]), /task01.*additional members required: 2/);
    assert.deepEqual(resolveTaskInputs(f.board, 'task01', 'ep01'), f.resolved);
    f.write(f.input, JSON.stringify({ ...f.manifest, shots: [2, 3] }));
    assert.equal(resolveTaskInputs(f.board, 'task01', 'ep01').task_id, 'task01');
    assert.throws(() => selectTaskGroups(readTaskPlan(f.board, 'ep01')), /Unassigned requested shots: 1/);
  } finally { process.chdir(cwd); }
});

test('scoped snippets allow gaps and unassigned/unrendered neighbors, not invalid global declarations', t => {
  const f = groupedVideo(t);
  f.write(f.board, f.blocks.map((b, i) => b.replace(`shot ${i + 1}`, `shot ${[3, 15, 20][i]}`)).join('\n\n'));
  f.write(f.input, JSON.stringify({ ...f.manifest, shots: [15, 20] }));
  const other = f.input.replace('task01', 'task99');
  const check = (...shots) => f.cli('check-shot-inputs.mjs', ['ep01', ...shots]);
  assert.equal(check('15', '20').status, 0);
  assert.equal(check().status, 1);
  assert.match(check('15').stderr, /additional members required: 20/);
  assert.match(check('3').stderr, /Unassigned requested shots: 3/);
  assert.equal(check('14').status, 1);
  f.write(other, JSON.stringify({ shots: [3], references: [{ kind: 'local', path: 'references/missing.mp4' }] }));
  assert.equal(check('15', '20').status, 0);
  assert.equal(JSON.parse(f.convert().stdout).prompt, f.manifest.prompt);
  for (const prompt of ['', null, 123]) {
    f.write(other, JSON.stringify({ shots: [3], references: [], prompt }));
    assert.equal(check('15', '20').status, 0);
    assert.equal(JSON.parse(f.convert().stdout).prompt, f.manifest.prompt);
  }
  for (const shots of [[3, 20], [9], [20, 15]]) {
    f.write(other, JSON.stringify({ shots, references: [] }));
    assert.equal(check('15', '20').status, 1);
  }
  rmSync(join(f.root, other));
  for (const shots of [[15, 15], [20, 15], [3, 20], [15, 21]]) {
    f.write(f.input, JSON.stringify({ ...f.manifest, shots }));
    assert.equal(check('15', '20').status, 1);
  }
});
