// The `USER_INVOCABLE_ENTRY_WORKFLOWS` assertion below mirrors the constant
// in `.opencode/lib/tool-mapping.js`, which itself MUST stay in sync with
// source skills that have `user-invocable: true` in their frontmatter. If
// you add/remove a user-invocable skill, update BOTH the constant and this
// test's hardcoded Set — see `.opencode/README.md` § 维护契约.
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

describe('ENTRY_WORKFLOW_DISPATCH_DISCIPLINE', () => {
  test('contains key directive phrases', async () => {
    const { ENTRY_WORKFLOW_DISPATCH_DISCIPLINE } = await import('../lib/tool-mapping.js');
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('派发约束'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('分段策略'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('逐镜头'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('JSON'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('长度原则'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('不限制最终文件总长度'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('反例'));
    assert.ok(ENTRY_WORKFLOW_DISPATCH_DISCIPLINE.includes('oldString'));
  });
});
