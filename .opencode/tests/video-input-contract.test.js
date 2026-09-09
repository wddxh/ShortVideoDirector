import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { retryAuthorization } from '../../scripts/video-task-inputs.mjs';

const read = (file) => readFileSync(file, 'utf8');
test('documented persisted retry grant is consumable by an isolated checker', () => {
  const section = read('skills/check-video/SKILL.md').split('## 重试授权记录')[1];
  assert.ok(section);
  const grant = JSON.parse(section.match(/```json\n([\s\S]*?)\n```/)[1]);
  const task = JSON.parse(JSON.stringify({ task_id: 'task01', shots: [1, 2], status: 'failed', retry_authorization: grant }));
  assert.deepEqual(retryAuthorization(task, 'ep01'), grant);
  for (const file of ['skills/generate-video/SKILL.md', 'skills/creator-provider-dreamina/video.md',
    'skills/auto-video/SKILL.md', '.opencode/skill-overrides/auto-video/SKILL.md',
    '.opencode/skill-overrides/auto-video/cron-prompt.txt']) {
    assert.ok(read(file).includes('retry_authorization'), file);
  }
});
test('video entries retain entry metadata and execution helpers', () => {
  for (const name of ['generate-video', 'check-video', 'auto-video']) {
    const text = read(`skills/${name}/SKILL.md`);
    assert.match(text, new RegExp(`^name: ${name}$`, 'm'));
    assert.match(text, /^user-invocable: true$/m);
  }
  for (const name of ['generate-video', 'check-video']) {
    assert.ok(read(`skills/${name}/SKILL.md`).includes('video-task-inputs.mjs'), name);
  }
  assert.ok(read('skills/check-video/SKILL.md').includes('video-check-dreamina.sh'));
  assert.ok(read('skills/creator-provider-dreamina/video.md').includes('video-task-inputs.mjs'));
});

test('monitor adapters retain check-video entry and machine summary fields', () => {
  for (const file of ['skills/auto-video/SKILL.md',
    '.opencode/skill-overrides/auto-video/SKILL.md',
    '.opencode/skill-overrides/auto-video/cron-prompt.txt']) {
    const text = read(file);
    for (const token of ['check-video', 'all_complete', 'human_needed']) {
      assert.ok(text.includes(token), `${file}: ${token}`);
    }
  }
});

test('checker summary example counts tasks and identifies human-needed group membership', () => {
  const examples = [...read('skills/check-video/SKILL.md').matchAll(/```json\n([\s\S]*?)\n```/g)]
    .map(([, json]) => JSON.parse(json));
  const summary = examples.find(value => Object.hasOwn(value, 'all_complete'));
  assert.ok(summary);
  assert.equal(summary.target, 'ep01');
  for (const key of ['pending', 'done', 'submitted', 'failed']) {
    assert.ok(Number.isSafeInteger(summary[key]) && summary[key] >= 0);
  }
  assert.equal(typeof summary.all_complete, 'boolean');
  assert.ok(summary.human_needed.length > 0);
  for (const item of summary.human_needed) {
    assert.deepEqual(Object.keys(item).sort(), ['ep', 'reason', 'shots', 'task_id']);
    assert.match(item.task_id, /^task(?:0[1-9]|[1-9]\d+)$/);
    assert.ok(item.shots.length > 0 && item.shots.every(Number.isSafeInteger));
  }
});
