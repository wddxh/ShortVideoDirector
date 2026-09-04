import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/asset-to-image-path.sh');

function convert(...paths) {
  return spawnSync('bash', [SCRIPT, ...paths], { encoding: 'utf8' });
}

test('maps a storyboard sheet markdown path to its image path', () => {
  const result = convert('assets/storyboard-sheets/ep01/shot01.md');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    'assets/images/storyboard-sheets/ep01/shot01.png\n',
  );
});

test('preserves input order for ordinary, spaced, and CJK asset paths', () => {
  const result = convert(
    'assets/characters/alice.md',
    'assets/locations/夜 市 主街.md',
    '../../../assets/items/铜镜.md',
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trimEnd().split('\n'), [
    'assets/images/characters/alice.png',
    'assets/images/locations/夜 市 主街.png',
    'assets/images/items/铜镜.png',
  ]);
});
