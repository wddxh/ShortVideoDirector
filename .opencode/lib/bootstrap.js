import { USER_INVOCABLE_ENTRY_WORKFLOWS } from './tool-mapping.js';

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

用户可以用自然语言（"帮我做一个新的短视频，主题是 XXX"）或显式调用 skill（"执行 short-video skill，参数：topic=XXX"）。

## 关键执行规则

1. **调度链路**：orchestrator skill 调用带 \`context: fork\`（已在 cache 中标注）的 leaf skill 时，使用 \`task\` 工具派发到对应子代理；不带 fork 的 leaf 用 \`skill\` 工具同上下文加载
2. **task prompt 模板**：派发时 prompt 内容是"加载并执行 skill X"的轻量指令，子代理自己调 \`skill()\` 拉完整内容
3. **自然语言确认**：剧情选项类 skill 会主动向用户提问选择，请直接回答即可，不会有 OC 系统弹窗

## auto-video 安全提示

\`auto-video\` skill 会通过 bash + 系统 \`crontab\` 安装定时任务，每 5 分钟运行 \`opencode run --session\` 自动轮询 check-video。视频全部完成后必须删除 cron 条目（skill 内有兜底）。

## 子代理与 skill 间的关系

skill 内的执行细节、参数、输出格式参见加载后的 SKILL.md。本 bootstrap 只是高层导览，**不要试图凭印象执行 skill 内的步骤**。

</EXTREMELY_IMPORTANT>`;
}
