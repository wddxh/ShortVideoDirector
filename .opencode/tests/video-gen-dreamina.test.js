import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { videoProject } from './fixtures/video-project.js';

const script = join(process.cwd(), 'scripts/video-gen-dreamina.sh');
function fixture(t, references = 1, shots = 1) {
  const f = videoProject(t, references, shots);
  f.task.submission = { provider: 'dreamina', resolution: '1080p', model: 'stored-model', ratio: '16:9', images: JSON.parse(
    f.cli('review-evidence.mjs', ['fingerprint', ...f.task.images.split(',')]).stdout) };
  f.task.initial_authorization = { decision: 'Submit ep01 shot 1 once', episode: 'ep01',
    shot: 1, constraints: [] };
  f.save();
  const calls = join(f.root, 'calls');
  writeFileSync(join(f.root, 'dreamina'), `#!/usr/bin/env bash
printf '%s\\0' "$@" > "$CALLS"
printf '%s\\n' "$RESPONSE"
`, { mode: 0o755 });
  const args = () => [f.task.prompt, f.output, f.task.images, String(f.task.duration),
    f.task.submission.ratio, f.task.submission.model, f.task.submission.resolution];
  const run = (values = args(), response = '{"gen_status":"querying","submit_id":"job-1"}') => {
    rmSync(calls, { force: true });
    return spawnSync('bash', [script, ...values], { cwd: f.root, encoding: 'utf8',
      env: { ...process.env, SVD_CONFIG: 'config.md', PATH: `${f.root}:${process.env.PATH}`,
        CALLS: calls, RESPONSE: response } });
  };
  return { ...f, args, run, calls };
}

test('series rechecks cross-episode conflicts at gate/reserve with zero mutation or payment', (t) => {
  const f = fixture(t);
  f.write('config.md', '- mode: series\n'); f.evidence();
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry once', episode: 'ep01', shot: 1,
    constraints: [], max_attempts: 1, attempts: 0 };
  f.save();
  const other = 'story/episodes/ep02/videos/tasks.json';
  for (const submission of [undefined, ...Object.entries({ provider: 'other', model: 'other',
    ratio: '9:16', resolution: '720p' }).map(([key, value]) => ({ ...f.task.submission, [key]: value }))]) {
    f.write(other, JSON.stringify([{ shot: 1, status: 'done', submission }]));
    const before = [f.tasks, other].map((file) => readFileSync(join(f.root, file), 'utf8'));
    for (const action of ['gate', 'reserve']) {
      const result = f.cli('video-task-inputs.mjs', [action, ...f.args().slice(0, 6), 'dreamina', '1080p']);
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
    { shot: 1, status: 'done', submission: f.task.submission, duration: 5 }]));
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
  f.task.retry_authorization = { decision: 'Retry once unchanged', episode: 'ep01', shot: 1,
    constraints: [], max_attempts: 1, attempts: 0 };
  for (const status of ['pending', 'failed']) {
    f.task.status = status; f.save();
    for (const [key, value] of [['视频比例', '9:16'], ['视频分辨率', '720p']]) {
      f.write('config.md', `- mode: short\n- ${key}: ${value}\n`); f.evidence();
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      for (const action of ['gate', 'reserve']) {
        const result = f.cli('video-task-inputs.mjs', [action, ...f.args().slice(0, 6), 'dreamina', '1080p']);
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
  f.task.retry_authorization = { decision: 'Retry once', episode: 'ep01', shot: 1,
    constraints: [], max_attempts: 1, attempts: 0 };
  for (const status of ['pending', 'submitted', 'done', 'failed']) {
    for (const submission of [{ ...f.task.submission, resolution: '720p' },
      { ...f.task.submission, ratio: '9:16' }, undefined]) {
      if (!submission && status === 'pending') continue;
      f.write(f.tasks, JSON.stringify([f.task, { shot: 2, status, submission }]));
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      const args = [...f.args().slice(0, 6), 'dreamina', f.task.submission.resolution];
      for (const action of ['gate', 'reserve']) {
        const result = f.cli('video-task-inputs.mjs', [action, ...args]);
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
    shot: i + 2, status, submission: { provider: 'another-provider', model: 'other-model',
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
  f.write('story/episodes/ep02/videos/tasks.json', JSON.stringify([{ shot: 1, status: 'failed' }]));
  f.task.status = 'submitted'; f.task.submit_id = 'job-1';
  delete f.task.submission;
  f.write(f.tasks, JSON.stringify([f.task, { shot: 2, status: 'done',
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
  for (const kind of ['script', 'storyboard', 'asset-prompts', 'basic-assets-visual',
    'storyboard-sheet-prompts', 'storyboard-sheets-visual']) {
    rmSync(join(f.root, `story/episodes/ep01/.review-${kind}.md`));
    blocked();
    f.evidence();
  }
  f.write('config.md', '- mode: short\n- 视频比例: 16:9\n- 语言: en\n');
  blocked();
  f.evidence();
  f.write(f.sheet, 'changed sheet');
  f.evidence();
  blocked();
});

for (const change of ['dialogue', 'duration', 'images']) test(`renewed reviews cannot authorize stale converter ${change}`, (t) => {
  const f = fixture(t);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry twice unchanged', episode: 'ep01', shot: 1,
    constraints: [], max_attempts: 2, attempts: 0 };
  f.save();
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const board = 'story/episodes/ep01/storyboard.md';
  let text = readFileSync(join(f.root, board), 'utf8');
  if (change === 'dialogue') text = text.replace('Action', 'She says "the NEW dialogue".');
  if (change === 'duration') text = text.replace('10s', '11s');
  if (change === 'images') text = text.replace('[lamp](assets/items/lamp.md)', 'none');
  f.write(board, text);
  f.evidence();
  assert.equal(f.cli('review-evidence.mjs', ['check', 'ep01', '1']).status, 0);
  assert.equal(f.cli('video-task-inputs.mjs', ['verify', f.tasks, '1']).status, 0);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /authorized preparation/);
  assert.equal(existsSync(f.calls), false);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});

test('current converter passes the gate and forwards the entire bound shot without neighboring metadata', (t) => {
  const f = fixture(t);
  const board = 'story/episodes/ep01/storyboard.md';
  const block = ['### shot 1', '- 镜头类型：近景', '- 镜头运动：固定', '- 视频风格：写实',
    '- 时长：10s', '- 出场人物：无', '- 引用资产：[lamp](assets/items/lamp.md)', '- 转场：淡黑',
    '- 自定义：保持灯光  ', '', '**画面与声音描述：**',
    '[0s-10s] [lamp](assets/items/lamp.md) lights the room.  ',
    '\tVoice: "Stay." Music fades.  '].join('\n');
  f.write(board, `# SOURCE_METADATA\n${block}\n\n## Next scene\nNEXT_BUDGET\n<!-- FOOTER -->\n`);
  const converted = f.cli('storyboard-to-prompt.mjs', [board, '1', 'ep01']);
  assert.equal(converted.status, 0, converted.stderr);
  f.task.prompt = converted.stdout.split('\n---\n')[1].replace(/\n$/, '');
  assert.equal(f.task.prompt.split('\n').slice(3).join('\n'),
    block.replaceAll('[lamp](assets/items/lamp.md)', '[lamp:{图片2}]'));
  f.save(); f.evidence();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readFileSync(f.calls, 'utf8').split('\0').includes(`--prompt=${f.task.prompt}`));
});

for (const format of ['unbound', 'field-selected']) test(`stale ${format} prompts block without refreshing tasks`, (t) => {
  const f = fixture(t);
  const board = readFileSync(join(f.root, 'story/episodes/ep01/storyboard.md'), 'utf8');
  f.task.prompt = f.task.prompt.split('\n\n')[0] + '\n\n' + (format === 'unbound'
    ? board.trimEnd() : board.slice(board.indexOf('**画面与声音描述：**')).trimEnd());
  f.task.retry_authorization = { decision: 'Retry unchanged', episode: 'ep01', shot: 1,
    constraints: [], max_attempts: 2, attempts: 0 };
  for (const status of ['pending', 'failed', 'submitted', 'done']) {
    f.task.status = status;
    f.task.submit_id = ['submitted', 'done'].includes(status) ? 'historical-id' : '';
    f.save();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /authorized preparation|protected/i);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
});

for (const withRetry of [false, true]) test(`batch resumes untouched pending as initial, retry grant=${withRetry}`, (t) => {
  const f = fixture(t, 1, 3);
  const tasks = [f.task, ...[2, 3].map((shot) => ({ ...structuredClone(f.task), shot,
    images: f.task.images.replace('shot01', `shot0${shot}`),
    initial_authorization: shot === 2 ? { ...f.task.initial_authorization, shot } : undefined }))];
  for (const task of tasks) {
    task.prompt = f.cli('storyboard-to-prompt.mjs', ['story/episodes/ep01/storyboard.md',
      String(task.shot), 'ep01']).stdout.split('\n---\n')[1].replace(/\n$/, '');
    task.submission.images = JSON.parse(f.cli('review-evidence.mjs', ['fingerprint', ...task.images.split(',')]).stdout);
    if (withRetry) task.retry_authorization = { decision: 'Retry twice', episode: 'ep01', shot: task.shot,
      constraints: [], max_attempts: 2, attempts: 0 };
  }
  f.write(f.tasks, JSON.stringify(tasks));
  assert.equal(f.run(undefined, '{"gen_status":"fail","fail_reason":"ExceedConcurrencyLimit"}').status, 1);
  const state = () => JSON.parse(readFileSync(join(f.root, f.tasks), 'utf8'));
  assert.equal(state()[0].status, 'failed');
  assert.deepEqual(state().slice(1), JSON.parse(JSON.stringify(tasks.slice(1))));
  for (const shot of [2, 3]) {
    const task = tasks[shot - 1];
    const result = f.run([task.prompt, f.output.replace('shot01', `shot0${shot}`), task.images,
      '10', task.submission.ratio, task.submission.model, task.submission.resolution]);
    assert.equal(result.status, shot === 2 ? 0 : 1, result.stderr);
    assert.equal(existsSync(f.calls), shot === 2);
  }
  assert.deepEqual(state().map((task) => task.status), ['failed', 'submitted', 'pending']);
  if (withRetry) assert.ok(state().every((task) => task.retry_authorization.attempts === 0));
});

test('gate rejects unregistered outputs, protected tasks and mismatched arguments', (t) => {
  const f = fixture(t);
  for (const [index, value] of [[0, 'other prompt'], [1, f.output.replace('shot01', 'shot02')],
    [1, './' + f.output], [1, f.output.replace('shot01', 'shot1')],
    [2, f.task.images.split(',').reverse().join(',')], [3, '11'], [4, '9:16'], [5, 'new-model']]) {
    const args = f.args(); args[index] = value;
    assert.equal(f.run(args).status, 1);
    assert.equal(existsSync(f.calls), false);
  }
  for (const status of ['submitted', 'done']) {
    f.task.status = status; f.save();
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
  }
  f.task.status = 'failed'; delete f.task.submission; f.save();
  assert.equal(f.run([f.task.prompt, f.output, f.task.images, '10', '16:9', 'stored-model', '1080p']).status, 1);
  assert.equal(existsSync(f.calls), false);
});

test('retry after unrelated config change forwards stored settings and ordered images unchanged', (t) => {
  const f = fixture(t, 10);
  const board = 'story/episodes/ep01/storyboard.md';
  f.write(board, readFileSync(join(f.root, board), 'utf8').replace('Action',
    'first line says "go"  \n\tsecond line costs $5'));
  f.task.prompt = f.cli('storyboard-to-prompt.mjs', [board, '1', 'ep01'])
    .stdout.split('\n---\n')[1].replace(/\n$/, '');
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry ep01 shot 1 unchanged on temporary failure',
    episode: 'ep01', shot: 1, constraints: [] };
  f.save();
  f.write('config.md', '- mode: short\n- 视频比例: 16:9\n- 视频分辨率: 1080p\n- 语言: en\n');
  f.evidence();
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, 'SUBMITTED job-1\n');
  const args = readFileSync(f.calls, 'utf8').split('\0').slice(0, -1);
  assert.deepEqual(args, ['multimodal2video', ...f.task.images.split(',').flatMap((p) => ['--image', p]),
    `--prompt=${f.task.prompt}`, '--duration=10', '--ratio=16:9', '--video_resolution=1080p',
    '--model_version=stored-model']);
  f.save(); // Independent registered failure response case.
  const failed = f.run(undefined, '{"gen_status":"fail","fail_reason":"provider rejected \\"input\\""}');
  assert.equal(failed.status, 1);
  assert.equal(failed.stdout, 'FAIL provider rejected "input"\n');
});

test('converter prompt accepts its terminal newline but does not normalize other whitespace', (t) => {
  const f = fixture(t);
  for (const suffix of [' ', '\n\n']) {
    const original = f.task.prompt;
    f.task.prompt += suffix; f.save();
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    f.task.prompt = original;
  }
  f.task.prompt += '\n'; f.save();
  assert.equal(f.run().status, 0);
  const args = readFileSync(f.calls, 'utf8').split('\0');
  assert.ok(args.includes(`--prompt=${f.task.prompt}`));
});

test('failed task needs a persisted unexhausted retry grant before any provider call', (t) => {
  const f = fixture(t);
  f.task.status = 'failed'; f.save();
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(f.calls), false);
  f.task.retry_authorization = { decision: 'Retry once unchanged', episode: 'ep01', shot: 1,
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
  f.task.retry_authorization = { decision: 'Retry at most twice', episode: 'ep01', shot: 1,
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
