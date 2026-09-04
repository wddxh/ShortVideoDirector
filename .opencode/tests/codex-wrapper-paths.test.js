import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('all Codex wrappers resolve source skills from plugin root', () => {
  const root = join(process.cwd(), '.codex/skills');
  const wrappers = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, 'SKILL.md'));
  assert.ok(wrappers.length > 0);
  for (const wrapper of wrappers) {
    const text = readFileSync(wrapper, 'utf8');
    assert.match(text, /\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/[^/]+\/SKILL\.md/);
    assert.match(text, /plugin directory.*\$\{CLAUDE_PLUGIN_ROOT\}/i);
    assert.doesNotMatch(text, /读取 `skills\/[^`]+\/SKILL\.md`/);
  }
});

test('Codex Task mapping dispatches and fails closed for isolation', () => {
  const text = readFileSync(join(process.cwd(), '.codex/tool-mapping.md'), 'utf8');
  const match = text.match(/## Task 调用协议\n\n```json\n([\s\S]*?)\n```/);
  assert.ok(match, 'missing Task mapping contract');
  const task = JSON.parse(match[1]).task;
  assert.equal(task.with_subagent, 'dispatch_apply_role_full_payload_wait');
  assert.equal(task.role_source, 'agents/<role>.md');
  assert.deepEqual(task.payload, ['skill', 'params']);
  assert.equal(task.isolated_without_subagent, 'fail_closed');
  assert.equal(task.ordinary_without_subagent, 'current_session_with_role');
});
