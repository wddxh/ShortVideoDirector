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
