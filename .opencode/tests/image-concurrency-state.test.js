import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { parallelImages, job, waitFor } from './fixtures/parallel-images.js';

const args = j => [j.prompt, j.output, j.settings.ratio, j.settings.resolution,
  j.settings.model, j.images.join(','), j.source];

test('stale output claims do not expire and stale pending locks have bounded wait', async t => {
  const f = parallelImages(t), a = job('a');
  f.write(`${a.output}.claim/owner`, 'interrupted');
  f.write(a.output, 'old');
  const result = f.cli('image-gen-dreamina.sh', ['--force', ...args(a)]);
  assert.equal(result.status, 1);
  assert.equal(f.read(a.output), 'old');
  assert.equal(f.exists('calls'), false);
  f.write('assets/images/pending.json', '[]');
  f.write('assets/images/pending.json.lock/owner', 'interrupted');
  const pending = await f.start('image-pending-state.mjs', ['remove', a.output]).result;
  assert.equal(pending.status, 2);
  assert.match(pending.stderr, /lock timeout/);
  assert.equal(f.read('assets/images/pending.json'), '[]');
  assert.equal(f.exists('assets/images/pending.json.lock/owner'), true);
});

test('pending lookup recognizes an absolute alias before force', t => {
  const f = parallelImages(t), a = job('a');
  f.write(a.output, 'old'); f.write('release-a', '');
  f.write('assets/images/pending.json', JSON.stringify([
    { submit_id: 'known', asset_path: a.source, output_path: a.output,
      type: 'basic-asset', ...a.settings }]));
  const result = f.cli('image-gen-dreamina.sh', ['--force',
    ...args({ ...a, output: `${f.root}/${a.output}` })]);
  assert.equal(result.status, 2);
  assert.equal(f.read(a.output), 'old');
  assert.equal(f.exists('calls'), false);
});

test('pending mutations wait for a short transaction and preserve concurrent IDs', async t => {
  const f = parallelImages(t);
  const state = 'assets/images/pending.json';
  f.write(state, JSON.stringify(Array.from({ length: 8 }, (_, i) =>
    ({ submit_id: `old-${i}`, output_path: `old-${i}.png` }))));
  f.write(`${state}.lock/owner`, 'held');
  const runs = Array.from({ length: 16 }, (_, i) => f.start('image-pending-state.mjs',
    i < 8 ? ['remove', `old-${i}.png`] : ['upsert', `id-${i}`, `assets/items/source-${i}.md`,
      `assets/images/items/new-${i}.png`, 'basic-asset', 'dreamina', '4.0', '1:1', '2k']));
  await delay(400);
  assert.equal(JSON.parse(f.read(state)).length, 8);
  const { rmSync } = await import('node:fs');
  rmSync(`${f.root}/${state}.lock`, { recursive: true });
  const results = await Promise.all(runs.map(r => r.result));
  assert.ok(results.every(r => r.status === 0), JSON.stringify(results));
  assert.deepEqual(JSON.parse(f.read(state)).map(r => r.submit_id).sort(),
    Array.from({ length: 8 }, (_, i) => `id-${i + 8}`).sort());
});

test('overlapping wrapper claims reject instead of queueing a second paid submission', async t => {
  const f = parallelImages(t), a = job('a');
  const first = f.start('image-gen-dreamina.sh', args(a));
  try {
    await waitFor(() => f.exists('started-a'));
    const secondRun = f.start('image-gen-dreamina.sh', ['--force', ...args(a)]);
    const second = await Promise.race([secondRun.result, delay(2000).then(() => ({ status: 'queued' }))]);
    assert.equal(second.status, 1);
    assert.match(second.stdout + second.stderr, /claim/);
    f.write('release-a', '');
    assert.equal((await first.result).status, 0);
    assert.equal(f.read('calls'), 'a\n');
  } finally { f.write('release-a', ''); await first.result; }
});

test('prepared and unknown receipts require reconciliation before force', t => {
  const f = parallelImages(t), a = job('a');
  f.write('release-a', '');
  const file = a.output.replace('.png', '.generation.json');
  for (const status of ['prepared', 'unknown', 'pending']) {
    f.write(a.output, 'old');
    const record = JSON.stringify({ output_path: a.output, status, submit_id: 'paid' });
    f.write(file, record);
    const result = f.cli('image-gen-dreamina.sh', ['--force', ...args(a)]);
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /reconcil/);
    assert.equal(f.read(file), record);
    assert.equal(f.read(a.output), 'old');
    assert.equal(f.exists('calls'), false);
  }
});
