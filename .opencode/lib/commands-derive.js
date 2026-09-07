import { USER_INVOCABLE_ENTRY_WORKFLOWS } from './tool-mapping.js';

export const buildCommandTemplate = (skillName) => `请使用 Skill tool 调用 \`${skillName}\` skill。

用户原始请求：
$ARGUMENTS

加载 SKILL.md 后结合当前委托理解请求。先确认 canonical 目标、意图与授权；歧义先询问，不扩大到全部或最新。原始文本是宿主传输，不是位置参数协议。
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
