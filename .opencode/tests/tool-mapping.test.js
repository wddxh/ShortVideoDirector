import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_INVOCABLE_ENTRY_WORKFLOWS,
  TASK_PROMPT_TEMPLATE,
  LEAF_CONTEXT_HINT,
  ENTRY_WORKFLOW_WRITE_GUIDANCE,
  AUTO_VIDEO_CRON_BODY,
} from '../lib/tool-mapping.js';

describe('tool-mapping constants', () => {
  test('USER_INVOCABLE_ENTRY_WORKFLOWS contains exactly 9 entries', () => {
    assert.deepStrictEqual(USER_INVOCABLE_ENTRY_WORKFLOWS, new Set([
      'series-video', 'short-video',
      'series-edit-story', 'short-edit-story',
      'series-repair-story', 'short-repair-story',
      'generate-video', 'check-video', 'auto-video',
    ]));
  });

  test('TASK_PROMPT_TEMPLATE renders with all required fields', () => {
    const out = TASK_PROMPT_TEMPLATE({
      skillName: 'director-arc',
      agentName: 'director',
      params: '- topic: test\n- episode: 1',
    });
    assert.ok(out.includes('director-arc'));
    assert.ok(out.includes('director'));
    assert.ok(out.includes('topic: test'));
    assert.ok(out.includes('skill({ name: "director-arc" })'));
  });

  test('LEAF_CONTEXT_HINT renders with agent name', () => {
    const out = LEAF_CONTEXT_HINT('director');
    assert.ok(out.includes('director'));
    assert.ok(out.includes('执行上下文'));
  });

  test('ENTRY_WORKFLOW_WRITE_GUIDANCE is non-empty string with key terms', () => {
    assert.ok(ENTRY_WORKFLOW_WRITE_GUIDANCE.includes('写入约束'));
    assert.ok(ENTRY_WORKFLOW_WRITE_GUIDANCE.includes('3000 字符'));
    assert.ok(ENTRY_WORKFLOW_WRITE_GUIDANCE.includes('Edit'));
  });

  test('AUTO_VIDEO_CRON_BODY contains crontab template', () => {
    assert.ok(AUTO_VIDEO_CRON_BODY.includes('crontab'));
    assert.ok(AUTO_VIDEO_CRON_BODY.includes('opencode run --session'));
    assert.ok(AUTO_VIDEO_CRON_BODY.includes('svd-auto-video:'));
  });
});
