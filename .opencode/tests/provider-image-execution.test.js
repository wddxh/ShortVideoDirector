import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { imageProject } from './fixtures/image-project.js';

const source = 'assets/items/lamp.md';
const output = 'assets/images/items/lamp.png';
const receipt = output.replace('.png', '.generation.json');
const args = ['draw', output, '9:16', '4k', 'future-model', '', source];
const settings = { provider: 'dreamina', model: 'future-model', ratio: '9:16', resolution: '4k' };
const local = { images: ['references/shot/layout.png', 'references/shot/light.png'],
  sources: ['references/shot/scene.py'] };
const localSection = '\n## 本地制作参考\nPlaceholder controls only.\n```json\n' +
  JSON.stringify(local) + '\n```\n';

test('unsupported image paths reject before force deletion or any provider call', t => {
  const f = imageProject(t);
  const card = 'assets/other/lamp.md';
  const target = 'assets/images/other/lamp.png';
  f.write(target, 'protected');
  for (const force of [[], ['--force'], ['--retry-missing-id']]) {
    f.write('jobs.json', JSON.stringify([{ source: card, output: target, prompt: 'draw', images: [], settings }]));
    assert.equal(f.cli('generate-images-dreamina.mjs', [...force, 'jobs.json']).status, 1);
    for (const sourcePath of [card, source]) {
      assert.equal(f.cli('image-gen-dreamina.sh', [...force, 'draw', target,
        '9:16', '4k', 'future-model', '', sourcePath]).status, 1);
    }
    assert.equal(f.read(target), 'protected');
    assert.equal(f.exists(target.replace('.png', '.generation.json')), false);
    assert.equal(f.exists('calls'), false);
  }
  for (const action of ['check', 'prepare', 'retry-check', 'retry-prepare']) {
    assert.equal(f.cli('image-generation-record.mjs', [action, card, target,
      ...Object.values(settings)]).status, 1);
  }
  assert.equal(f.cli('image-pending-state.mjs', ['recover', card, target]).status, 2);
});

test('authorized exploration paths use the same generation and receipt contract', t => {
  const f = imageProject(t);
  const card = 'references/design/lamp.md', target = 'references/design/lamp.png';
  f.write(card, 'Exploration');
  f.write('jobs.json', JSON.stringify([{ source: card, output: target,
    prompt: 'Explore lighting', images: [], settings }]));
  const result = f.cli('generate-images-dreamina.mjs', ['jobs.json'], {
    EXPECTED_RECEIPT: target.replace('.png', '.generation.json'),
    RESPONSE: '{"gen_status":"success","submit_id":"exploration","image_url":"mock://image"}' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(f.read(target), 'PNG');
  const record = JSON.parse(f.read(target.replace('.png', '.generation.json')));
  assert.equal(record.source_path, card);
  assert.equal(record.status, 'done');
  assert.equal(record.submit_id, 'exploration');
});

for (const exploration of [false, true]) test(`pending recovery needs no current card, exploration=${exploration}`, t => {
  const f = imageProject(t);
  const card = exploration ? 'references/design/lamp.md' : source;
  const target = exploration ? 'references/design/lamp.png' : output;
  const recordPath = target.replace('.png', '.generation.json');
  f.write(recordPath, JSON.stringify({ source_path: card, output_path: target,
    ...settings, status: 'received', submit_id: 'known' }));
  assert.equal(f.cli('image-pending-state.mjs', ['recover', card, target]).status, 0);
  f.write(target, 'recovered PNG');
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', 'draw', target,
    '9:16', '4k', 'future-model', '', card]).status, 2);
  assert.equal(f.exists('calls'), false);
  assert.equal(f.read(target), 'recovered PNG');
  assert.equal(f.cli('image-generation-record.mjs', ['settle', target, 'done', 'known']).status, 0);
  const record = JSON.parse(f.read(recordPath));
  assert.equal(record.status, 'done');
  assert.equal(record.submit_id, 'known');
  assert.equal(record.output_sha256, createHash('sha256').update('recovered PNG').digest('hex'));
  assert.deepEqual(Object.fromEntries(Object.keys(settings).map(k => [k, record[k]])), settings);
});

for (const status of ['success', 'querying']) test(`receipt records ${status} and pre-submit settings`, t => {
  const f = imageProject(t);
  f.write(source, 'Lamp');
  const result = f.cli('image-gen-dreamina.sh', args, { EXPECTED_RECEIPT: receipt,
    RESPONSE: JSON.stringify({ gen_status: status, submit_id: 'job-1', image_url: 'mock://image' }) });
  assert.equal(result.status, status === 'success' ? 0 : 2, result.stdout + result.stderr);
  const prepared = { source_path: source, output_path: output, ...settings, status: 'prepared' };
  assert.deepEqual(JSON.parse(f.read('observed.json')), prepared);
  assert.deepEqual(JSON.parse(f.read(receipt)), { ...prepared,
    status: status === 'success' ? 'done' : 'pending', submit_id: 'job-1',
    ...(status === 'success' ? { output_sha256: createHash('sha256').update('PNG').digest('hex') } : {}) });
  assert.deepEqual(JSON.parse(f.read('calls')), ['text2image', '--prompt=draw', '--ratio=9:16',
    '--resolution_type=4k', '--model_version=future-model', '--generate_num=1', '--poll=0']);
});

test('pending lookup preserves recorded settings and removal is scoped', t => {
  const f = imageProject(t), pending = 'assets/images/pending.json';
  const entry = { submit_id: 'known', asset_path: source, output_path: output,
    type: 'basic-asset', ...settings };
  f.write(pending, JSON.stringify([entry]));
  assert.equal(f.cli('image-pending-state.mjs', ['get', output]).stdout, `PENDING known ${source} ${output}\n`);
  assert.deepEqual(JSON.parse(f.read(pending)), [entry]);
  assert.equal(f.cli('image-pending-state.mjs', ['remove', output]).status, 0);
  assert.equal(f.cli('image-pending-state.mjs', ['upsert', 'new', source, output, 'basic-asset',
    ...Object.values(settings)]).status, 0);
  assert.deepEqual(JSON.parse(f.read(pending)), [{ submit_id: 'new', asset_path: source,
    output_path: output, type: 'basic-asset', ...settings }]);
});

test('failed and unknown outcomes never claim completed output', t => {
  const f = imageProject(t);
  for (const [response, status] of [['{"gen_status":"fail"}', 'failed'], ['network lost', 'unknown']]) {
    assert.equal(f.cli('image-gen-dreamina.sh', args,
      { EXPECTED_RECEIPT: receipt, RESPONSE: response }).status, 1);
    assert.equal(JSON.parse(f.read(receipt)).status, status);
    assert.equal(JSON.parse(f.read(receipt)).output_sha256, undefined);
  }
});

test('asset routes reject missing, reordered or duplicate local suffix before force', t => {
  const f = imageProject(t);
  f.write(source, 'Lamp' + localSection);
  for (const file of ['anchor.png', ...local.images, ...local.sources]) f.write(file, 'reference');
  for (const images of [[], [...local.images].reverse(), [...local.images, 'anchor.png'],
    [local.images[0], ...local.images], [`./${local.images[0]}`, ...local.images]]) {
    f.write(output, 'old');
    f.write('jobs.json', JSON.stringify([{ source, output, prompt: 'draw', settings, images }]));
    assert.equal(f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']).status, 1);
    assert.equal(f.cli('image-gen-dreamina.sh', ['--force', 'draw', output, '9:16', '4k',
      'future-model', images.join(','), source]).status, 1);
    assert.equal(f.read(output), 'old');
    assert.equal(f.exists(receipt), false);
    assert.equal(f.exists('calls'), false);
  }
});

test('missing local source blocks submission routes but not pending lookup', t => {
  const f = imageProject(t);
  f.write(source, 'Lamp' + localSection); f.write(output, 'old');
  for (const file of local.images) f.write(file, 'reference');
  f.write('jobs.json', JSON.stringify([{ source, output, prompt: 'draw', settings, images: local.images }]));
  const direct = ['--force', 'draw', output, '9:16', '4k', 'future-model', local.images.join(','), source];
  assert.equal(f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']).status, 1);
  assert.equal(f.cli('image-gen-dreamina.sh', direct).status, 1);
  assert.equal(f.read(output), 'old');
  f.write('assets/images/pending.json', JSON.stringify([
    { submit_id: 'existing', asset_path: source, output_path: output }]));
  assert.equal(f.cli('generate-images-dreamina.mjs', ['--force', 'jobs.json']).status, 2);
  assert.equal(f.cli('image-gen-dreamina.sh', direct).status, 2);
  assert.equal(f.exists('calls'), false);
});

test('image rejects omitted, empty and extra settings before force deletion', t => {
  const f = imageProject(t);
  f.write(source, 'Lamp'); f.write(output, 'old');
  for (const values of [args.slice(0, -1), [...args, '--width=100'],
    args.map((v, i) => i === 2 ? '' : v), args.map((v, i) => i === 4 ? 'none' : v)]) {
    assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...values]).status, 1);
    assert.equal(f.read(output), 'old');
    assert.equal(f.exists('calls'), false);
    assert.equal(f.exists(receipt), false);
  }
});

test('Creator asset mapping forwards local suffix unchanged to image2image', t => {
  const f = imageProject(t), images = ['anchor.png', ...local.images];
  f.write(source, 'Lamp' + localSection);
  for (const file of [...images, ...local.sources]) f.write(file, 'reference');
  f.write('jobs.json', JSON.stringify([{ source, output, prompt: 'Creator freeform', settings, images }]));
  const result = f.cli('generate-images-dreamina.mjs', ['jobs.json'], { EXPECTED_RECEIPT: receipt,
    RESPONSE: '{"gen_status":"success","submit_id":"local","image_url":"mock://image"}' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(f.read('calls')), ['image2image', '--images', images.join(','),
    '--prompt=Creator freeform', '--ratio=9:16', '--resolution_type=4k',
    '--model_version=future-model', '--generate_num=1', '--poll=0']);
});
