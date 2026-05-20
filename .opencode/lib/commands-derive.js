import { USER_INVOCABLE_ENTRY_WORKFLOWS } from './tool-mapping.js';

export const buildCommandTemplate = (skillName) => `请使用 Skill tool 调用 \`${skillName}\` skill。

用户输入的参数：
- 完整参数串：$ARGUMENTS
- 按位置拆分：
  - 第 1 个 ($1): $1
  - 第 2 个 ($2): $2
  - 第 3 个 ($3): $3
  - 第 4 个 ($4): $4

加载 SKILL.md 后按其工作流执行，从上述参数中按 SKILL.md "### 动态参数" 段定义的语义代入对应的 \`$ARGUMENTS[N]\` 占位符（索引从 0 开始，对应位置 \\$(N+1)）。
`;

export function deriveCommands(existing = {}) {
  const out = { ...existing };
  for (const skillName of USER_INVOCABLE_ENTRY_WORKFLOWS) {
    if (out[skillName]) continue;
    out[skillName] = {
      description: `调用 ${skillName} 工作流`,
      template: buildCommandTemplate(skillName),
    };
  }
  return out;
}
