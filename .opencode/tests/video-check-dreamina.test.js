import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { videoRetrieval } from './fixtures/video-retrieval.js';

const script = join(process.cwd(), 'scripts/video-check-dreamina.sh');

test('current submitted task retrieves without config or production files', t => {
  const f = videoRetrieval(t);
  const before = readFileSync(join(f.root, f.tasks), 'utf8');
  for (const file of ['config.md', 'assets', 'references', 'story/episodes/ep01/shot-inputs',
    'story/episodes/ep01/script.md', 'story/episodes/ep01/storyboard.md']) {
    rmSync(join(f.root, file), { recursive: true, force: true });
  }
  writeFileSync(join(f.root, 'dreamina'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> calls
for arg in "$@"; do case "$arg" in --download_dir=*) dir="\${arg#*=}";; esac; done
printf video > "$dir/job-1_video.mp4"
printf '%s' '{"gen_status":"success"}'
`, { mode: 0o755 });
  const task = JSON.parse(before)[0];
  const result = spawnSync('bash', [script, task.submit_id, f.output], { cwd: f.root, encoding: 'utf8',
    env: { ...process.env, PATH: `${f.root}:${process.env.PATH}` } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(f.root, f.output), 'utf8'), 'video');
  assert.match(readFileSync(join(f.root, 'calls'), 'utf8'), /^query_result --submit_id=job-1 /);
  assert.equal(readFileSync(join(f.root, f.tasks), 'utf8'), before);
});
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'svd-video-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'dreamina'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALLS"
for arg in "$@"; do
  case "$arg" in --download_dir=*) dir="\${arg#*=}";; esac
done
if [ "$DOWNLOAD" = yes ]; then printf video > "$dir/job-1_video.mp4"; fi
printf '%s\\n' "$RESPONSE"
exit "$CLI_EXIT"
`, { mode: 0o755 });
  writeFileSync(join(root, 'sleep'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const output = join(root, 'shot01.mp4');
  writeFileSync(output, 'old job');
  const run = (response, download = 'no', code = '0', destination = output) =>
    spawnSync('bash', [script, 'job-1', destination], { cwd: root, encoding: 'utf8',
      env: { ...process.env, PATH: `${root}:${process.env.PATH}`, RESPONSE: response,
        DOWNLOAD: download, CLI_EXIT: code, CALLS: join(root, 'calls'),
        SVD_CONFIG: '/unsupported-external-config/config.md' } });
  return { root, output, run };
}

test('querying is normal exit 1; CLI and retrieval errors are nonterminal', (t) => {
  const f = fixture(t);
  for (const [response, download, code, expected, status] of [
    ['{"gen_status":"querying"}', 'no', '0', 'querying', 1],
    ['', 'no', '7', 'error:cli_failed', 2],
    ['{"gen_status":"success"}', 'yes', '7', 'error:cli_failed', 2],
    ['', 'no', '0', 'error:invalid_status', 2],
    ['{"gen_status":"success"}', 'no', '0', 'error:download_empty', 2],
    ['{"gen_status":"fail","fail_reason":"rejected"}', 'no', '0', 'fail:rejected', 0],
  ]) {
    const result = f.run(response, download, code);
    assert.equal(result.stdout.trim(), expected);
    assert.equal(result.status, status);
    assert.equal(readFileSync(f.output, 'utf8'), 'old job');
  }
});

test('failed move can retry download for the same id without generation', (t) => {
  const f = fixture(t);
  const failed = f.run('{"gen_status":"success"}', 'yes', '0', join(f.root, 'missing/shot.mp4'));
  assert.equal(failed.stdout.trim(), 'error:move_failed');
  assert.equal(failed.status, 2);
  const retry = f.run('{"gen_status":"success"}', 'yes');
  assert.equal(retry.stdout.trim(), 'success');
  assert.equal(retry.status, 0);
  assert.equal(readFileSync(f.output, 'utf8'), 'video');
  const calls = readFileSync(join(f.root, 'calls'), 'utf8').trim().split('\n');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.startsWith('query_result --submit_id=job-1 ')));
});

test('missing download retries retrieval without trusting an old MP4', (t) => {
  const f = fixture(t);
  const missing = f.run('{"gen_status":"success"}');
  assert.equal(missing.status, 2);
  assert.equal(missing.stdout.trim(), 'error:download_empty');
  assert.equal(readFileSync(f.output, 'utf8'), 'old job');
  assert.equal(f.run('{"gen_status":"success"}', 'yes').status, 0);
  assert.equal(readFileSync(f.output, 'utf8'), 'video');
  assert.ok(readFileSync(join(f.root, 'calls'), 'utf8').trim().split('\n')
    .every((call) => call.startsWith('query_result --submit_id=job-1 ')));
});
