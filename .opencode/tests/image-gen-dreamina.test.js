import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/image-gen-dreamina.sh');

function runImage({ refs = '', response, prompt = 'draw this' }) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-image-dreamina-'));
  const fake = join(dir, 'dreamina');
  const argsFile = join(dir, 'args');
  writeFileSync(fake, `#!/usr/bin/env bash
printf '%s\\0' "$@" > "$DREAMINA_ARGS"
printf '%s\\n' "$DREAMINA_RESPONSE"
`);
  chmodSync(fake, 0o755);

  const result = spawnSync('bash', [
    SCRIPT, prompt, join(dir, 'output.png'), '4:3', '2k', '4.0', refs,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      DREAMINA_ARGS: argsFile,
      DREAMINA_RESPONSE: response,
    },
  });
  const args = readFileSync(argsFile).toString('utf8').split('\0').slice(0, -1);
  return { result, args, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
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
