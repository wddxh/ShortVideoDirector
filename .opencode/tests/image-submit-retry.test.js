import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageProject } from './fixtures/image-project.js';
import { job } from './fixtures/parallel-images.js';
import { parseImageArgs } from '../../scripts/generate-images-dreamina.mjs';

const j = job('lamp');
const receipt = j.output.replace('.png', '.generation.json');
const args = [j.prompt, j.output, '9:16', '4k', 'future-model', '', j.source];
const retry = ['--retry-missing-id', ...args];
function fixture(t, response = '{}', query = '{"ret":1015}', exit = 1) {
  const f = imageProject(t);
  f.write('dreamina', `#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
fs.appendFileSync('calls', JSON.stringify(a) + '\\n');
if (a[0] === 'query_result') {
  fs.copyFileSync('${receipt}', 'at-query.json');
  fs.copyFileSync('assets/images/pending.json', 'at-query-pending.json');
  console.log(${JSON.stringify(query)}); process.exit(${exit});
}
fs.copyFileSync('${receipt}', 'at-submit.json');
console.log(a.includes('--poll=0') ? ${JSON.stringify(response)} : '{"ret":1015}');
`, 0o755);
  return { ...f, record: () => JSON.parse(f.read(receipt)),
    calls: () => f.read('calls').trim().split('\n').map(JSON.parse) };
}

for (const refs of ['', 'ref.png']) test(`poll0 persists bare ID before query: ${refs}`, t => {
  const f = fixture(t, '{"submit_id":"paid"}');
  f.write('ref.png', 'ref');
  assert.equal(f.cli('image-gen-dreamina.sh', args.with(5, refs)).status, 1);
  assert.equal(f.record().submit_id, 'paid');
  assert.equal(JSON.parse(f.read('at-query.json')).submit_id, 'paid');
  assert.equal(JSON.parse(f.read('at-query-pending.json'))[0].submit_id, 'paid');
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 2);
  assert.equal(f.calls().length, 2);
});

test('missing-ID retries are opt-in, persisted before calls and never reset', t => {
  const f = fixture(t);
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(f.record().missing_id_responses.length, 1);
  for (const count of [1, 2]) {
    assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...args]).status, 1);
    const r = f.cli('image-gen-dreamina.sh', retry);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /remote duplicates possible/);
    assert.equal(JSON.parse(f.read('at-submit.json')).missing_id_retries, count);
    assert.equal(f.record().missing_id_responses.length, count + 1);
  }
  const before = f.read(receipt);
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 1);
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...retry]).status, 1);
  assert.equal(f.cli('image-generation-record.mjs', ['prepare', j.source, j.output,
    'dreamina', 'future-model', '9:16', '4k']).status, 1);
  assert.equal(f.read(receipt), before);
  assert.equal(f.calls().length, 3);
});

test('retry gets an ID and downloads that same job', t => {
  const f = fixture(t);
  f.cli('image-gen-dreamina.sh', args);
  const replacement = fixture(t, '{"submit_id":"paid"}',
    '{"gen_status":"success","image_url":"mock://paid"}', 0);
  f.write('dreamina', replacement.read('dreamina'), 0o755);
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 0);
  assert.equal(f.record().submit_id, 'paid');
  assert.equal(f.record().missing_id_retries, 1);
  assert.deepEqual(f.calls().at(-1), ['query_result', '--submit_id=paid']);
  assert.equal(f.read(j.output), 'PNG');
});

test('runner forwards opt-in for one retry, with no hidden loop', t => {
  const f = fixture(t);
  f.cli('image-gen-dreamina.sh', args);
  f.write('jobs.json', JSON.stringify([j]));
  assert.equal(parseImageArgs(['--retry-missing-id', 'jobs.json']).retryMissingId, true);
  const r = f.cli('generate-images-dreamina.mjs', ['--retry-missing-id', 'jobs.json']);
  assert.equal(r.status, 1);
  assert.equal(f.record().missing_id_retries, 1);
  assert.equal(f.calls().length, 2);
});

for (const evidence of ['claim', 'lock', 'output', 'known']) test(`retry respects ${evidence}`, t => {
  const f = fixture(t);
  f.cli('image-gen-dreamina.sh', args);
  if (evidence === 'claim') f.write(`${j.output}.claim/owner`, 'active');
  if (evidence === 'lock') f.write('assets/images/pending.json.lock/owner', 'active');
  if (evidence === 'output') f.write(j.output, 'possibly retrieved');
  if (evidence === 'known') f.write(receipt, JSON.stringify({ ...f.record(),
    status: 'failed', submit_id: 'known' }));
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...retry]).status, 1);
  assert.equal(f.calls().length, 1);
  if (evidence === 'claim') assert.equal(f.read(`${j.output}.claim/owner`), 'active');
  if (evidence === 'lock') assert.equal(f.read('assets/images/pending.json.lock/owner'), 'active');
});

test('interrupted prepared needs explicit owner-confirmed retry and preserves its count', t => {
  const f = fixture(t);
  f.write(receipt, JSON.stringify({ source_path: j.source, output_path: j.output,
    ...j.settings, status: 'prepared', missing_id_retries: 1,
    missing_id_responses: ['earlier no-ID evidence'] }));
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(f.exists('calls'), false);
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 1);
  assert.equal(f.record().missing_id_retries, 2);
  assert.equal(f.record().missing_id_responses[0], 'earlier no-ID evidence');
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 1);
  assert.equal(f.calls().length, 1);
});

test('ordinary quality reprepare keeps missing-ID evidence and budget', t => {
  const f = fixture(t);
  f.cli('image-gen-dreamina.sh', args);
  f.cli('image-gen-dreamina.sh', retry);
  f.cli('image-generation-record.mjs', ['settle', j.output, 'failed']);
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...args]).status, 1);
  assert.equal(f.record().missing_id_retries, 1);
  assert.equal(f.record().missing_id_responses.length, 3);
});

test('zero-exit query error is not a missing-ID failure', t => {
  const f = fixture(t, '{"submit_id":"paid"}', '{"ret":1015}', 0);
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 1);
  assert.equal(f.record().submit_id, 'paid');
  assert.equal(f.record().missing_id_responses, undefined);
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 2);
  assert.equal(f.calls().length, 2);
});

test('failed atomic receipt write leaves local ID evidence that blocks replacement', t => {
  const f = fixture(t);
  f.cli('image-gen-dreamina.sh', args);
  f.write(`${receipt}.123.tmp`, JSON.stringify({ ...f.record(), status: 'received',
    submit_id: 'paid-in-local-evidence' }));
  const result = f.cli('image-gen-dreamina.sh', retry);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /paid-in-local-evidence/);
  assert.equal(f.calls().length, 1);
});

test('separate query pending stays PENDING; later invocations do not submit', t => {
  const f = fixture(t, '{"submit_id":"paid"}', '{"gen_status":"querying"}', 0);
  const result = f.cli('image-gen-dreamina.sh', args);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, 'PENDING paid\n');
  assert.equal(f.record().status, 'pending');
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 2);
  assert.equal(f.calls().length, 2);
});

test('terminal query failure clears its pending and permits a later normal attempt', t => {
  const f = fixture(t, '{"submit_id":"paid"}',
    '{"gen_status":"fail","fail_reason":"generation rejected"}', 0);
  const result = f.cli('image-gen-dreamina.sh', args);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /generation rejected/);
  assert.equal(f.record().status, 'failed');
  assert.equal(f.record().submit_id, 'paid');
  assert.deepEqual(JSON.parse(f.read('assets/images/pending.json')), []);
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(f.calls().filter(a => a[0] === 'text2image').length, 2);
});

test('query error with fail payload preserves pending until a terminal result is known', t => {
  const f = fixture(t, '{"submit_id":"paid"}',
    '{"gen_status":"fail","fail_reason":"query transport error"}', 1);
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(f.record().status, 'unknown');
  assert.equal(JSON.parse(f.read('assets/images/pending.json'))[0].submit_id, 'paid');
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 2);
  assert.equal(f.calls().length, 2);
});

test('separate-query download failure retains known ID and no missing-ID budget', t => {
  const f = fixture(t, '{"submit_id":"paid"}',
    '{"gen_status":"success","image_url":"mock://paid"}', 0);
  f.write('curl', '#!/usr/bin/env bash\nexit 22\n', 0o755);
  assert.equal(f.cli('image-gen-dreamina.sh', args).status, 1);
  assert.equal(f.record().submit_id, 'paid');
  assert.equal(f.record().missing_id_retries, undefined);
  assert.equal(f.cli('image-gen-dreamina.sh', retry).status, 2);
  assert.equal(f.calls().length, 2);
});
