import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as mapping from '../lib/tool-mapping.js';

test('keeps exactly seven entry workflows', () => {
  assert.deepEqual(mapping.USER_INVOCABLE_ENTRY_WORKFLOWS, new Set([
    'series-video', 'short-video', 'edit-story', 'repair-story',
    'generate-video', 'check-video', 'auto-video',
  ]));
});

test('entry injection shares role guidance, not named-skill dispatch templates', () => {
  assert.ok(mapping.ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes(mapping.ROLE_HANDOFF_GUIDANCE));
  assert.equal(mapping.TASK_PROMPT_TEMPLATE, undefined);
  assert.equal(mapping.LEAF_CONTEXT_HINT, undefined);
});

test('native question example has one single-choice item and stable option labels', () => {
  const guidance = mapping.NATIVE_QUESTION_GUIDANCE;
  assert.equal(typeof guidance, 'string');
  assert.ok(mapping.ROLE_HANDOFF_GUIDANCE.includes(guidance));
  const call = JSON.parse(guidance.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.deepEqual(Object.keys(call), ['questions']);
  assert.equal(call.questions.length, 1);
  const item = call.questions[0];
  assert.deepEqual(Object.keys(item).sort(), ['header', 'multiple', 'options', 'question']);
  assert.equal(item.multiple, false);
  assert.equal(item.options.length, 4);
  assert.equal(new Set(item.options.map(option => option.label)).size, 4);
  for (const option of item.options) {
    assert.deepEqual(Object.keys(option).sort(), ['description', 'label']);
    assert.ok(option.label && option.description);
  }
});
