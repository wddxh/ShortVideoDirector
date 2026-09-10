import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { pathToFileURL } from 'node:url';
import { startRound, addInput, finishRound } from '../../scripts/review-round.mjs';
import { checkTarget, fingerprintInputs, readRounds, requiredInputs } from '../../scripts/review-evidence.mjs';

const cli = path.resolve('scripts/review-round.mjs');
const ep = 'story/episodes/ep01', card = 'assets/items/a.md';
const image = 'assets/images/items/a.png', task = `${ep}/task-inputs/task01.json`;
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const board = n => `### shot ${n}\n- \u89c6\u9891\u98ce\u683c\uff1aRealistic\n- \u65f6\u957f\uff1a5s\n- \u5f15\u7528\u8d44\u4ea7\uff1a[a](${card})\n**\u753b\u9762\u4e0e\u58f0\u97f3\u63cf\u8ff0\uff1a**\nAction\n`;
const manifest = shots => JSON.stringify({ shots, prompt: 'Final camera move; hold on the subject.\n', references: [{ kind: 'local', media: 'video',
  path: 'references/motion.mp4', use: 'Camera', sources: ['references/scene.blend'] }] });

async function fixture(run) {
  const work = fs.mkdtempSync('/tmp/opencode/review-round-test-');
  const cwd = process.cwd(), config = process.env.SVD_CONFIG;
  const root = path.join(work, 'project');
  fs.mkdirSync(root);
  process.chdir(root);
  process.env.SVD_CONFIG = 'custom.md';
  try {
    for (const file of ['custom.md', 'config.md', card, image, `${ep}/script.md`,
      'references/motion.mp4', 'references/scene.blend']) write(file, file);
    write(`${ep}/storyboard.md`, board(1));
    write(task, manifest([1]));
    const state = path.join(work, 'state.json'), payload = path.join(work, 'payload.json');
    const finish = (result = { status: 'pass', blockers: [] }, commentary = 'Assessment') => {
      write(payload, JSON.stringify({ result, commentary }));
      return finishRound(state, payload);
    };
    const command = args => spawnSync('node', [cli, ...args], { encoding: 'utf8' });
    await run({ work, root, state, payload, finish, command });
  } finally {
    process.chdir(cwd);
    if (config === undefined) delete process.env.SVD_CONFIG;
    else process.env.SVD_CONFIG = config;
    fs.rmSync(work, { recursive: true, force: true });
  }
}

for (const [kind, target] of [['script', `${ep}/script.md`], ['storyboard', `${ep}/storyboard.md`],
  ['asset-prompt', card], ['asset-visual', card], ['shot-input', task]]) {
  test(`${kind}: unfinished then explicit pass uses existing per-target schema`, t => fixture(f => {
    let elapsed = performance.now();
    const started = startRound(kind, 'ep01', target, f.state);
    elapsed = performance.now() - elapsed;
    assert.equal(checkTarget(kind, target, 'ep01', 'custom.md').status, 'unknown');
    assert.equal(readRounds(fs.readFileSync(started.path, 'utf8'), kind).at(-1).complete, false);
    write(f.payload, JSON.stringify({ result: { status: 'pass', blockers: [] } }));
    const finishStart = performance.now();
    const result = finishRound(f.state, f.payload);
    const finishMs = performance.now() - finishStart;
    t.diagnostic(`helper-only temp timing: start=${elapsed.toFixed(3)}ms finish=${finishMs.toFixed(3)}ms inputs=${result.input_count}`);
    assert.equal(result.status, 'pass');
    assert.equal(checkTarget(kind, target, 'ep01', 'custom.md').status, 'pass');
    assert.equal(JSON.stringify(result).includes('sha256'), false);
    assert.deepEqual([...result.paths].sort(), requiredInputs(kind, target, 'custom.md').sort());
  }));
}

test('prompt-only edit during a shot-input round preserves its first hash and publishes unknown', () => fixture(f => {
  startRound('shot-input', 'ep01', task, f.state);
  const first = JSON.parse(fs.readFileSync(f.state)).inputs;
  assert.deepEqual(first.find(input => input.path === task), fingerprintInputs([task])[0]);
  const changed = JSON.parse(fs.readFileSync(task));
  changed.prompt = 'Revised final camera move.\n';
  write(task, JSON.stringify(changed));
  addInput(f.state, [task]);
  const result = f.finish();
  assert.equal(result.status, 'unknown');
  assert.ok(result.evidence_issues.includes(`Input changed: ${task}`));
  const record = readRounds(fs.readFileSync(result.path, 'utf8'), 'shot-input').at(-1).results[0];
  assert.deepEqual(record.inputs, first);
  assert.equal(checkTarget('shot-input', task, 'ep01', 'custom.md').status, 'unknown');
}));

test('starting from a draft cannot retroactively pass after the final prompt is added', () => fixture(f => {
  const draft = JSON.parse(fs.readFileSync(task));
  delete draft.prompt;
  write(task, JSON.stringify(draft));
  const started = startRound('shot-input', 'ep01', task, f.state);
  const first = JSON.parse(fs.readFileSync(f.state)).inputs;
  assert.ok(started.evidence_issues.length);
  assert.deepEqual(first.find(input => input.path === task), fingerprintInputs([task])[0]);
  write(task, JSON.stringify({ ...draft, prompt: 'Final camera move.\n' }));
  addInput(f.state, [task]);
  const result = f.finish();
  assert.equal(result.status, 'unknown');
  for (const issue of started.evidence_issues) assert.ok(result.evidence_issues.includes(issue));
  const record = readRounds(fs.readFileSync(result.path, 'utf8'), 'shot-input').at(-1).results[0];
  assert.deepEqual(record.inputs.find(input => input.path === task), first.find(input => input.path === task));
  assert.equal(checkTarget('shot-input', task, 'ep01', 'custom.md').status, 'unknown');
}));

test('extras preserve first snapshots, changes and failed captures survive restoration', () => fixture(f => {
  write('references/extra.md', 'first');
  startRound('asset-prompt', 'ep01', card, f.state, ['references/extra.md']);
  const first = JSON.parse(fs.readFileSync(f.state)).inputs;
  addInput(f.state, ['references/extra.md']);
  write('references/extra.md', 'second');
  const changed = addInput(f.state, ['references/extra.md', 'references/missing.md']);
  assert.equal(changed.evidence_issues.length, 2);
  write('references/extra.md', 'first');
  write('references/missing.md', 'now present');
  addInput(f.state, ['references/missing.md']);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.state)).inputs, first);
  const result = f.finish({ status: 'needs_revision', blockers: ['Composition'],
    reason: 'Reason', issue: 'Issue', prompt_direction: 'Direction', asset: card,
    image, visual_inspection: { inspected: true }, detail: { score: 3 } }, 'Full commentary');
  assert.equal(result.status, 'unknown');
  const text = fs.readFileSync(result.path, 'utf8');
  assert.ok(text.includes('Full commentary'));
  const record = readRounds(text, 'asset-prompt').at(-1).results[0];
  assert.deepEqual(record.inputs, first);
  assert.ok(record.blockers.includes('Composition'));
  assert.deepEqual(record.detail, { score: 3 });
  assert.deepEqual(record.visual_inspection, { inspected: true });
  assert.equal(record.prompt_direction, 'Direction');
}));

test('extras added before reading pass; deletion at finish forces unknown', t => fixture(f => {
  startRound('script', 'ep01', `${ep}/script.md`, f.state);
  write('references/extra.md', 'extra');
  const started = performance.now();
  const added = addInput(f.state, ['references/extra.md']);
  t.diagnostic(`helper-only temp timing: add-input=${(performance.now() - started).toFixed(3)}ms inputs=${added.input_count}`);
  assert.ok(added.paths.includes('references/extra.md'));
  fs.unlinkSync('references/extra.md');
  const result = f.finish();
  assert.equal(result.status, 'unknown');
  assert.ok(result.evidence_issues.some(issue => issue.includes('references/extra.md')));
}));

test('missing target allows unknown; a later file does not refresh failed first capture', () => fixture(f => {
  fs.unlinkSync(card);
  const start = startRound('asset-visual', 'ep01', card, f.state);
  assert.ok(start.paths.includes(image));
  assert.ok(start.evidence_issues.length);
  write(card, 'returned');
  addInput(f.state, [card]);
  const result = f.finish({ status: 'unknown', blockers: [], reason: 'Unavailable' });
  assert.equal(result.status, 'unknown');
  assert.ok(!result.paths.includes(card));
  fs.unlinkSync(card);
  const missing = path.join(f.work, 'missing.json');
  startRound('asset-prompt', 'ep01', card, missing);
  assert.equal(finishRound(missing, f.payload).status, 'unknown');
}));

test('custom configuration and project root stay bound across commands', () => fixture(f => {
  startRound('asset-prompt', 'ep01', card, f.state);
  process.env.SVD_CONFIG = 'config.md';
  write('config.md', 'changed unrelated default');
  assert.equal(f.finish().status, 'pass');
  assert.equal(checkTarget('asset-prompt', card, 'ep01', 'custom.md').status, 'pass');
  assert.equal(checkTarget('asset-prompt', card, 'ep01', 'config.md').status, 'unknown');
  const elsewhere = path.join(f.work, 'other');
  fs.mkdirSync(elsewhere);
  process.chdir(elsewhere);
  assert.throws(() => addInput(f.state, ['config.md']), /binding mismatch/);
  process.chdir(f.root);
}));

for (const replacement of ['same-bytes', 'different-bytes', 'external', 'missing']) {
  test(`bound config replacement ${replacement} is assessed as evidence`, () => fixture(f => {
    startRound('asset-prompt', 'ep01', card, f.state);
    const first = JSON.parse(fs.readFileSync(f.state)).inputs;
    const external = path.join(f.work, 'external.md');
    write(external, 'outside bytes must not be read');
    write('replacement.md', replacement === 'same-bytes' ? 'custom.md' : 'changed');
    fs.unlinkSync('custom.md');
    if (replacement !== 'missing') fs.symlinkSync(
      replacement === 'external' ? external : 'replacement.md', 'custom.md');
    const read = fs.readFileSync;
    let externalReads = 0;
    fs.readFileSync = function(file, ...args) {
      if (fs.realpathSync(file) === external) {
        externalReads++;
        throw new Error('External config read attempted');
      }
      return read.call(this, file, ...args);
    };
    let result;
    try {
      addInput(f.state, [image]);
      result = f.finish({ status: 'needs_revision', blockers: ['Framing'], reason: 'Keep findings' });
    } finally { fs.readFileSync = read; }
    assert.equal(externalReads, 0);
    assert.equal(result.status, replacement === 'same-bytes' ? 'needs_revision' : 'unknown');
    assert.equal(result.evidence_issues.length === 0, replacement === 'same-bytes');
    const text = fs.readFileSync(result.path, 'utf8');
    const record = readRounds(text, 'asset-prompt').at(-1).results[0];
    assert.deepEqual(record.inputs.slice(0, first.length), first);
    assert.ok(record.blockers.includes('Framing'));
    assert.equal(record.reason, 'Keep findings');
    assert.ok(text.includes('Assessment'));
    assert.equal(JSON.parse(fs.readFileSync(f.state)).config, 'custom.md');
  }));
}

test('stored config syntax still rejects noncanonical project paths', () => fixture(f => {
  const start = startRound('asset-prompt', 'ep01', card, f.state);
  const bytes = fs.readFileSync(start.path);
  const state = JSON.parse(fs.readFileSync(f.state));
  for (const config of [null, '', '/tmp/config.md', '../config.md', './custom.md',
    'a//b.md', 'a/../custom.md', 'a\\b.md', 'custom.md\n']) {
    write(f.state, JSON.stringify({ ...state, config }));
    assert.throws(() => f.finish(), /binding mismatch/);
    assert.deepEqual(fs.readFileSync(start.path), bytes);
  }
}));

test('payload requires judgment, rejects owned fields and reserved parser delimiters', () => fixture(f => {
  const start = startRound('asset-prompt', 'ep01', card, f.state);
  const bytes = fs.readFileSync(start.path);
  for (const result of [{ blockers: [] }, { status: 'pass' }, { status: 'ok', blockers: [] },
    { status: 'pass', blockers: ['blocking'] }, { status: 'unknown', blockers: [3] },
    ...['inputs', 'target', 'kind', 'scope', 'results', 'complete', 'sha256', 'evidence_issues']
      .map(key => ({ status: 'pass', blockers: [], [key]: [] }))]) {
    assert.throws(() => f.finish(result));
    assert.deepEqual(fs.readFileSync(start.path), bytes);
  }
  for (const text of ['## \u7b2c 2 \u8f6e', '<!-- svd-review-evidence -->', '<!-- /round-1 -->']) {
    assert.throws(() => f.finish({ status: 'pass', blockers: [], reason: text }), /delimiter/);
    assert.throws(() => f.finish({ status: 'pass', blockers: [] }, text), /delimiter/);
  }
  write(f.payload, JSON.stringify({ result: { status: 'pass', blockers: [] }, target: card }));
  assert.throws(() => finishRound(f.state, f.payload), /payload/);
  assert.equal(f.finish({ status: 'needs_revision', blockers: ['Fix'] }).status, 'needs_revision');
}));

test('late required inputs are not retroactively captured and semantic findings survive', () => fixture(f => {
  startRound('asset-prompt', 'ep01', card, f.state);
  write('references/layout.png', 'PNG');
  write(card, '## \u672c\u5730\u5236\u4f5c\u53c2\u8003\n```json\n' + JSON.stringify({
    images: ['references/layout.png'], sources: ['references/scene.blend'],
  }) + '\n```\n');
  const result = f.finish({ status: 'needs_revision', blockers: ['Fix framing'] });
  assert.equal(result.status, 'unknown');
  assert.ok(result.evidence_issues.includes('Required input was not captured: references/layout.png'));
  assert.ok(!result.paths.includes('references/layout.png'));
}));

test('max round allocation preserves arbitrary earlier bytes and interrupted rounds', () => fixture(f => {
  const file = 'reviews/ep01/assets/items/a.asset-prompt.md';
  const prefix = Buffer.concat([Buffer.from([0xff]), Buffer.from('\n## \u7b2c 9 \u8f6e\nunfinished\n## \u7b2c 2 \u8f6e\n')]);
  write(file, prefix);
  assert.equal(startRound('asset-prompt', 'ep01', card, f.state).round, 10);
  const started = fs.readFileSync(file);
  assert.deepEqual(started.subarray(0, prefix.length), prefix);
  assert.throws(() => startRound('asset-prompt', 'ep01', card, f.state), /exists/);
  assert.deepEqual(fs.readFileSync(file), started);
  f.finish();
  assert.deepEqual(fs.readFileSync(file).subarray(0, prefix.length), prefix);
  assert.throws(() => f.finish(), /Stale/);
  assert.throws(() => addInput(f.state, [card]), /Stale/);
}));

test('opening another round immediately supersedes an old pass without rewriting it', () => fixture(f => {
  const first = startRound('asset-prompt', 'ep01', card, f.state);
  f.finish();
  const previous = fs.readFileSync(first.path);
  assert.equal(checkTarget('asset-prompt', card, 'ep01', 'custom.md').status, 'pass');
  const next = startRound('asset-prompt', 'ep01', card, path.join(f.work, 'next.json'));
  assert.equal(next.round, 2);
  assert.equal(checkTarget('asset-prompt', card, 'ep01', 'custom.md').status, 'unknown');
  assert.deepEqual(fs.readFileSync(first.path).subarray(0, previous.length), previous);
}));

test('start detects an external review edit made during input discovery', () => fixture(f => {
  const file = 'reviews/ep01/assets/items/a.asset-prompt.md';
  write(file, 'earlier');
  const read = fs.readFileSync;
  fs.readFileSync = function(input, ...args) {
    if (path.resolve(input) === path.resolve(card)) fs.writeFileSync(file, 'external');
    return read.call(this, input, ...args);
  };
  try { assert.throws(() => startRound('asset-prompt', 'ep01', card, f.state), /changed while starting/); }
  finally { fs.readFileSync = read; }
  assert.equal(fs.readFileSync(file, 'utf8'), 'external');
  assert.equal(fs.existsSync(f.state), false);
}));

test('new rounds and external edits reject stale state without overwriting either target', () => fixture(f => {
  const first = startRound('asset-prompt', 'ep01', card, f.state);
  const next = startRound('asset-prompt', 'ep01', card, path.join(f.work, 'next.json'));
  assert.equal(next.round, first.round + 1);
  const bytes = fs.readFileSync(first.path);
  assert.throws(() => f.finish(), /Stale/);
  assert.deepEqual(fs.readFileSync(first.path), bytes);
  fs.appendFileSync(first.path, 'external edit');
  write(f.payload, JSON.stringify({ result: { status: 'pass', blockers: [] } }));
  assert.throws(() => finishRound(path.join(f.work, 'next.json'), f.payload), /Stale/);
  const other = 'assets/items/b.md';
  write(other, 'other');
  const b = startRound('asset-prompt', 'ep01', other, path.join(f.work, 'b.json'));
  finishRound(path.join(f.work, 'b.json'), f.payload);
  const bBytes = fs.readFileSync(b.path);
  write(card, 'changed');
  assert.equal(checkTarget('asset-prompt', other, 'ep01', 'custom.md').status, 'pass');
  assert.deepEqual(fs.readFileSync(b.path), bBytes);
}));

test('write paths reject escapes, symlink/hardlink aliases and source overwrites', () => fixture(f => {
  for (const state of [card, path.resolve(card), '/tmp/opencode/state.json', `${f.work}/../escape.json`]) {
    assert.throws(() => startRound('asset-prompt', 'ep01', card, state));
  }
  fs.symlinkSync(f.root, path.join(f.work, 'link'));
  assert.throws(() => startRound('asset-prompt', 'ep01', card, path.join(f.work, 'link/state.json')), /Aliased/);
  fs.symlinkSync(f.work, 'reviews');
  assert.throws(() => startRound('asset-prompt', 'ep01', card, f.state), /Aliased/);
  fs.unlinkSync('reviews');
  const start = startRound('asset-prompt', 'ep01', card, f.state);
  assert.throws(() => finishRound(f.state, f.state), /alias/);
  fs.linkSync(card, f.payload);
  assert.throws(() => finishRound(f.state, f.payload), /Aliased/);
  fs.unlinkSync(f.payload);
  fs.symlinkSync(path.resolve(card), f.payload);
  assert.throws(() => finishRound(f.state, f.payload), /Aliased/);
  fs.unlinkSync(f.payload);
  assert.throws(() => addInput(f.state, [start.path]), /own input/);
  fs.symlinkSync(path.resolve(start.path), 'review-alias.md');
  assert.throws(() => addInput(f.state, ['review-alias.md']), /aliases/);
  assert.equal(fs.readFileSync(card, 'utf8'), card);
}));

test('discovery snapshots target and referenced cards before their first substantive read', () => fixture(f => {
  write('references/layout.png', 'layout');
  write(card, '## \u672c\u5730\u5236\u4f5c\u53c2\u8003\n```json\n' + JSON.stringify({
    images: ['references/layout.png'], sources: ['references/scene.blend'],
  }) + '\n```\n');
  const captured = new Set(), reads = [], read = fs.readFileSync;
  fs.readFileSync = function(file, ...args) {
    const relative = path.relative(process.cwd(), file);
    reads.push(relative);
    assert.ok(captured.has(relative), `Read before snapshot hook: ${relative}`);
    return read.call(this, file, ...args);
  };
  try {
    const inputs = requiredInputs('shot-input', task, 'custom.md', file => captured.add(file));
    assert.ok(inputs.includes('references/layout.png'));
    assert.ok(reads.includes(card));
    assert.ok(reads.includes(task));
  } finally { fs.readFileSync = read; }
  const result = startRound('shot-input', 'ep01', task, f.state);
  assert.ok(result.paths.includes('references/layout.png'));
  assert.equal(f.finish().status, 'pass');
}));

test('unselected task declarations and media are not evidence dependencies', () => fixture(f => {
  write(`${ep}/storyboard.md`, board(1) + '\n' + board(2));
  const other = `${ep}/task-inputs/task02.json`;
  write(other, JSON.stringify({ shots: [2], references: [{ unselected: 'invalid media' }] }));
  const start = startRound('shot-input', 'ep01', task, f.state);
  assert.ok(!start.paths.includes(other));
  write(other, JSON.stringify({ shots: [2], references: [] }));
  assert.equal(f.finish().status, 'pass');
  assert.equal(checkTarget('shot-input', task, 'ep01', 'custom.md').status, 'pass');
}));

test('discovery failure retains captured media and allows unknown publication', () => fixture(f => {
  fs.unlinkSync('references/scene.blend');
  const start = startRound('shot-input', 'ep01', task, f.state);
  assert.ok(start.paths.includes(image));
  assert.ok(start.paths.includes('references/motion.mp4'));
  assert.ok(start.evidence_issues.some(issue => issue.includes('discovery failed')));
  assert.equal(f.finish().status, 'unknown');
}));

test('CLI compact output and exit codes distinguish publication from invalid calls', () => fixture(f => {
  assert.equal(f.command([]).status, 1);
  delete process.env.SVD_CONFIG;
  assert.equal(f.command(['start', 'asset-prompt', 'ep01', card, f.state]).status, 1);
  process.env.SVD_CONFIG = 'custom.md';
  const start = f.command(['start', 'asset-prompt', 'ep01', card, f.state, image]);
  assert.equal(start.status, 0, start.stderr);
  assert.deepEqual(Object.keys(JSON.parse(start.stdout)),
    ['path', 'round', 'state', 'input_count', 'paths', 'evidence_issues']);
  assert.equal(f.command(['add-input', f.state, 'references/scene.blend']).status, 0);
  for (const status of ['needs_revision', 'unknown']) {
    const state = path.join(f.work, `${status}.json`);
    assert.equal(f.command(['start', 'asset-prompt', 'ep01', card, state]).status, 0);
    write(f.payload, JSON.stringify({ result: { status, blockers: ['Finding'] } }));
    const result = f.command(['finish', state, f.payload]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, status);
    assert.ok(!result.stdout.includes('sha256'));
    assert.equal(f.command(['finish', state, f.payload]).status, 1);
  }
}));

test('short lock rejects contention without changing evidence and is released on error', () => fixture(f => {
  const start = startRound('asset-prompt', 'ep01', card, f.state);
  const bytes = fs.readFileSync(start.path);
  write(`${start.path}.lock`, 'busy');
  assert.throws(() => f.finish(), /lock exists/);
  assert.deepEqual(fs.readFileSync(start.path), bytes);
  fs.unlinkSync(`${start.path}.lock`);
  assert.throws(() => f.finish({}), /Explicit/);
  assert.ok(!fs.existsSync(`${start.path}.lock`));
  assert.equal(f.finish().status, 'pass');
}));

test('SIGKILL leaves owner lock for manual reconciliation and preserves evidence', { timeout: 10000 }, () => fixture(async f => {
  const start = startRound('asset-prompt', 'ep01', card, f.state);
  const bytes = fs.readFileSync(start.path), stateBytes = fs.readFileSync(f.state);
  write(f.payload, JSON.stringify({ result: { status: 'pass', blockers: [] } }));
  const child = spawn('node', ['--input-type=module', '-e', `
    import fs from 'node:fs';
    import { finishRound } from ${JSON.stringify(pathToFileURL(cli).href)};
    const read = fs.readFileSync;
    fs.readFileSync = function(file, ...args) {
      if (file === ${JSON.stringify(path.resolve(card))}) {
        process.send('locked');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      }
      return read.call(this, file, ...args);
    };
    finishRound(${JSON.stringify(f.state)}, ${JSON.stringify(f.payload)});
  `], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const closed = once(child, 'close');
  try {
    await once(child, 'message', { signal: AbortSignal.timeout(5000) });
    assert.deepEqual(JSON.parse(fs.readFileSync(`${start.path}.lock`)), { pid: child.pid });
    child.kill('SIGKILL');
    assert.deepEqual(await closed, [null, 'SIGKILL']);
    const result = f.command(['finish', f.state, f.payload]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /active or interrupted owner/);
    assert.match(result.stderr, /owner PID.*manually/);
    assert.deepEqual(fs.readFileSync(start.path), bytes);
    assert.deepEqual(fs.readFileSync(f.state), stateBytes);
    assert.deepEqual(JSON.parse(fs.readFileSync(`${start.path}.lock`)), { pid: child.pid });
    // Explicit test-owner reconciliation, never helper-driven stale-lock removal.
    fs.unlinkSync(`${start.path}.lock`);
    assert.equal(f.finish().status, 'pass');
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  }
}));

test('publication renames a complete validated file; failed rename preserves open bytes', () => fixture(f => {
  const start = startRound('asset-prompt', 'ep01', card, f.state);
  const opened = fs.readFileSync(start.path);
  const rename = fs.renameSync;
  fs.renameSync = function(from, to) {
    assert.deepEqual(fs.readFileSync(to), opened);
    assert.equal(readRounds(fs.readFileSync(from, 'utf8'), 'asset-prompt').at(-1).complete, true);
    throw new Error('simulated publication failure');
  };
  try { assert.throws(() => f.finish(), /publication failure/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual(fs.readFileSync(start.path), opened);
  assert.deepEqual(fs.readdirSync(path.dirname(start.path)), ['a.asset-prompt.md']);
  assert.equal(f.finish().status, 'pass');
}));

test('beforeRead captures the selected final prompt before manifest discovery can change it', () => fixture(f => {
  const first = fingerprintInputs([task])[0];
  const changed = JSON.parse(fs.readFileSync(task));
  changed.prompt = 'Changed after snapshot, before substantive manifest read.\n';
  const read = fs.readFileSync;
  let mutated = false;
  fs.readFileSync = function(file, encoding, ...args) {
    if (path.resolve(file) === path.resolve(task) && encoding === undefined && !mutated) {
      const bytes = read.call(this, file, encoding, ...args);
      fs.writeFileSync(task, JSON.stringify(changed));
      mutated = true;
      return bytes;
    }
    return read.call(this, file, encoding, ...args);
  };
  try { startRound('shot-input', 'ep01', task, f.state); }
  finally { fs.readFileSync = read; }
  assert.ok(mutated);
  const result = f.finish();
  assert.equal(result.status, 'unknown');
  assert.ok(result.evidence_issues.includes(`Input changed: ${task}`));
  const record = readRounds(fs.readFileSync(result.path, 'utf8'), 'shot-input').at(-1).results[0];
  assert.deepEqual(record.inputs.find(input => input.path === task), first);
}));

test('snapshot stays first even if a discovery read changes a referenced card', () => fixture(f => {
  const original = fs.readFileSync(card);
  const read = fs.readFileSync;
  let mutated = false;
  fs.readFileSync = function(file, encoding, ...args) {
    if (path.resolve(file) === path.resolve(card) && encoding === undefined && !mutated) {
      const first = read.call(this, file, encoding, ...args);
      fs.writeFileSync(card, 'changed during discovery');
      mutated = true;
      return first;
    }
    return read.call(this, file, encoding, ...args);
  };
  try { startRound('shot-input', 'ep01', task, f.state); }
  finally { fs.readFileSync = read; }
  assert.ok(mutated);
  const result = f.finish();
  assert.equal(result.status, 'unknown');
  assert.ok(result.evidence_issues.includes(`Input changed: ${card}`));
  assert.notDeepEqual(fs.readFileSync(card), original);
}));

test('simultaneous starts serialize or report locks; simultaneous finishes publish only once', () => fixture(async f => {
  const run = args => new Promise((resolve, reject) => {
    const child = spawn('node', [cli, ...args]);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', status => resolve({ status, stdout, stderr }));
  });
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) =>
    run(['start', 'asset-prompt', 'ep01', card, path.join(f.work, `parallel-${i}.json`)])));
  const successes = results.filter(r => r.status === 0).map(r => JSON.parse(r.stdout));
  assert.ok(successes.length);
  assert.equal(new Set(successes.map(r => r.round)).size, successes.length);
  for (const result of results.filter(r => r.status !== 0)) assert.match(result.stderr, /lock exists/);
  const latest = successes.sort((a, b) => a.round - b.round).at(-1);
  write(f.payload, JSON.stringify({ result: { status: 'pass', blockers: [] } }));
  const finished = await Promise.all([1, 2].map(() => run(['finish', latest.state, f.payload])));
  assert.equal(finished.filter(r => r.status === 0).length, 1);
  assert.match(finished.find(r => r.status !== 0).stderr, /lock exists|Stale/);
  assert.equal(checkTarget('asset-prompt', card, 'ep01', 'custom.md').status, 'pass');
}));
