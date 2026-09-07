import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/latest-episode.sh');
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'svd-latest-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return { cwd, run: () => spawnSync('bash', [script], { cwd, encoding: 'utf8' }) };
}

for (const obstruction of ['story', 'story/episodes']) {
  test(`a file at ${obstruction} is an error, not a new series`, t => {
    const { cwd, run } = fixture(t);
    if (obstruction.includes('/')) mkdirSync(join(cwd, 'story'));
    writeFileSync(join(cwd, obstruction), 'blocked');
    const result = run();
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /ERROR:/);
  });
}

test('absent and empty episode trees return no episodes, not an error', t => {
  const { cwd, run } = fixture(t);
  for (const directory of ['', 'story', 'story/episodes']) {
    if (directory) mkdirSync(join(cwd, directory));
    const result = run();
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  }
});

test('selects the numeric latest directory even when episodes contain no files', t => {
  const { cwd, run } = fixture(t);
  for (const ep of ['ep09', 'ep100', 'ep02']) {
    mkdirSync(join(cwd, 'story/episodes', ep), { recursive: true });
  }
  writeFileSync(join(cwd, 'story/episodes/ep999'), 'not a directory');
  const result = run();
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ep100\n');
  assert.equal(result.stderr, '');
});

test('an invalid episode directory cannot become a usable target', t => {
  const { cwd, run } = fixture(t);
  mkdirSync(join(cwd, 'story/episodes/ep-backup'), { recursive: true });
  const result = run();
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ERROR: Invalid episode directory:/);
});
