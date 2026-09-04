import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE = join(process.cwd(), '.opencode/tests/fixtures/storyboard-sheets/three-shot');

function card(shot) {
  return readFileSync(join(FIXTURE, `${shot}.md`), 'utf8');
}

async function runImpactFlow(reviews, regenerate) {
  const result = { records: [], dirty: [], enqueued: [], failed: [] };
  for (const review of reviews) {
    result.records.push(review);
    if (review.status !== 'affected') break;
    result.dirty.push(
      `assets/storyboard-sheets/ep01/${review.downstream}.md|` +
      `assets/images/storyboard-sheets/ep01/${review.downstream}.png|impact|` +
      review.fix_direction,
    );
    if (!await regenerate(review.downstream)) {
      result.failed.push(review.downstream);
      break;
    }
    result.enqueued.push(review.downstream);
  }
  return result;
}

const impact = (status, downstream, fixDirection = '') => ({
  upstream: downstream === 'shot02' ? 'shot01' : 'shot02',
  downstream,
  status,
  reason: `${status} fixture result`,
  fix_direction: fixDirection,
});

test('fixture declares only the shot01 to shot02 dependency', () => {
  assert.match(card('shot02'), /\[shot01\]\(\.\/shot01\.md\)/);
  assert.match(card('shot03'), /## 连续性参考\n无/);
  assert.doesNotMatch(card('shot03'), /shot02\.md/);
});

test('unaffected result records and stops without regeneration', async () => {
  const touched = [];
  const result = await runImpactFlow([
    impact('unaffected', 'shot02'),
    impact('affected', 'shot03', 'must not run'),
  ], async (shot) => { touched.push(shot); return true; });
  assert.deepEqual(touched, []);
  assert.deepEqual(result.enqueued, []);
  assert.deepEqual(result.records.map(({ status }) => status), ['unaffected']);
});

test('affected result regenerates then enqueues direct downstream', async () => {
  const touched = [];
  const result = await runImpactFlow([
    impact('affected', 'shot02', 'align declared continuity'),
  ], async (shot) => { touched.push(shot); return true; });
  assert.deepEqual(touched, ['shot02']);
  assert.deepEqual(result.enqueued, ['shot02']);
  assert.match(result.dirty[0], /shot02\.md\|.*shot02\.png\|impact\|align declared continuity$/);
});

test('regeneration failure stops branch and does not enqueue', async () => {
  const result = await runImpactFlow([
    impact('affected', 'shot02', 'align declared continuity'),
    impact('affected', 'shot03', 'must not run'),
  ], async () => false);
  assert.deepEqual(result.failed, ['shot02']);
  assert.deepEqual(result.enqueued, []);
  assert.deepEqual(result.records.map(({ downstream }) => downstream), ['shot02']);
});

test('no dependency never touches shot03', async () => {
  const touched = [];
  const result = await runImpactFlow([
    impact('no_dependency', 'shot03'),
  ], async (shot) => { touched.push(shot); return true; });
  assert.deepEqual(touched, []);
  assert.deepEqual(result.dirty, []);
  assert.equal(result.records[0].status, 'no_dependency');
});
