import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_INVOCABLE_ENTRY_WORKFLOWS } from '../lib/tool-mapping.js';

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
