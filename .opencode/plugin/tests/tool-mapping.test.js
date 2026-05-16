import { describe, it, expect } from 'vitest';
import {
  USER_INVOCABLE_ENTRY_WORKFLOWS,
  TASK_PROMPT_TEMPLATE,
  LEAF_CONTEXT_HINT,
  ENTRY_WORKFLOW_WRITE_GUIDANCE,
  AUTO_VIDEO_CRON_BODY,
} from '../tool-mapping.js';

describe('tool-mapping constants', () => {
  it('USER_INVOCABLE_ENTRY_WORKFLOWS contains exactly 9 entries', () => {
    expect(USER_INVOCABLE_ENTRY_WORKFLOWS).toEqual(new Set([
      'series-video', 'short-video',
      'series-edit-story', 'short-edit-story',
      'series-repair-story', 'short-repair-story',
      'generate-video', 'check-video', 'auto-video',
    ]));
  });

  it('TASK_PROMPT_TEMPLATE renders with all required fields', () => {
    const out = TASK_PROMPT_TEMPLATE({
      skillName: 'director-arc',
      agentName: 'director',
      params: '- topic: test\n- episode: 1',
    });
    expect(out).toContain('director-arc');
    expect(out).toContain('director');
    expect(out).toContain('topic: test');
    expect(out).toContain('skill({ name: "director-arc" })');
  });

  it('LEAF_CONTEXT_HINT renders with agent name', () => {
    const out = LEAF_CONTEXT_HINT('director');
    expect(out).toContain('director');
    expect(out).toContain('执行上下文');
  });

  it('ENTRY_WORKFLOW_WRITE_GUIDANCE is non-empty string with key terms', () => {
    expect(ENTRY_WORKFLOW_WRITE_GUIDANCE).toContain('写入约束');
    expect(ENTRY_WORKFLOW_WRITE_GUIDANCE).toContain('3000 字符');
    expect(ENTRY_WORKFLOW_WRITE_GUIDANCE).toContain('Edit');
  });

  it('AUTO_VIDEO_CRON_BODY contains crontab template', () => {
    expect(AUTO_VIDEO_CRON_BODY).toContain('crontab');
    expect(AUTO_VIDEO_CRON_BODY).toContain('opencode run --session');
    expect(AUTO_VIDEO_CRON_BODY).toContain('svd-auto-video:');
  });
});
