import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parallelImages, waitFor } from './fixtures/parallel-images.js';

const source = 'assets/items/lamp.md';
const output = 'assets/images/items/lamp.png';
const receipt = output.replace('.png', '.generation.json');
const pending = 'assets/images/pending.json';
const settings = { provider: 'dreamina', model: 'future-model', ratio: '9:16', resolution: '4k' };
const args = ['draw', output, '9:16', '4k', 'future-model', '', source];
const entry = { submit_id: 'paid-1', asset_path: source, output_path: output,
  type: 'basic-asset', ...settings };
const other = { submit_id: 'unrelated', output_path: 'other.png' };

function fixture(t, response = {}, sabotage = '') {
  const f = parallelImages(t);
  f.write('dreamina', `#!/usr/bin/env node
const fs = require('fs');
fs.appendFileSync('calls', JSON.stringify(process.argv.slice(2)) + '\\n');
if (process.argv[2] === 'query_result') {
  const id = process.argv[3].split('=')[1];
  const dir = process.argv[4].split('=')[1];
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + '/' + id + '_image_1.png', 'retrieved PNG');
  console.log(JSON.stringify({ gen_status: 'success', submit_id: id }));
  process.exit(0);
}
${sabotage}
console.log(${JSON.stringify(JSON.stringify({ gen_status: 'success',
    submit_id: 'paid-1', image_url: 'mock://image', ...response }))});
`, 0o755);
  f.write('curl', `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync('curl-started', String(process.pid));
fs.writeFileSync(process.argv[4], 'PNG');
`, 0o755);
  f.write(pending, JSON.stringify([other]));
  return f;
}

for (const target of ['receipt', 'pending']) test(`${target} write failure exposes ID without download`, t => {
  const f = fixture(t, {}, target === 'receipt' ? "fs.writeFileSync('reject-receipt', '');" :
    `fs.rmSync('${pending}'); fs.mkdirSync('${pending}');`);
  f.write('reject-write.cjs', `const fs = require('fs');
const rename = fs.renameSync;
fs.renameSync = (from, to) => {
  if (to === '${receipt}' && fs.existsSync('reject-receipt')) {
    throw Object.assign(new Error('receipt rename denied'), { code: 'EACCES' });
  }
  return rename(from, to);
};
`);
  const result = f.cli('image-gen-dreamina.sh', args,
    { NODE_OPTIONS: `--require=${f.root}/reject-write.cjs` });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^FAIL .*submit_id=paid-1/m);
  assert.equal(f.exists('curl-started'), false);
  assert.equal(f.exists(output), false);
  if (target === 'pending') {
    assert.equal(JSON.parse(f.read(receipt)).submit_id, 'paid-1');
    assert.equal(JSON.parse(f.read(receipt)).status, 'received');
  } else {
    assert.equal(JSON.parse(f.read(receipt)).status, 'prepared');
    assert.equal(JSON.parse(f.read(receipt)).submit_id, undefined);
    assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...args]).status, 1);
    assert.equal(f.read('calls').trim().split('\n').length, 1);
  }
});

for (const status of ['querying', 'unexpected', 'fail']) test(`${status} retains known ID`, t => {
  const f = fixture(t, { gen_status: status });
  const result = f.cli('image-gen-dreamina.sh', args);
  assert.equal(result.status, status === 'querying' ? 2 : 1);
  assert.equal(JSON.parse(f.read(receipt)).submit_id, 'paid-1');
  assert.equal(JSON.parse(f.read(receipt)).status,
    status === 'querying' ? 'pending' : status === 'fail' ? 'failed' : 'unknown');
  assert.deepEqual(JSON.parse(f.read(pending)), status === 'fail' ? [other] : [other, entry]);
  assert.equal(f.exists('curl-started'), false);
});

for (const status of ['success', 'querying', 'unexpected']) test(`${status} without ID stays unknown`, t => {
  const f = fixture(t, { gen_status: status, submit_id: '' });
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(JSON.parse(f.read(receipt)).status, 'unknown');
  assert.equal(JSON.parse(f.read(receipt)).submit_id, undefined);
  assert.deepEqual(JSON.parse(f.read(pending)), [other]);
  assert.equal(f.exists('curl-started'), false);
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...args]).status, 1);
  assert.equal(f.read('calls').trim().split('\n').length, 1);
});

for (const failure of ['download', 'url']) test(`${failure} failure keeps ID for lookup, never resubmit`, t => {
  const f = fixture(t, failure === 'url' ? { image_url: '' } : {});
  f.write('curl', '#!/usr/bin/env bash\nexit 22\n', 0o755);
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(JSON.parse(f.read(receipt)).submit_id, 'paid-1');
  assert.deepEqual(JSON.parse(f.read(pending)), [other, entry]);
  const retry = f.cli('image-gen-dreamina.sh', ['--force', ...args]);
  assert.equal(retry.status, 2);
  assert.equal(retry.stdout, 'PENDING paid-1\n');
  assert.equal(f.cli('image-pending-state.mjs', ['get', output]).stdout,
    `PENDING paid-1 ${source} ${output}\n`);
  assert.equal(f.read('calls').trim().split('\n').length, 1);
  const lookup = spawnSync(`${f.root}/dreamina`,
    ['query_result', '--submit_id=paid-1', '--download_dir=recovery'],
    { cwd: f.root, encoding: 'utf8' });
  assert.equal(lookup.status, 0, lookup.stderr);
  renameSync(`${f.root}/recovery/paid-1_image_1.png`, `${f.root}/${output}`);
  assert.equal(f.cli('image-generation-record.mjs', ['settle', output, 'done', 'paid-1']).status, 0);
  assert.equal(f.cli('image-pending-state.mjs', ['remove', output, 'paid-1']).status, 0);
  assert.equal(f.read(output), 'retrieved PNG');
  assert.equal(JSON.parse(f.read(receipt)).status, 'done');
  assert.deepEqual(JSON.parse(f.read(pending)), [other]);
  assert.deepEqual(f.read('calls').trim().split('\n').map(JSON.parse).map(a => a[0]),
    ['text2image', 'query_result']);
});

test('post-download settlement failure reports ID and retains unresolved pending', t => {
  const f = fixture(t);
  f.write('curl', `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync(process.argv[4], 'PNG');
fs.renameSync('${receipt}', '${receipt}.saved');
fs.mkdirSync('${receipt}');
`, 0o755);
  const result = f.cli('image-gen-dreamina.sh', args);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /^FAIL .*submit_id=paid-1/m);
  assert.deepEqual(JSON.parse(f.read(pending)), [other, entry]);
  assert.equal(JSON.parse(f.read(`${receipt}.saved`)).status, 'received');
});

test('recovery rejects mismatched, unidentified, terminal and claimed receipts', t => {
  const f = fixture(t);
  const record = { source_path: source, output_path: output, ...settings,
    status: 'unknown', submit_id: 'paid-1' };
  const bad = [{ source_path: 'other.md' }, { output_path: 'other.png' },
    { submit_id: '' }, { status: 'prepared' }, { status: 'failed' }, { status: 'done' },
    { provider: 'other' }, { model: '' }];
  for (const change of bad) {
    f.write(receipt, JSON.stringify({ ...record, ...change }));
    assert.equal(f.cli('image-pending-state.mjs', ['recover', source, output]).status, 2);
    assert.deepEqual(JSON.parse(f.read(pending)), [other]);
  }
  f.write(receipt, JSON.stringify(record));
  f.write(`${output}.claim/owner`, 'active');
  assert.equal(f.cli('image-pending-state.mjs', ['recover', source, output]).status, 2);
  assert.equal(f.read(`${output}.claim/owner`), 'active');
  rmSync(`${f.root}/${output}.claim`, { recursive: true });
  f.write(pending, JSON.stringify([other, { ...entry, submit_id: 'different' }]));
  assert.equal(f.cli('image-pending-state.mjs', ['recover', source, output]).status, 2);
  assert.equal(JSON.parse(f.read(pending))[1].submit_id, 'different');
  assert.equal(f.exists('calls'), false);
});

test('settlement and cleanup cannot replace or remove another job identity', t => {
  const f = fixture(t, { gen_status: 'querying' });
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 2);
  const saved = f.read(receipt);
  assert.equal(f.cli('image-generation-record.mjs',
    ['settle', output, 'failed', 'wrong-id']).status, 1);
  assert.equal(f.read(receipt), saved);
  assert.equal(f.cli('image-pending-state.mjs', ['remove', output, 'wrong-id']).status, 0);
  assert.deepEqual(JSON.parse(f.read(pending)), [other, entry]);
});

test('receipt recovery accepts known unresolved asset IDs without current cards/config', t => {
  const f = fixture(t);
  const card = source;
  const image = output;
  for (const status of ['received', 'pending', 'unknown']) {
    const saved = JSON.stringify({ source_path: card, output_path: image, ...settings,
      status, submit_id: 'asset-id' });
    f.write(image.replace('.png', '.generation.json'), saved);
    f.write(pending, JSON.stringify([other]));
    assert.equal(f.cli('image-pending-state.mjs', ['recover', card, image]).status, 0);
    assert.deepEqual(JSON.parse(f.read(pending)), [other, { submit_id: 'asset-id',
      asset_path: card, output_path: image, type: 'basic-asset', ...settings }]);
    assert.equal(f.read(image.replace('.png', '.generation.json')), saved);
    assert.equal(f.exists(`${image}.claim`), false);
  }
  assert.equal(f.exists('calls'), false);
});

test('pending-index failure recovers only the explicit receipt tuple', t => {
  const f = fixture(t, {}, `fs.rmSync('${pending}'); fs.mkdirSync('${pending}');`);
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  const saved = f.read(receipt);
  rmSync(`${f.root}/${pending}`, { recursive: true });
  f.write(pending, JSON.stringify([other]));
  const recovered = f.cli('image-pending-state.mjs', ['recover', source, output]);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(recovered.stdout, `PENDING paid-1 ${source} ${output}\n`);
  assert.deepEqual(JSON.parse(f.read(pending)), [other, entry]);
  assert.equal(f.read(receipt), saved);
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...args]).status, 2);
  assert.equal(f.read('calls').trim().split('\n').length, 1);
});

for (const interrupt of [false, true]) test(`ID persists before curl; interrupt=${interrupt}`, async t => {
  const f = fixture(t);
  f.write('curl', `#!/usr/bin/env node
const fs = require('fs');
fs.writeFileSync('curl-started', String(process.pid));
const timer = setInterval(() => {
  if (!fs.existsSync('release-curl')) return;
  clearInterval(timer);
  fs.writeFileSync(process.argv[4], 'PNG');
}, 10);
`, 0o755);
  const run = f.start('image-gen-dreamina.sh', args);
  try {
    await waitFor(() => f.exists('curl-started'));
    assert.deepEqual(JSON.parse(f.read(receipt)), { source_path: source,
      output_path: output, ...settings, status: 'received', submit_id: 'paid-1' });
    assert.deepEqual(JSON.parse(f.read(pending)), [other, entry]);
    if (interrupt) {
      run.child.kill('SIGKILL');
      process.kill(Number(f.read('curl-started')), 'SIGKILL');
      await run.result;
      assert.equal(JSON.parse(f.read(receipt)).submit_id, 'paid-1');
      assert.deepEqual(JSON.parse(f.read(pending)), [other, entry]);
    } else {
      f.write('release-curl', '');
      const result = await run.result;
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.equal(result.stdout, `OK ${output}\n`);
      assert.equal(JSON.parse(f.read(receipt)).status, 'done');
      assert.deepEqual(JSON.parse(f.read(pending)), [other]);
    }
  } finally { f.write('release-curl', ''); await run.result; }
});
