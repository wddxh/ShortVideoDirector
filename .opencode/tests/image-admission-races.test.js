import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { parallelImages, job, waitFor } from './fixtures/parallel-images.js';

test('an old output with a failed receipt is not counted as a completed skip', async t => {
  const f = parallelImages(t), b = job('b');
  f.write(b.output, 'old');
  f.write(b.output.replace('.png', '.generation.json'), JSON.stringify({ status: 'failed' }));
  f.write('batch.json', JSON.stringify([b]));
  f.write('release-b', '');
  const result = await f.start('generate-images-dreamina.mjs', ['batch.json']).result;
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'OK generated 1 skipped 0\n');
  assert.equal(f.read('calls'), 'b\n');
});

test('direct non-force skip preserves receipts and never bypasses unresolved state or a claim', t => {
  const f = parallelImages(t), b = job('b');
  const args = [b.prompt, b.output, '9:16', '4k', 'future-model', '', b.source];
  const receipt = b.output.replace('.png', '.generation.json');
  f.write(b.output, 'existing');
  f.write('release-b', '');
  assert.equal(f.cli('image-gen-dreamina.sh', args).stdout, `SKIP ${b.output}\n`);
  assert.equal(f.exists(receipt), false);
  for (const status of ['prepared', 'unknown', 'pending']) {
    const record = JSON.stringify({ status, output_path: b.output });
    f.write(receipt, record);
    assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
    assert.equal(f.read(receipt), record);
  }
  f.write(receipt, JSON.stringify({ status: 'done', output_path: b.output }));
  f.write(`${b.output}.claim/owner`, 'other');
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(f.exists('calls'), false);
});

for (const change of ['pending', 'claim', 'receipt', 'missing']) {
  test(`queued external reference becomes ${change} after preflight`, async t => {
    const f = parallelImages(t), r = job('r'), b = job('b', [r.output]);
    f.write(r.output, 'old PNG');
    f.write('batch.json', JSON.stringify([job('a'), b, job('c')]));
    const batch = f.start('generate-images-dreamina.mjs', ['--concurrency', '1', 'batch.json']);
    try {
      await waitFor(() => f.exists('started-a'));
      if (change === 'pending') {
        const saved = f.cli('image-pending-state.mjs', ['upsert', 'paid-r', r.source,
          r.output, 'basic-asset', 'dreamina', 'future-model', '9:16', '4k']);
        assert.equal(saved.status, 0, saved.stderr);
      } else if (change === 'claim') f.write(`${r.output}.claim/owner`, 'active');
      else if (change === 'receipt') {
        f.write(r.output.replace('.png', '.generation.json'), JSON.stringify({ status: 'unknown' }));
      } else rmSync(`${f.root}/${r.output}`);
      for (const n of ['a', 'b', 'c']) f.write(`release-${n}`, '');
      const result = await batch.result;
      assert.deepEqual(f.read('calls').trim().split('\n'), ['a']);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /FAILED .*b\.png/);
      assert.match(result.stdout, /BLOCKED .*c\.png/);
      assert.equal(f.exists(b.output.replace('.png', '.generation.json')), false);
    } finally {
      for (const n of ['a', 'b', 'c']) f.write(`release-${n}`, '');
      await batch.result;
    }
  });
}

for (const force of [false, true]) test(`queued output completed by another run (force=${force})`, async t => {
  const f = parallelImages(t), a = job('a'), b = job('b');
  f.write('batch.json', JSON.stringify([a, b]));
  f.write('other.json', JSON.stringify([b]));
  const batch = f.start('generate-images-dreamina.mjs',
    [...(force ? ['--force'] : []), '--concurrency', '1', 'batch.json']);
  try {
    await waitFor(() => f.exists('started-a'));
    f.write('release-b', '');
    const other = await f.start('generate-images-dreamina.mjs', ['other.json']).result;
    assert.equal(other.status, 0, other.stderr);
    const receipt = b.output.replace('.png', '.generation.json');
    const before = f.read(receipt);
    f.write('release-a', '');
    const result = await batch.result;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(f.read('calls').trim().split('\n'), force ? ['a', 'b', 'b'] : ['a', 'b']);
    assert.equal(result.stdout, force ? 'OK generated 2 skipped 0\n' : 'OK generated 1 skipped 1\n');
    if (!force) assert.equal(f.read(receipt), before);
  } finally {
    f.write('release-a', ''); f.write('release-b', '');
    await batch.result;
  }
});
