import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/video-gen-dreamina.sh');
const QUERYING = '{"gen_status":"querying","submit_id":"video-456"}';

function runVideo({ images, response = QUERYING, prompt = 'animate this', locale = 'C' }) {
  const dir = mkdtempSync(join(tmpdir(), 'svd-video-dreamina-'));
  const fake = join(dir, 'dreamina');
  const argsFile = join(dir, 'args');
  writeFileSync(fake, `#!/usr/bin/env bash
printf '%s\\0' "$@" > "$DREAMINA_ARGS"
printf '%s\\n' "$DREAMINA_RESPONSE"
`);
  chmodSync(fake, 0o755);

  const env = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH}`,
    DREAMINA_ARGS: argsFile,
    DREAMINA_RESPONSE: response,
  };
  if (locale === null) {
    delete env.LC_ALL;
    delete env.LANG;
    delete env.LANGUAGE;
  } else {
    env.LC_ALL = locale;
  }
  const result = spawnSync('bash', [
    SCRIPT, prompt, join(dir, 'output.mp4'), images, '10', '16:9', 'test-model',
  ], {
    encoding: 'utf8',
    env,
  });
  const called = existsSync(argsFile);
  const args = called
    ? readFileSync(argsFile).toString('utf8').split('\0').slice(0, -1)
    : [];
  return { result, args, called, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function imageArguments(args) {
  const images = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--image') images.push(args[i + 1]);
  }
  return images;
}

test('turns CSV into repeated --image flags in sheet, character, location order', () => {
  const expected = [
    'assets/images/storyboard-sheets/ep01/shot01.png',
    'assets/images/characters/阿青.png',
    'assets/images/locations/night market.png',
  ];
  const run = runVideo({ images: expected.join(',') });
  try {
    assert.equal(run.args[0], 'multimodal2video');
    assert.deepEqual(imageArguments(run.args), expected);
  } finally {
    run.cleanup();
  }
});

test('preserves surrounding whitespace in non-empty image items', () => {
  const expected = [' sheet.png ', ' character.png '];
  const run = runVideo({ images: expected.join(',') });
  try {
    assert.deepEqual(imageArguments(run.args), expected);
  } finally {
    run.cleanup();
  }
});

test('passes all 11 images without truncating or reordering the first image', () => {
  const expected = Array.from({ length: 11 }, (_, i) => `reference-${i + 1}.png`);
  const run = runVideo({ images: expected.join(',') });
  try {
    assert.deepEqual(imageArguments(run.args), expected);
  } finally {
    run.cleanup();
  }
});

test('passes prompt quotes, spaces, and dollar signs unchanged', () => {
  const prompt = `camera says "go now" while '$VALUE' costs $5`;
  const run = runVideo({ images: 'sheet.png', prompt });
  try {
    assert.ok(run.args.includes(`--prompt=${prompt}`));
  } finally {
    run.cleanup();
  }
});

test('passes a multiline prompt as one argument unchanged', () => {
  const prompt = 'first line with spaces\nsecond line says "$VALUE"';
  const run = runVideo({ images: 'sheet.png', prompt });
  try {
    assert.ok(run.args.includes(`--prompt=${prompt}`));
  } finally {
    run.cleanup();
  }
});

test('prints SUBMITTED and the submit id', () => {
  const run = runVideo({ images: 'sheet.png' });
  try {
    assert.equal(run.result.status, 0);
    assert.equal(run.result.stdout, 'SUBMITTED video-456\n');
  } finally {
    run.cleanup();
  }
});

test('parses the provider response when locale variables are absent', () => {
  const run = runVideo({ images: 'sheet.png', locale: null });
  try {
    assert.equal(run.result.status, 0);
    assert.equal(run.result.stdout, 'SUBMITTED video-456\n');
  } finally {
    run.cleanup();
  }
});

test('returns the provider fail reason unchanged', () => {
  const reason = 'provider quota exceeded: retry later';
  const run = runVideo({
    images: 'sheet.png',
    response: `{"gen_status":"fail","fail_reason":"${reason}"}`,
  });
  try {
    assert.equal(run.result.status, 1);
    assert.equal(run.result.stdout, `FAIL ${reason}\n`);
  } finally {
    run.cleanup();
  }
});

test('decodes escaped quotes in the provider fail reason under another locale', () => {
  const response = String.raw`{"gen_status":"fail","fail_reason":"provider rejected \"11 references\""}`;
  const run = runVideo({ images: 'sheet.png', response, locale: 'C' });
  try {
    assert.equal(run.result.status, 1);
    assert.equal(run.result.stdout, 'FAIL provider rejected "11 references"\n');
  } finally {
    run.cleanup();
  }
});

test('rejects an empty image list without calling the provider', () => {
  const run = runVideo({ images: '' });
  try {
    assert.equal(run.result.status, 1);
    assert.equal(run.result.stdout, 'FAIL images list is empty\n');
    assert.equal(run.called, false);
  } finally {
    run.cleanup();
  }
});

for (const images of [',', ',a.png', 'a.png,', 'a.png,,b.png']) {
  test(`rejects CSV with an empty image item: ${JSON.stringify(images)}`, () => {
    const run = runVideo({ images });
    try {
      assert.equal(run.result.status, 1);
      assert.equal(run.result.stdout, 'FAIL images list is empty\n');
      assert.equal(run.called, false);
    } finally {
      run.cleanup();
    }
  });
}

test('uses no GNU grep PCRE or C.UTF-8 locale dependency', () => {
  const source = readFileSync(SCRIPT, 'utf8');

  assert.doesNotMatch(source, /\bgrep\b[^\n]*-[A-Za-z]*P/);
  assert.equal(source.includes('C.UTF-8'), false);
});
