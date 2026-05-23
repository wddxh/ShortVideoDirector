import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';

function grepCount(pattern, paths) {
  const res = spawnSync('grep', ['-rlnE', pattern, ...paths], { encoding: 'utf8' });
  if (res.status === 1) return 0; // 无匹配
  if (res.status !== 0) throw new Error(`grep failed: ${res.stderr}`);
  return res.stdout.trim().split('\n').filter(Boolean).length;
}

test('no SVD_PLUGIN_DIR refs in source', () => {
  assert.equal(grepCount('SVD_PLUGIN_DIR', ['skills/', 'agents/']), 0);
});

test('no bare bash scripts/ refs in source', () => {
  assert.equal(grepCount('bash scripts/', ['skills/', 'agents/']), 0);
});

test('no bare backtick skills/X.md refs in source', () => {
  assert.equal(
    grepCount('`skills/[a-z][^`]*\\.md`', ['skills/', 'agents/']),
    0
  );
});
