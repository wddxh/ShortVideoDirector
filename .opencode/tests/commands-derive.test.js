import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_INVOCABLE_ENTRY_WORKFLOWS } from '../lib/tool-mapping.js';
import { buildCommandTemplate } from '../lib/commands-derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

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

test('commands derive: template 含 $1~$4 位置参数', () => {
  const template = buildCommandTemplate('auto-video');
  for (let i = 1; i <= 4; i++) {
    assert.ok(template.includes(`$${i}`), `template 应含 $${i}`);
  }
});

test('commands derive: template 不含 $5+（防 over-engineering）', () => {
  const template = buildCommandTemplate('auto-video');
  assert.ok(!template.includes('$5'), 'template 不应含 $5');
  assert.ok(!template.includes('$6'), 'template 不应含 $6');
});

test('commands derive: template 指引 LLM 调 skill tool', () => {
  const template = buildCommandTemplate('auto-video');
  assert.ok(template.includes('Skill tool') || template.includes('skill tool'),
    'template 应提到 Skill tool');
  assert.ok(template.includes('SKILL.md'), 'template 应提到 SKILL.md');
});

test('commands derive: template 保留 $(N+1) 字面量（非占位符）', () => {
  assert.ok(buildCommandTemplate('auto-video').includes('$(N+1)'),
    'template 应含字面量 $(N+1)');
});
