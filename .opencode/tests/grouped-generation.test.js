import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { groupedVideo } from './fixtures/grouped-video.js';
import { readTaskPlan, selectTaskGroups, taskInputPath, resolveTaskInputs } from '../../scripts/shot-inputs.mjs';

const scripts = join(process.cwd(), 'scripts');
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
  assert.equal(r.prompt.split('- 视频风格：写实').length - 1, 1);
  const rebased = [[0, 2.5, 1, 3], [3, 5.5, 4, 7], [7, 9.5, 8, 12]];
  for (const [i, block] of f.blocks.entries()) {
    const [a, b, c, d] = rebased[i];
    const expected = block.replace('- 视频风格：写实\n', '')
      .replaceAll('[lamp](assets/items/lamp.md)', '[lamp:{图片1}]')
      .replace('[0s-2.5s]', `[${a}s-${b}s]`).replace(`[1s-${[3,4,5][i]}s]`, `[${c}s-${d}s]`);
    assert.ok(r.prompt.includes(expected));
  }
  assert.deepEqual(r.references, [{ media: 'image', path: f.image }, { media: 'video', path: f.video }]);
  assert.deepEqual(r.sources, ['references/scene.blend']);
  f.write(f.board, f.blocks.join('\n\n').replaceAll('\n', '\r\n'));
  assert.deepEqual(JSON.parse(f.convert().stdout), r);
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

test('assembly rejects differing baselines, out-of-range cues and cross-member undeclared links', t => {
  const f = groupedVideo(t);
  for (const changed of [f.blocks[1].replace('视频风格：写实', '视频风格：动画'),
    f.blocks[1].replace('[0s-2.5s]', '[-1s-2.5s]'),
    f.blocks[1].replace('[0s-2.5s]', '[0s-5s]'),
    f.blocks[1].replace('[0s-2.5s]', '[2s-2s]'),
    f.blocks[1].replace('- 引用资产：[lamp](assets/items/lamp.md)', '- 引用资产：无') +
      '\n[lamp](assets/items/lamp.md) stays.']) {
    f.write(f.board, [f.blocks[0], changed, f.blocks[2]].join('\n\n'));
    assert.equal(f.convert().status, 1);
  }
});

test('shared style links bind once without changing member dialogue or other prompt content', t => {
  const f = submissionFixture(t);
  f.write(f.board, f.blocks.map(block => block.replace('视频风格：写实',
    '视频风格：写实 [lamp](assets/items/lamp.md)')).join('\n\n'));
  const result = f.convert();
  assert.equal(result.status, 0, result.stderr);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.prompt, f.resolved.prompt.replace('- 视频风格：写实',
    '- 视频风格：写实 [lamp:{图片1}]'));
  assert.deepEqual(resolved.references, f.resolved.references);
  f.task.prompt = resolved.prompt; f.save(); f.evidence();
  assert.equal(f.run().status, 0);
  assert.ok(readFileSync(f.calls, 'utf8').split('\0').includes(`--prompt=${resolved.prompt}`));
});

test('style references require every member declaration and existing assets before payment', t => {
  const f = submissionFixture(t);
  const styled = f.blocks.map(block => block.replace('视频风格：写实',
    '视频风格：写实 [lamp](assets/items/lamp.md)'));
  const missingMember = styled.map((block, i) => i === 1
    ? block.replace('- 引用资产：[lamp](assets/items/lamp.md)', '- 引用资产：无') : block);
  const missingAsset = styled.map(block => block.replace(
    '视频风格：写实 [lamp](assets/items/lamp.md)', '视频风格：写实 [missing](assets/items/missing.md)'));
  for (const blocks of [missingMember, missingAsset,
    missingAsset.map(block => block.replace('- 引用资产：', '- 引用资产：[missing](assets/items/missing.md) '))]) {
    f.write(f.board, blocks.join('\n\n'));
    const converted = f.convert();
    assert.equal(converted.status, 1);
    assert.match(converted.stderr, /Undeclared shot reference|ENOENT/);
    for (const status of ['pending', 'failed']) {
      f.task.status = status;
      f.task.retry_authorization = { ...f.grant, max_attempts: 1, attempts: 0 }; f.save();
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      const result = f.run();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Undeclared shot reference|ENOENT/);
      assert.equal(existsSync(f.calls), false);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    }
  }
});

test('asset union follows member header first use before ordered local media', t => {
  const f = groupedVideo(t);
  const card = 'assets/items/key.md', image = 'assets/images/items/key.png';
  f.write(card, 'card'); f.write(image, 'PNG');
  const blocks = [...f.blocks];
  blocks[1] = blocks[1].replace('- 引用资产：[lamp](assets/items/lamp.md)',
    `- 引用资产：[key](${card}) [lamp](assets/items/lamp.md)`);
  blocks[2] += `\n[key](${card}) in prose but absent from own header.`;
  f.write(f.board, blocks.join('\n\n'));
  assert.match(f.convert().stderr, /Undeclared shot reference: shot 3/);
  blocks[2] = blocks[2].replace('- 引用资产：[lamp](assets/items/lamp.md)',
    `- 引用资产：[lamp](assets/items/lamp.md) [key](${card})`);
  f.write(f.board, blocks.join('\n\n'));
  const r = JSON.parse(f.convert().stdout);
  assert.deepEqual(r.assetCards, ['assets/items/lamp.md', card]);
  assert.deepEqual(r.references.map(ref => ref.path), [f.image, image, f.video]);
  assert.equal(r.prompt.split('[key:{图片2}] identity reference').length - 1, 1);
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
