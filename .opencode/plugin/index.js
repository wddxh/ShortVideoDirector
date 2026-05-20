import path from 'path';
import { fileURLToPath } from 'url';
import { loadAndTransform } from '../lib/cache.js';
import { generateBootstrap } from '../lib/bootstrap.js';
import { interceptToolCall } from '../lib/write-guard.js';
import { USER_INVOCABLE_ENTRY_WORKFLOWS } from '../lib/tool-mapping.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, '../..');

const COMMAND_TEMPLATE = (skillName) => `请使用 Skill tool 调用 \`${skillName}\` skill。

用户输入的参数：
- 完整参数串：$ARGUMENTS
- 按位置拆分：
  - 第 1 个 ($1): $1
  - 第 2 个 ($2): $2
  - 第 3 个 ($3): $3
  - 第 4 个 ($4): $4

加载 SKILL.md 后按其工作流执行，从上述参数中按 SKILL.md "### 动态参数" 段定义的语义代入对应的 \`$ARGUMENTS[N]\` 占位符（索引从 0 开始，对应位置 \\$(N+1)）。
`;

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
      config.command = config.command || {};
      for (const skillName of USER_INVOCABLE_ENTRY_WORKFLOWS) {
        if (config.command[skillName]) continue;
        config.command[skillName] = {
          description: `调用 ${skillName} 工作流`,
          template: COMMAND_TEMPLATE(skillName),
        };
      }
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
