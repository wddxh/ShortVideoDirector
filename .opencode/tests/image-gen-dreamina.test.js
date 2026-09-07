import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/image-gen-dreamina.sh');

function runImage({ refs = '', response, prompt = 'draw this', force = false,
  existing = false, source = 'assets/items/test.md', pending = null, corruptAfterProvider = false }) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-image-dreamina-'));
  const fake = join(dir, 'dreamina');
  const argsFile = join(dir, 'args');
  const callsFile = join(dir, 'calls');
  writeFileSync(fake, `#!/usr/bin/env bash
printf x >> "$DREAMINA_CALLS"
printf '%s\\0' "$@" > "$DREAMINA_ARGS"
[ "$CORRUPT_PENDING" = 1 ] && { mkdir -p assets/images; printf '{bad-json' > assets/images/pending.json; }
printf '%s\\n' "$DREAMINA_RESPONSE"
`);
  chmodSync(fake, 0o755);

  const output = join(dir, 'output.png');
  for (const ref of refs ? refs.split(',') : []) {
    const file = join(dir, ref);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'reference PNG');
  }
  if (existing) writeFileSync(output, 'old');
  if (pending !== null) {
    mkdirSync(join(dir, 'assets/images'), { recursive: true });
    writeFileSync(join(dir, 'assets/images/pending.json'), pending);
  }
  const result = spawnSync('bash', [
    SCRIPT, ...(force ? ['--force'] : []), prompt, output, '4:3', '2k', '4.0', refs,
    source,
  ], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      DREAMINA_ARGS: argsFile,
      DREAMINA_CALLS: callsFile,
      DREAMINA_RESPONSE: response,
      CORRUPT_PENDING: corruptAfterProvider ? '1' : '0',
    },
  });
  const args = readFileSync(argsFile).toString('utf8').split('\0').slice(0, -1);
  const rerun = () => spawnSync('bash', [
    SCRIPT, ...(force ? ['--force'] : []), prompt, output, '4:3', '2k', '4.0', refs,
    source,
  ], { cwd: dir, encoding: 'utf8', env: {
    ...process.env, PATH: `${dir}:${process.env.PATH}`, DREAMINA_ARGS: argsFile,
    DREAMINA_CALLS: callsFile, DREAMINA_RESPONSE: response,
    CORRUPT_PENDING: corruptAfterProvider ? '1' : '0',
  } });
  return { result, args, output, rerun,
    providerCalls: () => existsSync(callsFile) ? readFileSync(callsFile, 'utf8').length : 0,
    pendingPath: join(dir, 'assets/images/pending.json'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const QUERYING = '{"gen_status":"querying","submit_id":"image-123"}';

test('passes all 11 references as one image2image --images CSV argument', () => {
  const refs = Array.from({ length: 11 }, (_, i) => `assets/ref ${i + 1}.png`).join(',');
  const run = runImage({ refs, response: QUERYING });
  try {
    assert.equal(run.args[0], 'image2image');
    assert.equal(run.args[1], '--images');
    assert.equal(run.args[2], refs);
    assert.equal(run.args.filter(arg => arg === '--images').length, 1);
  } finally {
    run.cleanup();
  }
});

test('uses text2image when references are empty', () => {
  const run = runImage({ response: QUERYING });
  try {
    assert.equal(run.args[0], 'text2image');
    assert.equal(run.args.some(arg => arg === '--images'), false);
  } finally {
    run.cleanup();
  }
});

test('prints PENDING and the submit id for querying responses', () => {
  const run = runImage({ refs: 'reference.png', response: QUERYING });
  try {
    assert.equal(run.result.status, 2);
    assert.equal(run.result.stdout, 'PENDING image-123\n');
  } finally {
    run.cleanup();
  }
});

test('persists basic pending before returning exit 2', () => {
  const source = 'assets/characters/hero.md';
  const run = runImage({ response: QUERYING, source });
  try {
    assert.equal(run.result.status, 2, run.result.stderr);
    assert.equal(run.result.stdout, 'PENDING image-123\n');
    assert.deepEqual(JSON.parse(readFileSync(run.pendingPath, 'utf8')), [{
      submit_id: 'image-123', asset_path: source, output_path: run.output,
      type: 'basic-asset', provider: 'dreamina', model: '4.0', ratio: '4:3', resolution: '2k',
    }]);
    const rerun = run.rerun();
    assert.equal(rerun.status, 2);
    assert.equal(rerun.stdout, 'PENDING image-123\n');
    assert.equal(run.providerCalls(), 1);
  } finally {
    run.cleanup();
  }
});

test('pending persistence failure returns FAIL instead of PENDING', () => {
  const run = runImage({ response: QUERYING, source: 'assets/characters/hero.md',
    corruptAfterProvider: true });
  try {
    assert.equal(run.result.status, 1);
    assert.match(run.result.stdout, /^FAIL .*submit_id=image-123;/m);
    assert.doesNotMatch(run.result.stdout, /^PENDING /m);
  } finally {
    run.cleanup();
  }
});

test('force removes an existing target before a provider failure', () => {
  const run = runImage({ response: '{"gen_status":"fail","fail_reason":"rejected"}',
    force: true, existing: true });
  try {
    assert.equal(run.result.status, 1);
    assert.equal(run.args.includes('--prompt=draw this'), true);
    assert.equal(existsSync(run.output), false);
  } finally {
    run.cleanup();
  }
});

test('returns the provider fail reason unchanged', () => {
  const reason = 'provider rejected 11 references';
  const run = runImage({ response: `{"gen_status":"fail","fail_reason":"${reason}"}` });
  try {
    assert.equal(run.result.status, 1);
    assert.equal(run.result.stdout, `FAIL ${reason}\n`);
  } finally {
    run.cleanup();
  }
});

test('decodes escaped quotes in the provider fail reason', () => {
  const response = String.raw`{"gen_status":"fail","fail_reason":"provider rejected \"11 references\""}`;
  const run = runImage({ response });
  try {
    assert.equal(run.result.status, 1);
    assert.equal(run.result.stdout, 'FAIL provider rejected "11 references"\n');
  } finally {
    run.cleanup();
  }
});
