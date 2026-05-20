import path from 'path';
import { fileURLToPath } from 'url';
import { loadAndTransform } from '../lib/cache.js';
import { generateBootstrap } from '../lib/bootstrap.js';
import { interceptToolCall } from '../lib/write-guard.js';
import { deriveCommands } from '../lib/commands-derive.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '../..');

export const ShortVideoDirectorPlugin = async ({ client, directory }) => {
  const { cacheSkillsDir, agents } = await loadAndTransform(PLUGIN_ROOT);
  const bootstrap = generateBootstrap(PLUGIN_ROOT, agents);

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(cacheSkillsDir)) {
        config.skills.paths.push(cacheSkillsDir);
      }
      config.agent = config.agent || {};
      for (const [name, def] of Object.entries(agents)) {
        config.agent[name] = def;
      }
      config.command = deriveCommands(config.command);
    },

    'shell.env': async (input, output) => {
      output.env.SVD_PLUGIN_DIR = PLUGIN_ROOT;
    },

    'experimental.chat.messages.transform': async (_input, output) => {
      if (!output.messages || !output.messages.length) return;
      const firstUser = output.messages.find((m) => m.info.role === 'user');
      if (!firstUser || !firstUser.parts || !firstUser.parts.length) return;
      if (firstUser.parts.some((p) => p.type === 'text' && p.text.includes('SVD_BOOTSTRAP_MARKER'))) {
        return;
      }
      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: 'text', text: bootstrap });
    },

    'tool.execute.before': interceptToolCall,
  };
};
