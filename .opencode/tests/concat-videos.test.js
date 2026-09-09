import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { groupedVideo } from './fixtures/grouped-video.js';

const script = join(process.cwd(), 'scripts/concat-videos.sh');
function fixture(t) {
  const f = groupedVideo(t);
  f.write(f.input, JSON.stringify({ ...f.manifest, shots: [3] }));
  f.write(f.input.replace('task01', 'task99'), JSON.stringify({ ...f.manifest, shots: [1, 2] }));
  const tasks = [{ task_id: 'task01', shots: [3], status: 'done' },
    { task_id: 'task99', shots: [1, 2], status: 'done' }];
  f.write(f.tasks, JSON.stringify(tasks));
  for (const id of ['task01', 'task99', 'shot01', 'task50']) f.write(f.output.replace('task01', id), 'video');
  writeFileSync(join(f.root, 'ffmpeg'), `#!/usr/bin/env bash
printf '%s\\n' "$@" > calls
while [ "$#" -gt 0 ]; do
  if [ "$1" = -i ]; then shift; cp "$1" list; fi
  output="$1"; shift
done
printf video > "$output"
`, { mode: 0o755 });
  const run = (...args) => spawnSync('bash', [script, 'ep01', ...args], { cwd: f.root,
    encoding: 'utf8', env: { ...process.env, PATH: `${f.root}:${process.env.PATH}` } });
  return { ...f, records: tasks, run };
}

test('explicit concat follows manifest source order, not task IDs or stray shot files', t => {
  const f = fixture(t), result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const list = readFileSync(join(f.root, 'list'), 'utf8').trim().split('\n');
  assert.equal(list.length, 2);
  assert.ok(list[0].endsWith("/task99.mp4'"));
  assert.ok(list[1].endsWith("/task01.mp4'"));
  assert.equal(f.run().status, 1);
  assert.equal(f.run('--force').status, 0);
});

test('concat requires done records and complete coverage unless gaps explicitly allowed', t => {
  const f = fixture(t);
  for (const status of ['pending', 'submitted', 'failed']) {
    f.records[0].status = status;
    f.write(f.tasks, JSON.stringify(f.records));
    assert.equal(f.run().status, 1);
    assert.equal(existsSync(join(f.root, 'calls')), false);
  }
  assert.equal(f.run('--allow-gaps').status, 0);
  assert.equal(readFileSync(join(f.root, 'list'), 'utf8').trim().split('\n').length, 1);
  f.records[0].status = 'done';
  f.records[0].shots = [2, 3];
  f.write(f.tasks, JSON.stringify(f.records));
  assert.equal(f.run('--allow-gaps', '--force').status, 1);
  f.records[0].shots = [3];
  f.write(f.tasks, JSON.stringify(f.records));
  rmSync(join(f.root, f.output));
  assert.equal(f.run('--force').status, 1);
  f.write(f.output, 'video');
  assert.equal(f.run(f.output, '--force').status, 1);
  f.write(f.input, JSON.stringify({ ...f.manifest, shots: [2, 3] }));
  assert.equal(f.run('--force').status, 1);
});
