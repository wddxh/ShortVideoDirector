import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relative, join } from 'node:path';
import { parallelImages, job, waitFor } from './fixtures/parallel-images.js';
import { runImages, parseImageArgs } from '../../scripts/generate-images-dreamina.mjs';

test('exported image API validates concurrency and returns skipped outcomes', async t => {
  const f = parallelImages(t);
  const a = { ...job('a'), output: `${f.root}/a.png` };
  f.write('a.png', 'PNG');
  assert.deepEqual(parseImageArgs(['jobs.json']),
    { concurrency: 5, force: false, inputs: ['jobs.json'] });
  assert.deepEqual(parseImageArgs(['--concurrency', '1', '--force', 'jobs.json']),
    { concurrency: 1, force: true, inputs: ['jobs.json'] });
  for (const value of ['0', '-1', '1.5', 'abc']) {
    assert.throws(() => parseImageArgs(['--concurrency', value, 'jobs.json']), /concurrency/);
  }
  const result = await runImages([a, a]);
  assert.equal(result.status, 0);
  assert.equal(result.generated, 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.outcomes, [{ ...a, status: 'skipped' }]);
});

test('explicit concurrency three overlaps three jobs but not a fourth', async t => {
  const f = parallelImages(t);
  f.write('jobs.json', JSON.stringify(['a', 'b', 'c', 'd'].map(n => job(n))));
  const run = f.start('generate-images-dreamina.mjs', ['--concurrency', '3', 'jobs.json']);
  try {
    await waitFor(() => ['a', 'b', 'c'].every(n => f.exists(`started-${n}`)));
    assert.equal(f.exists('started-d'), false);
    for (const n of ['a', 'b', 'c', 'd']) f.write(`release-${n}`, '');
    assert.equal((await run.result).status, 0);
  } finally {
    for (const n of ['a', 'b', 'c', 'd']) f.write(`release-${n}`, '');
    await run.result;
  }
});

test('failure drains a successful active image without deleting an unstarted forced output', async t => {
  const f = parallelImages(t);
  f.write(job('c').output, 'old');
  f.write('jobs.json', JSON.stringify(['a', 'b', 'c'].map(n => job(n))));
  const run = f.start('generate-images-dreamina.mjs', ['--force', '--concurrency', '2', 'jobs.json']);
  try {
    await waitFor(() => f.exists('started-a') && f.exists('started-b'));
    f.write('release-a', 'fail');
    await waitFor(() => !f.exists(`${job('a').output}.claim`));
    f.write('release-b', '');
    assert.equal((await run.result).status, 1);
    assert.equal(f.read(job('b').output), 'fresh-mock://b');
    assert.equal(f.read(job('c').output), 'old');
  } finally {
    for (const n of ['a', 'b', 'c']) f.write(`release-${n}`, '');
    await run.result;
  }
});

test('external reference with an unresolved receipt cannot use an old PNG', t => {
  const f = parallelImages(t), a = job('a'), b = job('b', [a.output]);
  f.write('release-b', '');
  f.write(a.output, 'old'); f.write(b.output, 'old');
  f.write(a.output.replace('.png', '.generation.json'), JSON.stringify({ status: 'unknown' }));
  f.write('jobs.json', JSON.stringify([b]));
  const result = f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /reconciliation/);
  assert.equal(f.read(b.output), 'old');
  assert.equal(f.exists('calls'), false);
});

test('all-batch preflight preserves forced outputs on invalid later inputs', t => {
  const f = parallelImages(t);
  const a = job('a'); f.write(a.output, 'old');
  const invalid = [[job('b', ['missing.png']), /missing dependency/],
    [{ ...job('b'), settings: {} }, /invalid image job/],
    [{ ...a, prompt: 'conflict' }, /conflicting output/],
    [job('b', [job('b').output]), /cyclic image dependencies/]];
  for (const [b, message] of invalid) {
    f.write('jobs.json', JSON.stringify([a, b]));
    const result = f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
    assert.equal(f.read(a.output), 'old');
    assert.equal(f.exists('calls'), false);
    assert.equal(f.exists(a.output.replace('.png', '.generation.json')), false);
  }
});

test('pending target or external reference stops the entire batch', t => {
  const f = parallelImages(t);
  const a = job('a'), b = job('b');
  f.write(a.output, 'old'); f.write(b.output, 'old');
  f.write('assets/images/pending.json', JSON.stringify([
    { submit_id: 'prior', output_path: b.output, asset_path: b.source }]));
  for (const jobs of [[a, b], [a, job('c', [b.output])]]) {
    f.write('jobs.json', JSON.stringify(jobs));
    const r = f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /PENDING prior/);
    assert.equal(f.exists('calls'), false);
    assert.equal(f.read(a.output), 'old');
  }
});

for (const outcome of ['fail', 'querying']) test(`${outcome} stops admission and drains active outcomes`, async t => {
  const f = parallelImages(t);
  f.write('jobs.json', JSON.stringify(['a', 'b', 'c'].map(n => job(n))));
  const run = f.start('generate-images-dreamina.mjs', ['--concurrency', '2', 'jobs.json']);
  try {
    await waitFor(() => f.exists('started-a') && f.exists('started-b'));
    f.write('release-a', outcome);
    const receipt = job('a').output.replace('.png', '.generation.json');
    await waitFor(() => f.exists(receipt) && JSON.parse(f.read(receipt)).status !== 'prepared');
    assert.equal(f.exists('started-c'), false);
    f.write('release-b', 'querying');
    const result = await run.result;
    assert.equal(result.status, outcome === 'fail' ? 1 : 2);
    assert.match(result.stdout, /PENDING id-b/);
    assert.match(result.stdout, /BLOCKED .*c\.png/);
    assert.equal(f.exists('started-c'), false);
    assert.equal(JSON.parse(f.read('assets/images/pending.json')).length, outcome === 'fail' ? 1 : 2);
  } finally {
    for (const n of ['a', 'b', 'c']) f.write(`release-${n}`, '');
    await run.result;
  }
});

for (const api of [false, true]) test(`default five images overlap, cap starts, and deduplicate (${api ? 'API' : 'CLI'})`, async t => {
  const f = parallelImages(t);
  const names = ['a', 'b', 'c', 'd', 'e', 'f'];
  f.write('jobs.json', JSON.stringify([...names.map(n => job(n)), job('a')]));
  const module = new URL('../../scripts/generate-images-dreamina.mjs', import.meta.url).href;
  f.write('api.mjs', `import { runImages } from ${JSON.stringify(module)};
import fs from 'node:fs';
process.exitCode = (await runImages(JSON.parse(fs.readFileSync('jobs.json', 'utf8')))).status;
`);
  const run = api ? f.start(relative(join(process.cwd(), 'scripts'), `${f.root}/api.mjs`), []) :
    f.start('generate-images-dreamina.mjs', ['jobs.json']);
  try {
    await waitFor(() => names.slice(0, 5).every(n => f.exists(`started-${n}`)));
    assert.equal(f.exists('started-f'), false);
    f.write('release-a', '');
    await waitFor(() => f.exists('started-f'));
    for (const n of names) f.write(`release-${n}`, '');
    const result = await run.result;
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(f.read('calls').trim().split('\n').sort(), names);
  } finally {
    for (const n of names) f.write(`release-${n}`, '');
    await run.result;
  }
});

test('force dependencies wait for fresh base and previous output', async t => {
  const f = parallelImages(t);
  const a = job('a'), b = job('b', [a.output]), c = job('c', [a.output, b.output]);
  f.write(a.output, 'old'); f.write(b.output, 'old');
  f.write('jobs.json', JSON.stringify([c, b, a]));
  const run = f.start('generate-images-dreamina.mjs', ['--force', 'jobs.json']);
  try {
    await waitFor(() => f.exists('started-a'));
    assert.equal(f.exists('started-b'), false);
    assert.equal(f.exists('started-c'), false);
    f.write('release-a', '');
    await waitFor(() => f.exists('started-b'));
    assert.deepEqual(JSON.parse(f.read('started-b')), ['fresh-mock://a']);
    assert.equal(f.exists('started-c'), false);
    f.write('release-b', '');
    await waitFor(() => f.exists('started-c'));
    assert.deepEqual(JSON.parse(f.read('started-c')), ['fresh-mock://a', 'fresh-mock://b']);
    f.write('release-c', '');
    assert.equal((await run.result).status, 0);
  } finally {
    for (const n of ['a', 'b', 'c']) f.write(`release-${n}`, '');
    await run.result;
  }
});
