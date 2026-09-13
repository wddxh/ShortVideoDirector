import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { videoProject } from './fixtures/video-project.js';
import { visualException } from './fixtures/visual-exception.js';

const script = join(process.cwd(), 'scripts/video-gen-dreamina.sh');
const input = 'story/episodes/ep01/task-inputs/task01.json';

test('user visual acceptance preserves authorization and protected state at gate/reserve', t => {
  const f = fixture(t), x = visualException(t, f);
  assert.equal(x.finish().status, 0);
  assert.equal(x.record().status, 0);
  const initial = f.task.initial_authorization;
  const retry = { decision: 'Retry once', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 1, attempts: 1 };
  for (const delta of [
    { initial_authorization: undefined },
    { status: 'failed', retry_authorization: undefined },
    { status: 'failed', retry_authorization: retry },
    { inflight: { token: 'unresolved' } },
    { status: 'submitted', submit_id: 'existing' },
    { status: 'done', submit_id: 'existing' },
    { shots: [1, 2] }, { initial_authorization: { ...initial, shots: [2] } },
    { prompt: f.task.prompt + 'changed' },
  ]) {
    const base = structuredClone(f.task);
    Object.assign(f.task, delta); f.save();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    for (const action of ['gate', 'reserve']) {
      const r = f.cli('video-task-inputs.mjs', [action, '--references-json',
        ...f.args().slice(0, 6), 'dreamina', '1080p']);
      assert.equal(r.status, 1, JSON.stringify(delta));
    }
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    for (const key of Object.keys(f.task)) delete f.task[key];
    Object.assign(f.task, base);
  }
});

test('accepted unknown forwards exact prompt/refs only with a grant; drift is zero-call', t => {
  const f = fixture(t), x = visualException(t, f);
  assert.equal(x.finish().status, 0);
  assert.equal(x.record().status, 0);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  for (const file of [f.video, f.image, input, 'references/scene.blend']) {
    const old = readFileSync(join(f.root, file), 'utf8');
    f.write(file, old + '\nchanged');
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    f.write(file, old);
  }
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const args = readFileSync(f.calls, 'utf8').split('\0').slice(0, -1);
  assert.deepEqual(args, ['multimodal2video', ...f.task.references.flatMap(r => [`--${r.media}`, r.path]),
    `--prompt=${f.task.prompt}`, '--duration=10', '--ratio=16:9', '--video_resolution=1080p',
    '--model_version=stored-model']);
  assert.equal(JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0].submit_id, 'job-1');
});

test('exception retry rechecks inputs before consuming the persisted attempt', t => {
  const f = fixture(t), x = visualException(t, f);
  assert.equal(x.finish().status, 0);
  assert.equal(x.record().status, 0);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry once unchanged', episode: 'ep01',
    task_id: 'task01', shots: [1], constraints: [], max_attempts: 1, attempts: 0 };
  f.save();
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const source = 'references/scene.blend', old = readFileSync(join(f.root, source), 'utf8');
  f.write(source, old + 'changed');
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  f.write(source, old);
  const submitted = f.run();
  assert.equal(submitted.status, 0, submitted.stderr);
  const task = JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0];
  assert.equal(task.retry_authorization.attempts, 1);
  assert.equal(task.status, 'submitted');
});
function writePrompt(f, prompt) {
  const manifest = JSON.parse(readFileSync(join(f.root, input), 'utf8'));
  f.write(input, JSON.stringify({ ...manifest, prompt }));
}
function fixture(t, references = 1, shots = 1) {
  const f = videoProject(t, references, shots);
  f.task.submission = JSON.parse(f.cli('video-task-inputs.mjs',
    ['capture', f.tasks, 'task01', 'dreamina', 'stored-model', '16:9', '1080p']).stdout);
  f.task.initial_authorization = { decision: 'Submit ep01 shot 1 once', episode: 'ep01',
    task_id: 'task01', shots: [1], constraints: [] };
  f.save();
  const calls = join(f.root, 'calls');
  writeFileSync(join(f.root, 'dreamina'), `#!/usr/bin/env bash
printf '%s\\0' "$@" > "$CALLS"
printf '%s\\n' "$RESPONSE"
`, { mode: 0o755 });
  const args = () => [f.task.prompt, f.output, JSON.stringify(f.task.references), String(f.task.duration),
    f.task.submission.ratio, f.task.submission.model, f.task.submission.resolution];
  const run = (values = args(), response = '{"gen_status":"querying","submit_id":"job-1"}') => {
    rmSync(calls, { force: true });
    return spawnSync('bash', [script, '--references-json', ...values], { cwd: f.root, encoding: 'utf8',
      env: { ...process.env, SVD_CONFIG: 'config.md', PATH: `${f.root}:${process.env.PATH}`,
        CALLS: calls, RESPONSE: response } });
  };
  return { ...f, args, run, calls };
}

test('series rechecks cross-episode conflicts at gate/reserve with zero mutation or payment', (t) => {
  const f = fixture(t);
  f.write('config.md', '- mode: series\n'); f.evidence();
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry once', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 1, attempts: 0 };
  f.save();
  const other = 'story/episodes/ep02/videos/tasks.json';
  for (const submission of [undefined, ...Object.entries({ provider: 'other', model: 'other',
    ratio: '9:16', resolution: '720p' }).map(([key, value]) => ({ ...f.task.submission, [key]: value }))]) {
    f.write(other, JSON.stringify([{ task_id: 'task01', shots: [1], status: 'done', submission }]));
    const before = [f.tasks, other].map((file) => readFileSync(join(f.root, file), 'utf8'));
    for (const action of ['gate', 'reserve']) {
      const result = f.cli('video-task-inputs.mjs', [action, '--references-json', ...f.args().slice(0, 6), 'dreamina', '1080p']);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, /series.*profile/i);
    }
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.deepEqual([f.tasks, other].map((file) => readFileSync(join(f.root, file), 'utf8')), before);
  }
});

test('series fixed config mismatches block payment; same profile allows different duration', (t) => {
  const f = fixture(t);
  f.write('story/episodes/ep02/videos/tasks.json', JSON.stringify([
    { task_id: 'task01', shots: [1], status: 'done', submission: f.task.submission, duration: 5 }]));
  for (const [key, value] of [['视频提供方', 'none'], ['视频提供方', 'other'],
    ['视频模型版本', 'other'], ['视频比例', '9:16'], ['视频分辨率', '720p']]) {
    f.write('config.md', `- mode: series\n- ${key}: ${value}\n`); f.evidence();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    assert.equal(f.run().status, 1, key);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
  f.write('config.md', '- mode: series\n'); f.evidence();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readFileSync(f.calls, 'utf8').split('\0').includes('--duration=10'));
});

test('short fixed output conflicts block initial and retry gates without rewriting snapshots', (t) => {
  const f = fixture(t);
  f.task.retry_authorization = { decision: 'Retry once unchanged', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 1, attempts: 0 };
  for (const status of ['pending', 'failed']) {
    f.task.status = status; f.save();
    for (const [key, value] of [['视频比例', '9:16'], ['视频分辨率', '720p']]) {
      f.write('config.md', `- mode: short\n- ${key}: ${value}\n`); f.evidence();
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      for (const action of ['gate', 'reserve']) {
        const result = f.cli('video-task-inputs.mjs', [action, '--references-json', ...f.args().slice(0, 6), 'dreamina', '1080p']);
        assert.equal(result.status, 1, `${status} ${key}: ${result.stderr}`);
        assert.match(result.stderr, /fixed config/);
      }
      assert.equal(f.run().status, 1);
      assert.equal(existsSync(f.calls), false);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    }
  }
});

test('partial submission rejects conflicting or unknown episode profiles before side effects', (t) => {
  const f = fixture(t);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry once', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 1, attempts: 0 };
  for (const status of ['pending', 'submitted', 'done', 'failed']) {
    for (const submission of [{ ...f.task.submission, resolution: '720p' },
      { ...f.task.submission, ratio: '9:16' }, undefined]) {
      if (!submission && status === 'pending') continue;
      f.write(f.tasks, JSON.stringify([f.task, { task_id: 'task02', shots: [2], status, submission }]));
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      const args = [...f.args().slice(0, 6), 'dreamina', f.task.submission.resolution];
      for (const action of ['gate', 'reserve']) {
        const result = f.cli('video-task-inputs.mjs', [action, '--references-json', ...args]);
        assert.equal(result.status, 1, `${action} ${status}: ${result.stderr}`);
        assert.match(result.stderr, /episode output profile/i);
      }
      assert.equal(f.run().status, 1);
      assert.equal(existsSync(f.calls), false);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
      assert.equal(existsSync(join(f.root, `${f.tasks}.submit-lock`)), false);
    }
  }
});

test('same episode output profile allows different models and preserves other tasks', (t) => {
  const f = fixture(t);
  const others = ['pending', 'submitted', 'done', 'failed'].map((status, i) => ({
    task_id: `task0${i + 2}`, shots: [i + 2], status, submission: { provider: 'another-provider', model: 'other-model',
      ratio: '16:9', resolution: '1080p' },
  }));
  f.write(f.tasks, JSON.stringify([f.task, ...others]));
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(f.calls), true);
  assert.deepEqual(JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8')).slice(1), others);
});

test('query remains available for unknown or inconsistent episode output profiles', (t) => {
  const f = fixture(t);
  f.write('config.md', '- mode: series\n- 视频提供方: none\n');
  f.write('story/episodes/ep02/videos/tasks.json', JSON.stringify([{ task_id: 'task01', shots: [1], status: 'failed' }]));
  f.task.status = 'submitted'; f.task.submit_id = 'job-1';
  delete f.task.submission;
  f.write(f.tasks, JSON.stringify([f.task, { task_id: 'task02', shots: [2], status: 'done',
    submission: { ratio: '9:16', resolution: '720p' } }]));
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const result = spawnSync('bash', [join(process.cwd(), 'scripts/video-check-dreamina.sh'),
    'job-1', f.output], { cwd: f.root, encoding: 'utf8',
    env: { ...process.env, PATH: `${f.root}:${process.env.PATH}`, CALLS: f.calls,
      RESPONSE: '{"gen_status":"querying"}' } });
  assert.equal(result.status, 1);
  assert.equal(result.stdout.trim(), 'querying');
  assert.equal(readFileSync(f.calls, 'utf8').split('\0')[0], 'query_result');
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});

test('exact arguments and snapshot provider/resolution reject before provider', (t) => {
  const f = fixture(t);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  for (const args of [f.args().slice(0, -1), [...f.args(), '--extra'],
    [...f.args().slice(0, -1), '720p']]) {
    assert.equal(f.run(args).status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
  f.task.submission.provider = 'other'; f.save();
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
});

test('gate blocks missing/stale review evidence and changed PNG before provider', (t) => {
  const f = fixture(t);
  const blocked = () => {
    const result = f.run();
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /^FAIL /);
    assert.equal(existsSync(f.calls), false);
    assert.equal(JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0].inflight, undefined);
  };
  for (const kind of ['script', 'storyboard', 'asset-visual', 'shot-input']) {
    rmSync(join(f.root, f.reviews[kind][0]));
    blocked();
    f.evidence();
  }
  f.write('config.md', '- mode: short\n- 视频比例: 16:9\n- 语言: en\n');
  blocked();
  f.evidence();
  f.write(f.video, 'changed video');
  f.evidence();
  blocked();
});

test('source dialogue changes require fresh evidence even when the authored prompt is unchanged', (t) => {
  const f = fixture(t);
  const board = 'story/episodes/ep01/storyboard.md';
  f.write(board, readFileSync(join(f.root, board), 'utf8').replace('Action', 'She says "Stay."'));
  const resolved = f.cli('storyboard-to-prompt.mjs', ['--json', board, 'task01', 'ep01']);
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(JSON.parse(resolved.stdout).prompt, f.task.prompt);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Current scoped material review required/);
  assert.equal(existsSync(f.calls), false);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});

for (const change of ['duration', 'images']) test(`renewed reviews cannot authorize stale task ${change}`, (t) => {
  const f = fixture(t);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry twice unchanged', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 2, attempts: 0 };
  f.save();
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const board = 'story/episodes/ep01/storyboard.md';
  let text = readFileSync(join(f.root, board), 'utf8');
  if (change === 'duration') text = text.replace('10s', '11s');
  if (change === 'images') text = text.replace('[lamp](assets/items/lamp.md)', 'none');
  f.write(board, text);
  f.evidence();
  assert.equal(f.cli('review-evidence.mjs', ['check', 'ep01', '1']).status, 0);
  assert.equal(f.cli('video-task-inputs.mjs', ['verify', f.tasks, 'task01']).status, 0);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /authorized preparation/);
  assert.equal(existsSync(f.calls), false);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});

test('Creator authored final prompt is forwarded verbatim to the mocked provider', (t) => {
  const f = fixture(t);
  const board = 'story/episodes/ep01/storyboard.md';
  const authored = '  Creator final: {图片1} identity; {视频1} motion.\r\n' +
    '[0s-10s] 灯亮起。 "Stay."  $5 \'hold\' `frame` \\ literal\n\tKeep this spacing.  \n\n';
  writePrompt(f, authored);
  const converted = f.cli('storyboard-to-prompt.mjs', ['--json', board, 'task01', 'ep01']);
  assert.equal(converted.status, 0, converted.stderr);
  assert.equal(JSON.parse(converted.stdout).prompt, authored);
  f.task.prompt = authored;
  f.save(); f.evidence();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const args = readFileSync(f.calls, 'utf8').split('\0').slice(0, -1);
  assert.deepEqual(args, ['multimodal2video', ...f.task.references.flatMap(r => [`--${r.media}`, r.path]),
    `--prompt=${authored}`, '--duration=10', '--ratio=16:9', '--video_resolution=1080p',
    '--model_version=stored-model']);
});

for (const drift of ['manifest', 'task', 'argument']) test(`${drift} prompt drift blocks pending and failed submissions without mutation`, (t) => {
  const f = fixture(t);
  const revised = f.task.prompt + '\nCreator revision.  ';
  if (drift === 'manifest') {
    writePrompt(f, revised);
    f.evidence(); // Fresh review cannot refresh the prepared task's prompt snapshot.
    assert.equal(f.cli('review-evidence.mjs', ['check', 'ep01', '1']).status, 0);
  }
  if (drift === 'task') f.task.prompt = revised;
  f.task.retry_authorization = { decision: 'Retry unchanged', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 2, attempts: 0 };
  for (const status of ['pending', 'failed']) {
    f.task.status = status;
    f.save();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    const args = f.args();
    if (drift === 'argument') args[0] = revised;
    for (const action of ['gate', 'reserve']) {
      const result = f.cli('video-task-inputs.mjs',
        [action, '--references-json', ...args.slice(0, 6), 'dreamina', args[6]]);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, drift === 'argument' ? /Arguments do not match/ : /authorized preparation/);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    }
    const result = f.run(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, drift === 'argument' ? /Arguments do not match/ : /authorized preparation/);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    assert.equal(existsSync(join(f.root, `${f.tasks}.submit-lock`)), false);
  }
});

test('missing or blank final manifest prompt blocks payment without consuming grants', (t) => {
  const f = fixture(t);
  f.task.retry_authorization = { decision: 'Retry unchanged', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 2, attempts: 1 };
  for (const prompt of [undefined, '', ' \t\r\n']) {
    writePrompt(f, prompt);
    for (const status of ['pending', 'failed']) {
      f.task.status = status; f.save();
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      const result = f.run();
      assert.equal(result.status, 1);
      assert.match(result.stderr, /nonblank prompt string/);
      assert.equal(existsSync(f.calls), false);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
      assert.equal(existsSync(join(f.root, `${f.tasks}.submit-lock`)), false);
    }
  }
});

for (const withRetry of [false, true]) test(`batch resumes untouched pending as initial, retry grant=${withRetry}`, (t) => {
  const f = fixture(t, 1, 3);
  const tasks = [f.task, ...[2, 3].map((shot) => ({ ...structuredClone(f.task), task_id: `task0${shot}`, shots: [shot],
    initial_authorization: shot === 2 ? { ...f.task.initial_authorization, task_id: `task0${shot}`, shots: [shot] } : undefined }))];
  for (const task of tasks) {
    task.prompt = JSON.parse(f.cli('storyboard-to-prompt.mjs', ['story/episodes/ep01/storyboard.md',
      task.task_id, 'ep01']).stdout).prompt;
    if (withRetry) task.retry_authorization = { decision: 'Retry twice', episode: 'ep01', task_id: task.task_id, shots: task.shots,
      constraints: [], max_attempts: 2, attempts: 0 };
  }
  f.write(f.tasks, JSON.stringify(tasks));
  assert.equal(f.run(undefined, '{"gen_status":"fail","fail_reason":"ExceedConcurrencyLimit"}').status, 1);
  const state = () => JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'));
  assert.equal(state()[0].status, 'failed');
  assert.deepEqual(state().slice(1), JSON.parse(JSON.stringify(tasks.slice(1))));
  for (const shot of [2, 3]) {
    const task = tasks[shot - 1];
    const result = f.run([task.prompt, f.output.replace('task01', `task0${shot}`), JSON.stringify(task.references),
      '10', task.submission.ratio, task.submission.model, task.submission.resolution]);
    assert.equal(result.status, shot === 2 ? 0 : 1, result.stderr);
    assert.equal(existsSync(f.calls), shot === 2);
  }
  assert.deepEqual(state().map((task) => task.status), ['failed', 'submitted', 'pending']);
  if (withRetry) assert.ok(state().every((task) => task.retry_authorization.attempts === 0));
});

test('gate rejects unregistered outputs, protected tasks and mismatched arguments', (t) => {
  const f = fixture(t);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  for (const [index, value] of [[0, 'other prompt'], [1, f.output.replace('task01', 'task02')],
    [1, './' + f.output], [1, f.output.replace('task01', 'task1')],
    [2, JSON.stringify([...f.task.references].reverse())], [3, '11'], [4, '9:16'], [5, 'new-model']]) {
    const args = f.args(); args[index] = value;
    assert.equal(f.run(args).status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
  for (const status of ['pending', 'submitted', 'done']) {
    f.task.status = status; f.task.submit_id = 'historical-id'; f.save();
    const protectedRecord = readFileSync(join(f.root, f.tasks), 'utf8');
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), protectedRecord);
  }
  f.task.status = 'failed'; delete f.task.submission; f.save();
  assert.equal(f.run([f.task.prompt, f.output, JSON.stringify(f.task.references), '10', '16:9', 'stored-model', '1080p']).status, 1);
  assert.equal(existsSync(f.calls), false);
});

test('retry after unrelated config change forwards stored settings and ordered images unchanged', (t) => {
  const f = fixture(t, 10);
  f.task.prompt = 'Creator final: first line says "go"  \n\tsecond line costs $5\n\n';
  writePrompt(f, f.task.prompt);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry ep01 shot 1 unchanged on temporary failure',
    episode: 'ep01', task_id: 'task01', shots: [1], constraints: [] };
  f.save();
  f.write('config.md', '- mode: short\n- 视频比例: 16:9\n- 视频分辨率: 1080p\n- 语言: en\n');
  f.evidence();
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, 'SUBMITTED job-1\n');
  const args = readFileSync(f.calls, 'utf8').split('\0').slice(0, -1);
  assert.deepEqual(args, ['multimodal2video', ...f.task.references.flatMap((r) => [`--${r.media}`, r.path]),
    `--prompt=${f.task.prompt}`, '--duration=10', '--ratio=16:9', '--video_resolution=1080p',
    '--model_version=stored-model']);
  f.save(); // Independent registered failure response case.
  const failed = f.run(undefined, '{"gen_status":"fail","fail_reason":"provider rejected \\"input\\""}');
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, 'FAIL provider rejected "input"\n');
});

test('final prompt equality does not normalize whitespace', (t) => {
  const f = fixture(t);
  for (const suffix of [' ', '\n', '\n\n']) {
    const original = f.task.prompt;
    f.task.prompt += suffix; f.save();
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    f.task.prompt = original;
  }
  f.save();
  assert.equal(f.run().status, 0);
  const args = readFileSync(f.calls, 'utf8').split('\0');
  assert.ok(args.includes(`--prompt=${f.task.prompt}`));
});

test('failed task needs a persisted unexhausted retry grant before any provider call', (t) => {
  const f = fixture(t);
  f.task.status = 'failed'; f.save();
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
  f.task.retry_authorization = { decision: 'Retry once unchanged', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 1, attempts: 1 };
  f.save();
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
  f.task.retry_authorization.attempts = 0; f.save();
  assert.equal(f.run().status, 0);
});

test('provider-side crash leaves a durable retry reservation and blocks resume', (t) => {
  const f = fixture(t);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry at most twice', episode: 'ep01', task_id: 'task01', shots: [1],
    constraints: [], max_attempts: 2, attempts: 0 };
  f.save();
  writeFileSync(join(f.root, 'dreamina'), `#!/usr/bin/env bash
cp story/episodes/ep01/videos/tasks.json "$CALLS"
kill -KILL "$PPID"
`, { mode: 0o755 });
  f.run();
  const observed = JSON.parse(readFileSync(f.calls, 'utf8'))[0];
  assert.equal(observed.retry_authorization.attempts, 1);
  assert.equal(observed.inflight.kind, 'retry');
  assert.ok(observed.inflight.token);
  assert.equal(observed.status, 'failed');
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
  const stored = JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0];
  assert.deepEqual(stored, observed);
  assert.deepEqual(Object.keys(stored.inflight).sort(), ['kind', 'reserved_at', 'token']);
  assert.ok(!Number.isNaN(Date.parse(stored.inflight.reserved_at)));
  const settle = (token) => f.cli('video-task-inputs.mjs',
    ['settle', f.output, token, 'submitted', 'recovered-id']);
  assert.equal(settle('wrong-token').status, 1);
  assert.equal(settle(stored.inflight.token).status, 0);
  const recovered = JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0];
  assert.equal(recovered.status, 'submitted');
  assert.equal(recovered.submit_id, 'recovered-id');
  assert.equal(recovered.retry_authorization.attempts, 1);
  assert.equal(recovered.inflight, undefined);
});

test('wrapper persists known outcomes and preserves unknown outcomes for reconciliation', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  const state = () => JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0];
  assert.equal(state().status, 'submitted');
  assert.equal(state().submit_id, 'job-1');
  assert.equal(state().inflight, undefined);
  f.save();
  assert.equal(f.run(undefined, 'connection lost').status, 1);
  assert.equal(state().status, 'pending');
  assert.equal(state().inflight.kind, 'initial');
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
});

test('reservation write failure never calls provider', (t) => {
  const f = fixture(t);
  f.write(`${f.tasks}.submit-lock`, 'unreconciled writer');
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
  const state = JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0];
  assert.equal(state.inflight, undefined);
  assert.equal(state.status, 'pending');
});

test('CLI error after acceptance retains an id; error without id retains intent', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'dreamina'), `#!/usr/bin/env bash
printf '%s\\n' "$RESPONSE"
exit 7
`, { mode: 0o755 });
  assert.equal(f.run().stdout, 'SUBMITTED job-1\n');
  const state = () => JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'))[0];
  assert.equal(state().submit_id, 'job-1');
  f.save();
  assert.equal(f.run(undefined, 'network error').stdout, 'FAIL submission_unknown\n');
  assert.equal(state().inflight.kind, 'initial');
});
