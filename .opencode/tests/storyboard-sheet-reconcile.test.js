import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const SCRIPT = join(process.cwd(), 'scripts/reconcile-storyboard-sheet-images.sh');

function write(root, path) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'fixture');
}

test('removes orphan PNGs and returns canonical missing cards in shot order', () => {
  const root = mkdtempSync(join(tmpdir(), 'svd-sheet-reconcile-'));
  try {
    for (const shot of [1, 2]) write(root, `assets/storyboard-sheets/ep01/shot0${shot}.md`);
    write(root, 'assets/images/storyboard-sheets/ep01/shot01.png');
    write(root, 'assets/images/storyboard-sheets/ep01/shot03.png');
    const result = spawnSync('bash', [SCRIPT, 'ep01'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, 'removed: shot03\nmissing cards: assets/storyboard-sheets/ep01/shot02.md\n');
    assert.equal(existsSync(join(root, 'assets/images/storyboard-sheets/ep01/shot03.png')), false);
    assert.equal(existsSync(join(root, 'assets/images/storyboard-sheets/ep01/shot01.png')), true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
