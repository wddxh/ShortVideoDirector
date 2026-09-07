import { ROLE_HANDOFF_GUIDANCE, USER_INVOCABLE_ENTRY_WORKFLOWS } from './tool-mapping.js';

export function generateBootstrap(pluginRoot, agents) {
  const agentList = Object.entries(agents)
    .map(([name, def]) => `- **${name}** — ${def.description}`)
    .join('\n');

  const workflowList = [...USER_INVOCABLE_ENTRY_WORKFLOWS]
    .map(name => `- \`${name}\``)
    .join('\n');

  return `<EXTREMELY_IMPORTANT>
<!-- SVD_BOOTSTRAP_MARKER -->

# ShortVideoDirector 工作流已加载

本会话已加载 ShortVideoDirector 插件（短视频创作工作流），提供以下能力：

## 可用子代理（${Object.keys(agents).length} 个）

${agentList}

## 入口工作流（${USER_INVOCABLE_ENTRY_WORKFLOWS.size} 个 user-invocable skills）

${workflowList}

## 如何启动

用户用 \`/skill-name 自然语言请求\` 触发入口工作流；OC command 用原生 \`$ARGUMENTS\` 原样传输请求，加载 skill 不再构造位置参数。

- 写入或付费前解析明确目标与授权；歧义不默认全部或最新。查看配置只读，不强制初始化。
- 主 AI 保持用户交互与忠实转交职责，不接管 Director 的创作决策
- 也可用自然语言（"帮我做一个新的短视频，主题是 XXX"）触发，LLM 会自行决定调用对应 skill

## 关键执行规则

${ROLE_HANDOFF_GUIDANCE}

需要用户决定时由主 AI 询问；制作前确认与独立审核不能互相替代。每次 Write/Edit 保持 2000 字符上限，不限制文件最终长度。

## auto-video 安全提示

\`auto-video\` 仅在用户要求或已同意默认时通过 \`nohup\` 启动本地 loop，以 OpenCode HTTP session/prompt 委托 checker。新提交/重试需真实 Creator，depth1 由主 AI 派 sibling 后恢复同一 checker。只按有效且 target 匹配的 JSON 摘要停止，不从 prose 推断；skill 负责 PID、日志和运行错误上限。

## 子代理与 skill 间的关系

skill 内的执行细节、参数、输出格式参见加载后的 SKILL.md。本 bootstrap 只是高层导览，**不要试图凭印象执行 skill 内的步骤**。

</EXTREMELY_IMPORTANT>`;
}
