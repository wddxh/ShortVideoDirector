import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { USER_INVOCABLE_ENTRY_WORKFLOWS } from '../lib/tool-mapping.js';
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

test('commands derive: USER_INVOCABLE_ENTRY_WORKFLOWS 中所有 skill 全部注册', async () => {
  const config = await runConfigHook();
  assert.ok(config.command, 'config.command 应存在');
  for (const name of USER_INVOCABLE_ENTRY_WORKFLOWS) {
    assert.ok(config.command[name], `应注册 /${name}`);
  }
  assert.equal(
    Object.keys(config.command).length,
    USER_INVOCABLE_ENTRY_WORKFLOWS.size,
    'commands 数量应与 USER_INVOCABLE_ENTRY_WORKFLOWS 一致'
  );
});

test('commands derive: 每个 command 含 template + description 必填字段', async () => {
  const config = await runConfigHook();
  for (const [name, cmd] of Object.entries(config.command)) {
    assert.ok(typeof cmd.template === 'string' && cmd.template.length > 0, `${name} template 非空`);
    assert.ok(typeof cmd.description === 'string' && cmd.description.length > 0, `${name} description 非空`);
  }
});

test('commands derive: template 含 skill name 反引号包裹', () => {
  const template = buildCommandTemplate('auto-video');
  assert.ok(template.includes('`auto-video`'), 'template 应含 `auto-video`');
});

test('commands derive: template 含 $ARGUMENTS 完整串占位符', () => {
  const template = buildCommandTemplate('auto-video');
  assert.ok(template.includes('$ARGUMENTS'), 'template 应含 $ARGUMENTS');
});

test('commands transport one raw request without positional interpolation', () => {
  const request = '监控 ep01，每五分钟；不要重试 "shot 2"';
  for (const name of USER_INVOCABLE_ENTRY_WORKFLOWS) {
    const template = buildCommandTemplate(name);
    assert.deepEqual(template.match(/\$(?:ARGUMENTS(?:\[[^\]]*\])?|\d+|\([^)]*\))/g), ['$ARGUMENTS']);
    assert.ok(template.replace('$ARGUMENTS', request).includes(request));
  }
});

test('commands derive: template 指引 LLM 调 skill tool', () => {
  const template = buildCommandTemplate('auto-video');
  assert.ok(template.includes('Skill tool') || template.includes('skill tool'),
    'template 应提到 Skill tool');
  assert.ok(template.includes('SKILL.md'), 'template 应提到 SKILL.md');
});

test('commands derive: 用户已配置同名 command 时跳过（不覆盖）', () => {
  const userCustom = {
    description: 'USER OVERRIDE',
    template: 'USER TEMPLATE',
  };
  const result = deriveCommands({ 'auto-video': userCustom });
  // 用户自定义应被保留
  assert.equal(result['auto-video'].description, 'USER OVERRIDE');
  assert.equal(result['auto-video'].template, 'USER TEMPLATE');
  // 其他 skill 仍由 plugin 注册
  assert.ok(result['short-video'].template.includes('Skill tool'));
});

test('commands derive: 与用户已有的非冲突 command 共存', () => {
  const userCustom = { description: 'user', template: 'my test' };
  const result = deriveCommands({ 'my-test': userCustom });
  // 用户的保留
  assert.equal(result['my-test'].description, 'user');
  // plugin 的全部 derive command + 用户的 1 个
  const totalCount = Object.keys(result).length;
  assert.equal(totalCount, USER_INVOCABLE_ENTRY_WORKFLOWS.size + 1,
    '应为所有 derive command + 1 个用户自定义');
});
