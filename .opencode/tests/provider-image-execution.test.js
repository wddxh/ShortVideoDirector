import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { imageProject, settingsText } from './fixtures/image-project.js';
import { parallelImages, waitFor } from './fixtures/parallel-images.js';

const source = 'assets/items/lamp.md';
const output = 'assets/images/items/lamp.png';
const receipt = output.replace('.png', '.generation.json');
const args = ['draw', output, '9:16', '4k', 'future-model', '', source];
const settings = { provider: 'dreamina', model: 'future-model', ratio: '9:16', resolution: '4k' };

test('sheet coordinator retains the legacy gate exit code without provider calls', t => {
  const f = imageProject(t);
  const card = sheet(f, '01');
  f.write('assets/keyframes/legacy.md', 'legacy');
  const result = f.cli('generate-storyboard-sheets-dreamina.sh', [card]);
  assert.equal(result.status, 2);
  assert.equal(f.exists('calls'), false);
});

function sheet(f, shot, ratio = '9:16') {
  const card = `assets/storyboard-sheets/ep01/shot${shot}.md`;
  const board = 'story/episodes/ep01/storyboard.md';
  const existing = f.exists(board) ? f.read(board) : '';
  f.write(board, existing + `\n### shot ${Number(shot)}\n- 时长：8s\n` +
    '- 引用资产：[lamp](assets/items/lamp.md)\n**画面与声音描述：**\nAction\n');
  f.write(card, settingsText.replace('9:16', ratio) +
    '## 引用资产\n- [lamp](../../items/lamp.md)\n## 连续性参考\n无\n' +
    '## Panel 规划\n### PANEL 1\nAction\n## 图像生成提示\nDraw sheet');
  return card;
}

test('sheet adapter forwards missing-ID opt-in without changing settings or refs', t => {
  const f = imageProject(t);
  f.write(output, 'base');
  const card = sheet(f, '01');
  const target = card.replace('assets/', 'assets/images/').replace('.md', '.png');
  const record = target.replace('.png', '.generation.json');
  const env = { EXPECTED_RECEIPT: record, RESPONSE: '{}' };
  assert.equal(f.cli('generate-storyboard-sheets-dreamina.sh', [card], env).status, 1);
  assert.equal(f.cli('generate-storyboard-sheets-dreamina.sh',
    ['--retry-missing-id', card], env).status, 1);
  assert.equal(JSON.parse(f.read(record)).missing_id_retries, 1);
  const calls = f.read('calls').trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(calls[0][0], 'image2image');
  assert.equal(calls[0][2], output);
  assert.equal(calls[0].at(-1), '--poll=0');
});

test('sheet adapter overlaps independent cards but waits for declared previous PNG', async t => {
  const f = parallelImages(t);
  f.write(output, 'base');
  const cards = ['01', '02', '03'].map(n => sheet(f, n));
  for (let i = 0; i < cards.length; i++) {
    f.write(cards[i], f.read(cards[i]).replace('Draw sheet', `Draw ${['a', 'b', 'c'][i]}`));
  }
  f.write(cards[1], f.read(cards[1]).replace('无',
    '- [shot01](./shot01.md)\n- 继承元素：light'));
  const run = f.start('generate-storyboard-sheets-dreamina.sh', cards);
  try {
    await waitFor(() => f.exists('started-a') && f.exists('started-c'));
    assert.equal(f.exists('started-b'), false);
    f.write('release-a', '');
    await waitFor(() => f.exists('started-b'));
    assert.deepEqual(JSON.parse(f.read('started-b')), ['base', 'fresh-mock://a']);
    f.write('release-b', ''); f.write('release-c', '');
    const result = await run.result;
    assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally {
    for (const n of ['a', 'b', 'c']) f.write(`release-${n}`, '');
    await run.result;
  }
});

test('coordinator sorts numerically and forwards mixed sheet ratios', (t) => {
  const f = imageProject(t);
  f.write(output, 'base');
  const cards = [sheet(f, '100', '1:1'), sheet(f, '99', '4:3'), sheet(f, '02')];
  f.write('dreamina', `#!/usr/bin/env node
const fs = require('fs');
fs.appendFileSync('calls', JSON.stringify(process.argv.slice(2)) + '\\n');
console.log(JSON.stringify({ gen_status: 'success', submit_id: 'sorted-job', image_url: 'mock://image' }));
`, 0o755);
  const result = f.cli('generate-storyboard-sheets-dreamina.sh', ['--concurrency', '1', ...cards]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const calls = f.read('calls').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls.map((a) => a.find((v) => v.startsWith('--ratio='))),
    ['--ratio=9:16', '--ratio=4:3', '--ratio=1:1']);
});

test('direct sheet wrapper rejects settings unequal to the card before force', (t) => {
  const f = imageProject(t);
  const card = sheet(f, '01');
  const target = card.replace('assets/', 'assets/images/').replace('.md', '.png');
  f.write(target, 'old');
  const parsed = JSON.parse(f.cli('storyboard-sheet-to-prompt.sh', ['--json', card]).stdout);
  const result = f.cli('image-gen-dreamina.sh', ['--force', parsed.prompt, target, '16:9', '4k',
    'future-model', output, card]);
  assert.equal(result.status, 1);
  assert.equal(f.read(target), 'old');
  assert.equal(f.exists('calls'), false);
});

test('direct sheet wrapper checks prompt and ordered references before force', (t) => {
  const f = imageProject(t);
  const card = sheet(f, '01');
  const target = card.replace('assets/', 'assets/images/').replace('.md', '.png');
  const parsed = JSON.parse(f.cli('storyboard-sheet-to-prompt.sh', ['--json', card]).stdout);
  const valid = [parsed.prompt, target, '9:16', '4k', 'future-model', parsed.images.join(','), card];
  for (const [index, value] of [[0, 'different prompt'], [5, 'other.png']]) {
    f.write(target, 'old');
    const values = [...valid]; values[index] = value;
    assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...values]).status, 1);
    assert.equal(f.read(target), 'old');
    assert.equal(f.exists('calls'), false);
  }
});

test('sheet JSON exposes settings without changing the text protocol', (t) => {
  const f = imageProject(t);
  const card = sheet(f, '01');
  const json = f.cli('storyboard-sheet-to-prompt.sh', ['--json', card]);
  assert.equal(json.status, 0, json.stderr);
  const parsed = JSON.parse(json.stdout);
  assert.deepEqual(parsed.settings, settings);
  assert.equal(parsed.sourcePath, 'story/episodes/ep01/storyboard.md');
  assert.deepEqual(parsed.images, [output]);
  const text = f.cli('storyboard-sheet-to-prompt.sh', [card]);
  assert.equal(text.stdout, `IMAGES:${output}\n---\n${parsed.prompt}\n`);
});

test('sheet settings are unique active basic-info fields, not prompt or fenced text', (t) => {
  const f = imageProject(t);
  const card = sheet(f, '01');
  const valid = f.read(card);
  const line = '- 已解析图片比例：9:16';
  for (const text of [valid.replace(line, ''), valid.replace(line, `${line}\n${line}`),
    valid.replace(line, `\`\`\`\n${line}\n\`\`\``), valid.replace(line, '') + `\n${line}`,
    valid.replace('dreamina', 'unwired-provider')]) {
    f.write(card, text);
    assert.equal(f.cli('storyboard-sheet-to-prompt.sh', ['--json', card]).status, 1);
  }
});

test('later invalid sheet settings preserve every forced output with zero calls', (t) => {
  const f = imageProject(t);
  const cards = [sheet(f, '01'), sheet(f, '02', '')];
  const outputs = cards.map((p) => p.replace('assets/', 'assets/images/').replace('.md', '.png'));
  for (const p of outputs) f.write(p, 'old');
  const result = f.cli('generate-storyboard-sheets-dreamina.sh', ['--force', ...cards]);
  assert.equal(result.status, 1);
  assert.ok(outputs.every((p) => f.read(p) === 'old'));
  assert.equal(f.exists('calls'), false);
});

test('image rejects omitted, empty and extra settings before force deletion', (t) => {
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

test('missing source, target shot or Panel plan fails before any forced output removal', t => {
  const f = imageProject(t);
  const cards = [sheet(f, '01'), sheet(f, '02')];
  const outputs = cards.map(p => p.replace('assets/', 'assets/images/').replace('.md', '.png'));
  const board = 'story/episodes/ep01/storyboard.md';
  const source = f.read(board), valid = f.read(cards[1]);
  for (const change of ['source', 'shot', 'panel']) {
    f.write(board, source);
    f.write(cards[1], valid);
    for (const p of outputs) f.write(p, 'old');
    if (change === 'source') rmSync(`${f.root}/${board}`);
    if (change === 'shot') f.write(board, source.replace('### shot 2', '### shot 3'));
    if (change === 'panel') f.write(cards[1], valid.replace('## Panel 规划', '## Other'));
    const result = f.cli('generate-storyboard-sheets-dreamina.sh', ['--force', ...cards]);
    assert.equal(result.status, 1);
    assert.ok(outputs.every(p => f.read(p) === 'old'));
    assert.equal(f.exists('calls'), false);
  }
});

test('pending settings persist; legacy lookup/removal never fabricate settings', (t) => {
  const f = imageProject(t);
  const pending = 'assets/images/pending.json';
  f.write(pending, JSON.stringify([{ submit_id: 'legacy', asset_path: source, output_path: output }]));
  assert.equal(f.cli('image-pending-state.mjs', ['get', output]).stdout, `PENDING legacy ${source} ${output}\n`);
  assert.equal(JSON.parse(f.read(pending))[0].provider, undefined);
  assert.equal(f.cli('image-pending-state.mjs', ['remove', output]).status, 0);
  const result = f.cli('image-pending-state.mjs', ['upsert', 'new', source, output, 'basic-asset',
    'dreamina', 'future-model', '9:16', '4k']);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(f.read(pending)), [{ submit_id: 'new', asset_path: source,
    output_path: output, type: 'basic-asset', ...settings }]);
});

test('pending recovery settles recorded settings without consulting changed inputs', (t) => {
  const f = imageProject(t);
  const env = { EXPECTED_RECEIPT: receipt,
    RESPONSE: '{"gen_status":"querying","submit_id":"job-1"}' };
  assert.equal(f.cli('image-gen-dreamina.sh', args, env).status, 2);
  const before = f.read('calls');
  f.write(output, 'recovered PNG');
  assert.equal(f.cli('image-gen-dreamina.sh', ['--force', ...args], env).status, 2);
  assert.equal(f.read('calls'), before);
  assert.equal(f.read(output), 'recovered PNG');
  assert.equal(f.cli('image-generation-record.mjs', ['settle', output, 'done']).status, 0);
  const record = JSON.parse(f.read(receipt));
  assert.equal(record.status, 'done');
  assert.equal(record.submit_id, 'job-1');
  assert.equal(record.output_sha256, createHash('sha256').update('recovered PNG').digest('hex'));
  assert.deepEqual(Object.fromEntries(Object.keys(settings).map((k) => [k, record[k]])), settings);
});

test('failed and unknown image outcomes never claim a completed output', (t) => {
  const f = imageProject(t);
  for (const [response, status] of [['{"gen_status":"fail"}', 'failed'], ['network lost', 'unknown']]) {
    assert.equal(f.cli('image-gen-dreamina.sh', args,
      { EXPECTED_RECEIPT: receipt, RESPONSE: response }).status, 1);
    assert.equal(JSON.parse(f.read(receipt)).status, status);
    assert.equal(JSON.parse(f.read(receipt)).output_sha256, undefined);
  }
});
for (const status of ['success', 'querying']) test(`image receipt records ${status} and pre-submit settings`, (t) => {
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
