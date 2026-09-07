import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/asset-to-image-path.sh');

function convert(...paths) {
  return spawnSync('bash', [SCRIPT, ...paths], { encoding: 'utf8' });
}

test('rejects paths outside supported basic asset categories', () => {
  for (const file of ['assets/other/lamp.md', 'assets/items/lamp.png', 'lamp.md']) {
    const result = convert(file);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
  }
});

test('maps a building asset markdown path to its image path', () => {
  const result = convert('assets/buildings/hall.md');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    'assets/images/buildings/hall.png\n',
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
