import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { videoProject } from './fixtures/video-project.js';

const scripts = join(process.cwd(), 'scripts');
const ep = 'story/episodes/ep01';
const input = `${ep}/shot-inputs/shot01.json`, board = `${ep}/storyboard.md`;
const local = (media, file) => ({ kind: 'local', media, path: `references/${file}`,
  use: 'Motion and composition control', sources: ['references/scene.blend'] });
const mixed = [local('video', 'motion.mp4'), local('image', 'layout, draft.png'), local('video', 'camera.mp4')];

test('persisted typed snapshots reject media, order and path drift', t => {
  const f = fixture(t), original = structuredClone(f.task.references);
  f.write('references/other.mp4', 'video');
  for (const references of [[...original].reverse(),
    original.map((r, i) => i === 1 ? { ...r, media: 'image' } : r),
    original.map((r, i) => i === 1 ? { ...r, path: 'references/other.mp4' } : r)]) {
    f.task.references = references; f.save();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    assert.equal(f.cli('video-task-inputs.mjs', ['verify', f.tasks, '1']).status, 1);
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
});

test('readiness rejects GIF, type mismatch, noncanonical paths and symlink escapes', t => {
  const f = fixture(t);
  for (const refs of [[local('image', 'animated.gif')], [local('image', 'motion.mp4')],
    [local('image', '../outside.png')], [local('image', './layout, draft.png')],
    [{ ...mixed[0], sources: [] }], [mixed[0], mixed[0]]]) {
    f.write(input, JSON.stringify({ references: refs }));
    assert.equal(f.convert().status, 1);
  }
  f.write(input, JSON.stringify({ references: mixed }));
  for (const file of [input, 'assets/items/lamp.md', f.image, mixed[0].path, 'references/scene.blend']) {
    const old = readFileSync(join(f.root, file));
    rmSync(join(f.root, file)); symlinkSync(join(scripts, 'shot-inputs.mjs'), join(f.root, file));
    assert.equal(f.convert().status, 1, file);
    assert.equal(f.run().status, 1, file);
    assert.equal(existsSync(f.calls), false);
    rmSync(join(f.root, file)); f.write(file, old);
  }
});

test('full shot whitespace survives without identity images while MP4 remains mandatory', t => {
  const f = fixture(t);
  const block = '### shot 1\n- 时长：10s\n- 引用资产：无\n- 自定义：keep  \n\n' +
    '**画面与声音描述：**\n[0s-10s] Sound and motion.  \n\tDialogue: "Stay."  ';
  f.write(board, `# Metadata\n${block}\n\n## Next scene\nExcluded\n`);
  const resolved = JSON.parse(f.convert().stdout);
  assert.equal(resolved.prompt.split('\n').slice(4).join('\n'), block);
  assert.deepEqual(resolved.references, mixed.map(({ media, path }) => ({ media, path })));
});

test('source, media and manifest drift block before retry counter changes', t => {
  const f = fixture(t);
  f.task.status = 'failed';
  f.task.retry_authorization = { decision: 'Retry once', episode: 'ep01', shot: 1,
    constraints: [], max_attempts: 1, attempts: 0 }; f.save();
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  for (const file of ['references/scene.blend', mixed[0].path, mixed[1].path, input]) {
    const old = readFileSync(join(f.root, file));
    f.write(file, file === input ? JSON.stringify({ references: [...mixed].reverse() }) : 'changed');
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
    f.write(file, old);
  }
  for (const refs of [[...f.task.references].reverse(), f.task.references.slice(1),
    f.task.references.map((r, i) => i === 1 ? { ...r, media: 'image' } : r)]) {
    const args = f.args(); args[2] = JSON.stringify(refs);
    assert.equal(f.run(args).status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
  f.task.submission.references = f.task.submission.references.map(r => ({ sha256: r.sha256, path: r.path, media: r.media }));
  f.save();
  assert.equal(f.run().status, 0);
  assert.equal(JSON.parse(readFileSync(join(f.root, f.tasks)))[0].retry_authorization.attempts, 1);
});

test('missing, empty, image-only and unsupported references reject before mutation', t => {
  const f = fixture(t);
  const valid = structuredClone(f.task);
  const unsupported = { media: 'image', path: 'assets/images/other/lamp.png' };
  f.write(unsupported.path, 'PNG');
  for (const change of [{ references: [] }, { references: [{ media: 'image', path: f.image }] },
    { references: [unsupported, ...valid.references] }, { references: undefined }]) {
    Object.assign(f.task, valid, change); f.save();
    const before = readFileSync(join(f.root, f.tasks), 'utf8');
    assert.equal(f.capture().status, 1);
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
    assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
  }
  Object.assign(f.task, valid); f.save();
  const args = f.args();
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  assert.equal(f.run(args, undefined, false).status, 1);
  args[2] = f.task.references.map(r => r.path).join(',');
  assert.equal(f.run(args).status, 1);
  for (const action of ['gate', 'reserve']) {
    const values = f.args(); values.splice(6, 0, 'dreamina');
    assert.equal(f.cli('video-task-inputs.mjs', [action, ...values]).status, 1);
  }
  assert.equal(existsSync(f.calls), false);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});

test('resolver requires local MP4 manifest and rejects invalid declarations', t => {
  const f = fixture(t);
  for (const references of [[], [mixed[1]], 'a.png,b.png',
    [mixed[0], { ...mixed[1], kind: 'unknown' }]]) {
    f.write(input, JSON.stringify({ references }));
    assert.equal(f.convert().status, 1);
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(f.calls), false);
  }
  rmSync(join(f.root, input));
  assert.equal(f.convert().status, 1);
  for (const manifest of [null, [], { references: mixed, unexpected: true }]) {
    f.write(input, JSON.stringify(manifest));
    assert.equal(f.convert().status, 1);
  }
  assert.equal(f.cli('storyboard-to-prompt.mjs', ['--unknown', board, '1', 'ep01']).status, 1);
});

function fixture(t, shots = 1) {
  const f = videoProject(t, 1, shots);
  for (const ref of mixed) f.write(ref.path, ref.media);
  f.write(input, JSON.stringify({ references: mixed }));
  const convert = () => f.cli('storyboard-to-prompt.mjs', ['--json', board, '1', 'ep01']);
  const { prompt, duration, references } = JSON.parse(convert().stdout);
  Object.assign(f.task, { prompt, duration, references });
  f.task.initial_authorization = { decision: 'Submit shot 1', episode: 'ep01', shot: 1, constraints: [] };
  f.save();
  const capture = () => f.cli('video-task-inputs.mjs', ['capture', f.tasks, '1', 'dreamina', 'model', '16:9', '1080p']);
  f.task.submission = JSON.parse(capture().stdout); f.save(); f.evidence();
  const calls = join(f.root, 'calls');
  writeFileSync(join(f.root, 'dreamina'), '#!/usr/bin/env bash\nprintf "%s\\0" "$@" > "$CALLS"\nprintf "%s" "$RESPONSE"\n', { mode: 0o755 });
  const args = () => [f.task.prompt, f.output, JSON.stringify(f.task.references), '10', '16:9', 'model', '1080p'];
  const run = (values = args(), response = '{"submit_id":"mixed-job"}', typed = true) => {
    rmSync(calls, { force: true });
    return spawnSync('bash', [join(scripts, 'video-gen-dreamina.sh'),
      ...(typed ? ['--references-json'] : []), ...values], {
      cwd: f.root, encoding: 'utf8', env: { ...process.env, SVD_CONFIG: 'config.md',
        PATH: `${f.root}:${process.env.PATH}`, CALLS: calls, RESPONSE: response },
    });
  };
  return { ...f, convert, capture, args, run, calls };
}

test('mixed MP4/PNG forwarding preserves all provider flags and snapshot order', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(f.calls, 'utf8').split('\0').slice(0, -1), ['multimodal2video',
    ...f.task.references.flatMap(r => [`--${r.media}`, r.path]), `--prompt=${f.task.prompt}`,
    '--duration=10', '--ratio=16:9', '--video_resolution=1080p', '--model_version=model']);
  assert.match(f.task.prompt, /lamp:\{图片1\}/);
  assert.match(f.task.prompt, /LOCAL_REFERENCE:\{图片2\}/);
  assert.match(f.task.prompt, /LOCAL_REFERENCE:\{视频2\}/);
  assert.deepEqual(Object.keys(JSON.parse(f.convert().stdout)).sort(),
    ['assetCards', 'duration', 'inputPath', 'prompt', 'references', 'sources']);
  assert.deepEqual(Object.keys(f.task.submission).sort(),
    ['model', 'provider', 'ratio', 'references', 'resolution']);
  for (const ref of f.task.submission.references) {
    assert.deepEqual(Object.keys(ref).sort(), ['media', 'path', 'sha256']);
  }
});
