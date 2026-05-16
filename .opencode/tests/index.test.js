import { describe, it, expect } from 'vitest';
import { ShortVideoDirectorPlugin } from '../plugin/index.js';

describe('ShortVideoDirectorPlugin', () => {
  it('returns object with 3 expected hooks', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    expect(typeof plugin.config).toBe('function');
    expect(typeof plugin['shell.env']).toBe('function');
    expect(typeof plugin['experimental.chat.messages.transform']).toBe('function');
  });

  it('config hook mutates skills.paths and agent', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    const config = {};
    await plugin.config(config);
    expect(config.skills.paths.length).toBeGreaterThan(0);
    expect(Object.keys(config.agent)).toContain('director');
  });

  it('shell.env hook sets SVD_PLUGIN_DIR', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    const output = { env: {} };
    await plugin['shell.env']({}, output);
    expect(output.env.SVD_PLUGIN_DIR).toBeTruthy();
    expect(output.env.SVD_PLUGIN_DIR).toContain('ShortVideoDirector');
  });

  it('messages.transform injects bootstrap idempotently', async () => {
    const plugin = await ShortVideoDirectorPlugin({ client: null, directory: '/tmp' });
    const output = {
      messages: [
        { info: { role: 'user' }, parts: [{ type: 'text', text: 'hello' }] },
      ],
    };
    await plugin['experimental.chat.messages.transform']({}, output);
    expect(output.messages[0].parts.length).toBe(2);
    expect(output.messages[0].parts[0].text).toContain('SVD_BOOTSTRAP_MARKER');
    await plugin['experimental.chat.messages.transform']({}, output);
    expect(output.messages[0].parts.length).toBe(2);
  });
});
