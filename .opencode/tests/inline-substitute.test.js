import { test } from 'node:test';
import assert from 'node:assert';
import { inlineSubstitutePluginRoot } from '../lib/transform-skills.js';

test('replaces ${CLAUDE_PLUGIN_ROOT} with absolute path', () => {
  const out = inlineSubstitutePluginRoot(
    '读取 ${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/X.md', '/abs/plugin'
  );
  assert.equal(out, '读取 /abs/plugin/skills/_meta/rules/X.md');
});

test('maps skill resources to cache while scripts remain in plugin source', () => {
  const input = '${CLAUDE_PLUGIN_ROOT}/skills/x/rules.md\n' +
    '${CLAUDE_PLUGIN_ROOT}/scripts/tool.sh';
  assert.equal(inlineSubstitutePluginRoot(input, '/plugin', '/cache/skills'),
    '/cache/skills/x/rules.md\n/plugin/scripts/tool.sh');
});

test('replaces multiple occurrences', () => {
  const input = 'A ${CLAUDE_PLUGIN_ROOT}/a B ${CLAUDE_PLUGIN_ROOT}/b';
  assert.equal(inlineSubstitutePluginRoot(input, '/p'), 'A /p/a B /p/b');
});

test('replaces bash invocation form', () => {
  const out = inlineSubstitutePluginRoot(
    'bash ${CLAUDE_PLUGIN_ROOT}/scripts/foo.sh arg', '/p'
  );
  assert.equal(out, 'bash /p/scripts/foo.sh arg');
});

test('idempotent: no var → unchanged', () => {
  const input = 'plain text no var';
  assert.equal(inlineSubstitutePluginRoot(input, '/p'), input);
});

test('does not touch $SVD_PLUGIN_DIR (legacy var)', () => {
  const input = '$SVD_PLUGIN_DIR/x';
  assert.equal(inlineSubstitutePluginRoot(input, '/p'), input);
});
