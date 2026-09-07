import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const source = '.opencode/skill-overrides/auto-video/';
const skill = readFileSync(join(root, source, 'SKILL.md'), 'utf8');
const recipe = [...skill.matchAll(/```bash\n([\s\S]*?)\n\s*```/g)]
  .map(match => match[1]).find(block => block.includes('TEMPLATE='));
const template = readFileSync(join(root, source, 'cron-prompt.txt'), 'utf8');
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;

test('render recipe binds context in a fresh shell and preserves literal config bytes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'svd-render-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const config of ["settings/team's & $(false) $HOME {{SID}}.md", 'UNRESOLVED']) {
    const output = join(dir, 'prompt.txt');
    const values = { TARGET: 'ep02', SID: 'session_test', CONFIG: config, PROMPT_FILE: output };
    let command = recipe;
    for (const [key, value] of Object.entries(values)) {
      command = command.replace(`'{${key}}'`, () => quote(value));
    }
    const result = spawnSync('bash', ['--noprofile', '--norc', '-eu', '-c', command], {
      env: { PATH: process.env.PATH, CLAUDE_PLUGIN_ROOT: root }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8'), template.replace(/\{\{(TARGET|SID|CONFIG)\}\}/g,
      (_, key) => values[key]).trimEnd());
  }
});

test('render recipe rejects an empty config instead of inferring a default', () => {
  let command = recipe;
  for (const [key, value] of Object.entries({ TARGET: 'ep02', SID: 'session_test',
    CONFIG: '', PROMPT_FILE: '/must-not-write.txt' })) {
    command = command.replace(`'{${key}}'`, () => quote(value));
  }
  const result = spawnSync('bash', ['--noprofile', '--norc', '-eu', '-c', command], {
    env: { PATH: process.env.PATH, CLAUDE_PLUGIN_ROOT: root }, encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CONFIG/);
});
