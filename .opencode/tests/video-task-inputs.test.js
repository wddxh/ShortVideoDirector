import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { videoProject } from './fixtures/video-project.js';

const seriesProfile = { provider: 'dreamina', model: 'model', ratio: '16:9', resolution: '1080p' };
const historyFile = 'story/episodes/ep02/videos/tasks.json';
const profileCLI = (f) => f.cli('video-task-inputs.mjs', ['profile', f.tasks]);
const captureSeries = (f, profile = seriesProfile) => f.cli('video-task-inputs.mjs',
  ['capture', f.tasks, '1', ...['provider', 'model', 'ratio', 'resolution'].map((key) => profile[key])]);

test('series inherits any existing snapshot including its own, never content or grants', (t) => {
  const f = videoProject(t);
  f.write('config.md', '- mode: series\n');
  const historical = { shot: 1, status: 'done', duration: 5, prompt: 'older story',
    initial_authorization: { decision: 'not inherited' }, submission: seriesProfile };
  f.write(historyFile, JSON.stringify([historical]));
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const result = profileCLI(f);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { mode: 'series', source: 'tasks', profile: seriesProfile });
  assert.equal(captureSeries(f).status, 0);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  f.task.submission = seriesProfile; f.save();
  rmSync(join(f.root, historyFile));
  assert.equal(profileCLI(f).status, 0);
  for (const [key, value] of Object.entries({ provider: 'other', model: 'other', ratio: '9:16', resolution: '720p' })) {
    const changed = { ...seriesProfile, [key]: value };
    assert.equal(captureSeries(f, changed).status, 1, key);
    f.write(historyFile, JSON.stringify([{ ...historical, submission: changed }]));
    assert.equal(profileCLI(f).status, 1, key);
    assert.equal(captureSeries(f).status, 1, key);
    rmSync(join(f.root, historyFile));
  }
});

test('series preflight works before task directories exist and uses explicit config/delegation', (t) => {
  const f = videoProject(t);
  rmSync(join(f.root, 'story/episodes'), { recursive: true });
  f.write('config.md', '- mode: series\n- 视频提供方: dreamina\n- 视频比例: 16:9\n' +
    '## 参数选择授权\n```json\n' + JSON.stringify({ decision: 'Choose model and resolution',
      delegated: { video: ['model', 'resolution'] } }) + '\n```\n');
  const result = profileCLI(f);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { mode: 'series', source: 'config',
    profile: { provider: 'dreamina', model: null, ratio: '16:9', resolution: null } });
  assert.equal(existsSync(join(f.root, 'story/episodes')), false);
  f.write('config.md', '- mode: series\n- 视频提供方: dreamina\n');
  assert.equal(profileCLI(f).status, 1);
});

test('first series capture binds fixed config and requires delegation for every open field', (t) => {
  const f = videoProject(t);
  const fixed = '- mode: series\n- 视频提供方: dreamina\n- 视频模型版本: model\n' +
    '- 视频比例: 16:9\n- 视频分辨率: 1080p\n';
  f.write('config.md', fixed);
  assert.deepEqual(JSON.parse(profileCLI(f).stdout), { mode: 'series', source: 'config', profile: seriesProfile });
  assert.equal(captureSeries(f).status, 0);
  for (const [key, value] of Object.entries({ model: 'other', ratio: '9:16', resolution: '720p' })) {
    assert.equal(captureSeries(f, { ...seriesProfile, [key]: value }).status, 1);
  }
  f.write('config.md', '- mode: series\n- 视频提供方: dreamina\n- 视频比例: 16:9\n');
  assert.equal(captureSeries(f).status, 1);
  f.write('config.md', '- mode: series\n- 视频提供方: dreamina\n- 视频比例: 16:9\n' +
    '## 参数选择授权\n```json\n' + JSON.stringify({ decision: 'Choose video settings',
      delegated: { video: ['model', 'resolution'] } }) + '\n```\n## Other\n');
  assert.equal(captureSeries(f).status, 0);
});

test('series delegated first capture requires resolved settings, not auto or none', (t) => {
  const f = videoProject(t);
  f.write('config.md', '- mode: series\n- 视频提供方: dreamina\n- 视频比例: 16:9\n' +
    '## 参数选择授权\n```json\n' + JSON.stringify({ decision: 'Choose video settings',
      delegated: { video: ['model', 'resolution'] } }) + '\n```\n');
  for (const profile of [{ ...seriesProfile, model: 'auto' },
    { ...seriesProfile, resolution: 'auto' }, { ...seriesProfile, resolution: 'none' }]) {
    assert.equal(captureSeries(f, profile).status, 1);
  }
});

test('series scans all participating states and rejects incomplete historical tuples', (t) => {
  const f = videoProject(t);
  f.write('config.md', '- mode: series\n');
  f.task.submission = seriesProfile; f.save();
  for (const state of [{ status: 'pending' }, { status: 'submitted' }, { status: 'done' },
    { status: 'failed' }, { status: 'pending', submit_id: 'accepted' },
    { status: 'pending', inflight: { token: 'unknown' } }]) {
    for (const missing of [null, 'provider', 'model', 'ratio', 'resolution']) {
      const submission = { ...seriesProfile };
      if (missing) delete submission[missing];
      f.write(historyFile, JSON.stringify([{ shot: 1, ...state, submission }]));
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      assert.equal(profileCLI(f).status, missing ? 1 : 0, `${state.status} ${missing}`);
      assert.equal(captureSeries(f).status, missing ? 1 : 0);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    }
    f.write(historyFile, JSON.stringify([{ shot: 1, ...state }]));
    assert.equal(profileCLI(f).status, state.status === 'pending' && !state.inflight && !state.submit_id ? 0 : 1);
  }
});

test('series uses custom config mode and fixed values, rejects none and unknown mode', (t) => {
  const f = videoProject(t);
  f.task.submission = seriesProfile; f.save();
  const config = 'settings/custom config.md';
  const run = (args) => spawnSync('node', [join(process.cwd(), 'scripts/video-task-inputs.mjs'), ...args],
    { cwd: f.root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: config } });
  for (const [key, value] of [['视频提供方', 'none'], ['视频提供方', 'other'],
    ['视频模型版本', 'other'], ['视频比例', '9:16'], ['视频分辨率', '720p']]) {
    f.write(config, `- mode: series\n- ${key}: ${value}\n`);
    assert.equal(run(['profile', f.tasks]).status, 1, key);
    assert.equal(run(['capture', f.tasks, '1', ...Object.values(seriesProfile)]).status, 1, key);
  }
  f.write(config, '- mode: series\n- 视频提供方: dreamina\n');
  assert.deepEqual(JSON.parse(run(['profile', f.tasks]).stdout),
    { mode: 'series', source: 'tasks', profile: seriesProfile });
  f.write(config, '- mode: unknown\n');
  assert.equal(run(['profile', f.tasks]).status, 1);
  assert.equal(run(['capture', f.tasks, '1', ...Object.values(seriesProfile)]).status, 1);
});

test('capture checks the whole episode profile without rewriting any records', (t) => {
  const f = videoProject(t);
  const settings = { provider: 'dreamina', model: 'other-model', ratio: '16:9', resolution: '1080p' };
  const run = () => f.cli('video-task-inputs.mjs',
    ['capture', f.tasks, '1', 'dreamina', 'model', '16:9', '1080p']);
  // Authorized preparation can replace this pending shot's previous profile.
  f.task.submission = { ...settings, resolution: '720p' };
  for (const status of ['pending', 'submitted', 'done', 'failed']) {
    for (const profile of [settings, { ...settings, resolution: '720p' },
      { ...settings, ratio: '9:16' }, undefined]) {
      const tasks = [f.task, { shot: 2, status, submission: profile }];
      f.write(f.tasks, JSON.stringify(tasks));
      const before = readFileSync(join(f.root, f.tasks), 'utf8');
      const result = run();
      const allowed = profile === settings || (!profile && status === 'pending');
      assert.equal(result.status, allowed ? 0 : 1, `${status}: ${result.stderr}`);
      if (!allowed) assert.match(result.stderr, /episode output profile/i);
      assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    }
  }
});

test('short capture checks fixed output settings from the actual config without mutation', (t) => {
  const f = videoProject(t);
  const config = 'settings/short config.md';
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  for (const [settings, allowed] of [
    ['- 视频比例: 9:16\n', false], ['- 视频分辨率: 720p\n', false],
    ['- 视频比例: 16:9\n- 视频分辨率: 1080p\n', true],
    ['- 语言: en\n', true], ['- 视频比例: auto\n- 视频分辨率: auto\n', true],
  ]) {
    f.write(config, `- mode: short\n${settings}`);
    const result = spawnSync('node', [join(process.cwd(), 'scripts/video-task-inputs.mjs'),
      'capture', f.tasks, '1', 'dreamina', 'model', '16:9', '1080p'],
    { cwd: f.root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: config } });
    assert.equal(result.status, allowed ? 0 : 1, settings + result.stderr);
    if (!allowed) assert.match(result.stderr, /fixed config/);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
});

test('capture rejects an active submit lock without changing tasks', (t) => {
  const f = videoProject(t);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  f.write(`${f.tasks}.submit-lock`, 'active');
  const result = f.cli('video-task-inputs.mjs',
    ['capture', f.tasks, '1', 'dreamina', 'model', '9:16', '1080p']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /lock/i);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});

test('initial grant is independent of retry grant and unresolved intents block preparation', (t) => {
  const f = videoProject(t);
  const grant = { decision: 'Submit this shot once', episode: 'ep01', shot: 1, constraints: [] };
  f.task.retry_authorization = grant; f.save();
  const run = () => f.cli('video-task-inputs.mjs', ['initial', f.tasks, '1', 'ep01']);
  assert.equal(run().status, 1);
  f.task.initial_authorization = grant; f.save();
  assert.deepEqual(JSON.parse(run().stdout), grant);
  f.task.inflight = { token: 'unresolved', kind: 'initial', reserved_at: new Date().toISOString() };
  f.save();
  assert.equal(run().status, 1);
  assert.equal(f.cli('video-task-inputs.mjs', ['retry', f.tasks, '1', 'ep01']).status, 1);
  assert.equal(f.cli('video-task-inputs.mjs', ['capture', f.tasks, '1', 'dreamina', 'model', '16:9', '1080p']).status, 1);
});

test('isolated retry reads the persisted grant and only user-specified limits', (t) => {
  const f = videoProject(t);
  f.task.status = 'failed';
  const grant = { decision: 'Retry this shot on temporary failures without changing inputs.',
    episode: 'ep01', shot: 1, constraints: ['Temporary generation failures only'] };
  f.task.retry_authorization = grant; f.save();
  const run = () => f.cli('video-task-inputs.mjs', ['retry', f.tasks, '1', 'ep01']);
  assert.equal(run().status, 0, run().stderr);
  assert.deepEqual(JSON.parse(run().stdout), grant);
  assert.equal(Object.hasOwn(JSON.parse(run().stdout), 'attempts'), false);
  grant.max_attempts = 2; grant.attempts = 1; f.save();
  assert.equal(run().status, 0);
  grant.attempts = 2; f.save();
  assert.equal(run().status, 1);
});

test('retry rejects missing, out-of-scope or incomplete authorization', (t) => {
  const f = videoProject(t);
  const grant = { decision: 'Retry unchanged inputs', episode: 'ep01', shot: 1, constraints: [] };
  for (const authorization of [undefined, {}, { ...grant, decision: '' },
    { ...grant, episode: 'ep02' }, { ...grant, shot: 2 },
    { ...grant, max_attempts: 2 }, { ...grant, attempts: 0 },
    { ...grant, max_attempts: 2, attempts: -1 }]) {
    f.task.retry_authorization = authorization; f.save();
    assert.equal(f.cli('video-task-inputs.mjs', ['retry', f.tasks, '1', 'ep01']).status, 1);
  }
});

test('capture and verify store settings and ordered image hashes without writing tasks', (t) => {
  const f = videoProject(t);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  const captured = f.cli('video-task-inputs.mjs', ['capture', f.tasks, '1', 'dreamina', 'model-v1', '16:9', '1080p']);
  assert.equal(captured.status, 0, captured.stderr);
  f.task.submission = JSON.parse(captured.stdout);
  assert.deepEqual(Object.keys(f.task.submission).sort(), ['model', 'provider', 'ratio', 'references', 'resolution']);
  assert.equal(f.task.submission.provider, 'dreamina');
  assert.equal(f.task.submission.resolution, '1080p');
  assert.deepEqual(f.task.submission.references.map((i) => i.path), [f.image, f.video]);
  assert.ok(f.task.submission.references.every((i) => /^[a-f0-9]{64}$/.test(i.sha256)));
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  f.save();
  f.write('config.md', '- mode: short\n- 视频比例: 9:16\n');
  // Identity verification is not the capture/payment config gate.
  assert.equal(f.cli('video-task-inputs.mjs', ['verify', f.tasks, '1']).status, 0);
  assert.equal(f.task.submission.ratio, '16:9');
  f.write(f.video, 'changed MP4');
  assert.equal(f.cli('video-task-inputs.mjs', ['verify', f.tasks, '1']).status, 1);
});

test('missing metadata blocks retry and capture cannot refresh failed/submitted/done', (t) => {
  const f = videoProject(t);
  assert.equal(f.cli('video-task-inputs.mjs', ['verify', f.tasks, '1']).status, 1);
  for (const status of ['failed', 'submitted', 'done']) {
    f.task.status = status;
    f.save();
    assert.equal(f.cli('video-task-inputs.mjs', ['capture', f.tasks, '1', 'dreamina', 'model', '16:9', '1080p']).status, 1);
  }
});

test('exported input helpers reject missing settings, reordered paths and changed bytes', async (t) => {
  const f = videoProject(t);
  const api = await import('../../scripts/video-task-inputs.mjs');
  const cwd = process.cwd();
  process.chdir(f.root);
  try {
    assert.throws(() => api.captureInputs(f.task, { model: 'none', ratio: '16:9' }));
    assert.throws(() => api.captureInputs(f.task, { model: 'model' }));
    f.task.submission = api.captureInputs(f.task, { provider: 'dreamina', model: 'model', ratio: '16:9', resolution: '1080p' });
    assert.equal(api.verifyInputs(f.task), true);
    f.task.references.reverse();
    assert.equal(api.verifyInputs(f.task), false);
    f.task.references.reverse();
    f.write(f.image, 'changed image');
    assert.equal(api.verifyInputs(f.task), false);
  } finally { process.chdir(cwd); }
});
