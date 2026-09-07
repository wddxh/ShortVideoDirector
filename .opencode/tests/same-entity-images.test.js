import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameEntity } from './fixtures/same-entity.js';
import { waitFor } from './fixtures/parallel-images.js';

test('missing cross-category prerequisite blocks without expanding targets or replacing output', t => {
  const f = sameEntity(t);
  const terrace = f.jobs[2];
  f.write(terrace.output, 'preserved');
  f.write('jobs.json', JSON.stringify([terrace]));
  const result = f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing dependency/);
  assert.equal(f.read(terrace.output), 'preserved');
  assert.equal(f.exists('calls'), false);
  assert.equal(f.exists(f.jobs[0].output), false);
});

test('cross-category standard view waits for fresh anchors and preserves ordered wrapper refs', async t => {
  const f = sameEntity(t);
  const [hall, facade, terrace, lamp] = f.jobs;
  for (const j of f.jobs) f.write(j.output, 'old');
  f.write('jobs.json', JSON.stringify([terrace, lamp, facade, hall]));
  const run = f.start('generate-images-dreamina.mjs', ['--force', 'jobs.json']);
  try {
    await waitFor(() => ['hall', 'facade', 'lamp'].every(n => f.exists(`started-${n}`)));
    assert.equal(f.exists('started-terrace'), false);
    f.write('release-hall', '');
    await waitFor(() => !f.exists(`${hall.output}.claim`));
    assert.equal(f.exists('started-terrace'), false);
    f.write('release-facade', '');
    await waitFor(() => f.exists('started-terrace'));
    assert.deepEqual(JSON.parse(f.read('started-terrace')),
      ['fresh-mock://facade', 'fresh-mock://hall']);
    const args = JSON.parse(f.read('args-terrace'));
    assert.equal(args[0], 'image2image');
    assert.equal(args[args.indexOf('--images') + 1], `${facade.output},${hall.output}`);
    assert.equal(JSON.parse(f.read('args-hall'))[0], 'text2image');
    f.write('release-terrace', ''); f.write('release-lamp', '');
    assert.equal((await run.result).status, 0);
  } finally {
    for (const j of f.jobs) f.write(`release-${j.prompt}`, '');
    await run.result;
  }
});
