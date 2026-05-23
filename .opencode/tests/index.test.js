import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ShortVideoDirectorPlugin } from '../plugin/index.js';

describe('ShortVideoDirectorPlugin', () => {
  test('returns object with 3 expected hooks', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    assert.equal(typeof plugin.config, 'function');
    assert.equal(typeof plugin['shell.env'], 'function');
    assert.equal(typeof plugin['experimental.chat.messages.transform'], 'function');
  });

  test('config hook mutates skills.paths and agent', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    const config = {};
    await plugin.config(config);
    assert.ok(config.skills.paths.length > 0);
    assert.ok(Object.keys(config.agent).includes('director'));
  });

  test('shell.env hook sets CLAUDE_PLUGIN_ROOT', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    const output = { env: {} };
    await plugin['shell.env']({}, output);
    assert.ok(output.env.CLAUDE_PLUGIN_ROOT);
    assert.ok(output.env.CLAUDE_PLUGIN_ROOT.includes('ShortVideoDirector'));
  });

  test('messages.transform injects bootstrap idempotently', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    const output = {
      messages: [
        { info: { role: 'user' }, parts: [{ type: 'text', text: 'hello' }] },
      ],
    };
    await plugin['experimental.chat.messages.transform']({}, output);
    assert.equal(output.messages[0].parts.length, 2);
    assert.ok(output.messages[0].parts[0].text.includes('SVD_BOOTSTRAP_MARKER'));
    await plugin['experimental.chat.messages.transform']({}, output);
    assert.equal(output.messages[0].parts.length, 2);
  });
});
