import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { INTERNAL_ENTRY_WORKFLOWS, USER_INVOCABLE_ENTRY_WORKFLOWS } from '../lib/tool-mapping.js';
import { buildCommandTemplate, deriveCommands } from '../lib/commands-derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const originalHome = process.env.HOME;
const testHome = await mkdtemp(path.join(os.tmpdir(), 'svd-commands-home-'));
process.env.HOME = testHome;
after(async () => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  await rm(testHome, { recursive: true, force: true });
});

async function loadPlugin() {
  const mod = await import(path.resolve(PROJECT_ROOT, '.opencode/plugin/index.js'));
  return mod.ShortVideoDirectorPlugin;
}

async function runConfigHook(initialConfig = {}) {
  const Plugin = await loadPlugin();
  const instance = await Plugin({ client: {}, directory: PROJECT_ROOT });
  await instance.config(initialConfig);
  return initialConfig;
}

test('commands derive: plugin registers exactly two creation commands', async () => {
  const config = await runConfigHook();
  assert.deepEqual(Object.keys(config.command).sort(), ['series-video', 'short-video']);
});

test('commands derive: template 含 skill name 反引号包裹', () => {
  const template = buildCommandTemplate('short-video');
  assert.ok(template.includes('`short-video`'), 'template 应含 `short-video`');
});

test('commands derive: template 含 $ARGUMENTS 完整串占位符', () => {
  const template = buildCommandTemplate('short-video');
  assert.ok(template.includes('$ARGUMENTS'), 'template 应含 $ARGUMENTS');
});

test('command template helper transports one raw request without positional interpolation', () => {
  const request = '监控 ep01，每五分钟；不要重试 "shot 2"';
  for (const name of USER_INVOCABLE_ENTRY_WORKFLOWS) {
    const template = buildCommandTemplate(name);
    assert.deepEqual(template.match(/\$(?:ARGUMENTS(?:\[[^\]]*\])?|\d+|\([^)]*\))/g), ['$ARGUMENTS']);
    assert.ok(template.replace('$ARGUMENTS', request).includes(request));
  }
});

test('creation commands retain templates and stay in the main context', () => {
  const commands = deriveCommands();
  assert.deepEqual(Object.keys(commands).sort(), ['series-video', 'short-video']);
  assert.deepEqual(deriveCommands({}), commands);
  for (const command of Object.values(commands)) {
    assert.ok(command.description && command.template);
    assert.equal(command.agent, undefined);
    assert.equal(command.subtask, undefined);
  }
});

test('commands derive: template 指引 LLM 调 skill tool', () => {
  const template = buildCommandTemplate('short-video');
  assert.ok(template.includes('Skill tool') || template.includes('skill tool'),
    'template 应提到 Skill tool');
  assert.ok(template.includes('SKILL.md'), 'template 应提到 SKILL.md');
});

test('commands derive: 用户已配置同名 command 时跳过（不覆盖）', () => {
  const userCustom = {
    description: 'USER OVERRIDE',
    template: 'USER TEMPLATE',
  };
  const result = deriveCommands({ 'short-video': userCustom });
  // 用户自定义应被保留
  assert.strictEqual(result['short-video'], userCustom);
  assert.deepEqual(Object.keys(result).sort(), ['series-video', 'short-video']);
});

test('commands derive: 与用户已有的非冲突 command 共存', () => {
  const userCustom = { description: 'user', template: 'my test' };
  const result = deriveCommands({ 'my-test': userCustom });
  // 用户的保留
  assert.equal(result['my-test'].description, 'user');
  assert.deepEqual(Object.keys(result).sort(), ['my-test', 'series-video', 'short-video']);
});

test('config hook preserves user commands named after internal workflows', async () => {
  const custom = Object.fromEntries([...INTERNAL_ENTRY_WORKFLOWS,
    'generate-video', 'check-video', 'auto-video', 'my-test']
    .map(name => [name, { description: `User ${name}`, template: `Custom ${name}` }]));
  const config = await runConfigHook({ command: custom });
  for (const [name, command] of Object.entries(custom)) {
    assert.strictEqual(config.command[name], command, name);
  }
  assert.deepEqual(Object.keys(config.command).sort(),
    Object.keys(custom).sort());
});
