import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

test('all Codex wrappers resolve source skills from plugin root', () => {
  const root = join(process.cwd(), '.codex/skills');
  const mapping = readFileSync(join(process.cwd(), '.codex/tool-mapping.md'), 'utf8').trimEnd();
  const rule = 'skills/_meta/rules/user-decision-relay.md';
  assert.ok(mapping.includes('${CLAUDE_PLUGIN_ROOT}/' + rule));
  assert.ok(readFileSync(join(process.cwd(), rule), 'utf8').length > 0);
  const wrappers = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, 'SKILL.md'));
  assert.ok(wrappers.length > 0);
  for (const wrapper of wrappers) {
    const text = readFileSync(wrapper, 'utf8');
    assert.ok(text.includes(mapping), wrapper);
    const name = wrapper.split('/').at(-2);
    const source = readFileSync(join(process.cwd(), 'skills', name, 'SKILL.md'), 'utf8');
    const role = source.match(/^agent: (.+)$/m)?.[1];
    if (role) assert.match(text, new RegExp(`^agent: ${role}$`, 'm'));
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
  assert.equal(task.with_subagent, 'dispatch_apply_role_outcome_wait');
  assert.equal(task.role_source, 'agents/<role>.md');
  assert.deepEqual(task.payload, ['role', 'outcome', 'references', 'scope', 'constraints']);
  assert.equal(task.nesting_unavailable, 'main_relay_resume_owner');
  assert.equal(task.review_context, 'fresh_without_producer_history');
  assert.equal(task.relay_unavailable, 'blocked_no_self_review');
});

test('Codex native question example respects request_user_input shape and limits', () => {
  const text = readFileSync(join(process.cwd(), '.codex/tool-mapping.md'), 'utf8');
  const section = text.split('## Native User Decision')[1];
  assert.ok(section, 'missing native question mapping');
  const call = JSON.parse(section.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.deepEqual(Object.keys(call), ['questions']);
  assert.equal(call.questions.length, 1);
  const item = call.questions[0];
  assert.deepEqual(Object.keys(item).sort(), ['header', 'id', 'options', 'question']);
  assert.match(item.id, /^[a-z_]+$/);
  assert.ok(item.header.length <= 12);
  assert.equal(item.options.length, 3);
  assert.equal(new Set(item.options.map(option => option.label)).size, 3);
  for (const option of item.options) {
    assert.deepEqual(Object.keys(option).sort(), ['description', 'label']);
    assert.ok(option.label && option.description);
  }
});

test('Codex regeneration removes retired wrappers and stale guides only in its output', () => {
  const root = mkdtempSync(join(tmpdir(), 'svd-codex-'));
  try {
    mkdirSync(join(root, '.codex'));
    for (const file of ['build-codex-skills.py', 'tool-mapping.md']) {
      copyFileSync(join(process.cwd(), '.codex', file), join(root, '.codex', file));
    }
    for (const name of ['demo', 'retired']) {
      mkdirSync(join(root, 'skills', name), { recursive: true });
      writeFileSync(join(root, 'skills', name, 'SKILL.md'),
        `---\nname: ${name}\ndescription: fixture\nagent: director\n---\nBody`);
    }
    const build = () => execFileSync('python3', [join(root, '.codex/build-codex-skills.py')]);
    build();
    writeFileSync(join(root, '.codex/skills/demo/old.md'), 'stale');
    writeFileSync(join(root, 'user-owned.md'), 'keep');
    rmSync(join(root, 'skills/retired'), { recursive: true });
    build();
    assert.equal(existsSync(join(root, '.codex/skills/retired')), false);
    assert.equal(existsSync(join(root, '.codex/skills/demo/old.md')), false);
    assert.equal(readFileSync(join(root, 'user-owned.md'), 'utf8'), 'keep');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Codex sibling validation resolves relative provider guide links', () => {
  const root = mkdtempSync(join(tmpdir(), 'svd-codex-guides-'));
  try {
    mkdirSync(join(root, '.codex'));
    for (const file of ['build-codex-skills.py', 'tool-mapping.md']) {
      copyFileSync(join(process.cwd(), '.codex', file), join(root, '.codex', file));
    }
    const dir = join(root, 'skills/demo');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'),
      '---\nname: demo\ndescription: fixture\n---\n[image](image.md)');
    const script = join(root, '.codex/build-codex-skills.py');
    execFileSync('python3', [script]);
    assert.throws(() => execFileSync('python3', [script, '--check'], { stdio: 'pipe' }),
      error => error.status === 1 && error.stderr.includes('image.md'));
    writeFileSync(join(dir, 'image.md'), 'Guide');
    execFileSync('python3', [script, '--check']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
