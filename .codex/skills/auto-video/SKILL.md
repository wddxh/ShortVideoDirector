---
name: auto-video
description: 在用户要求持续监控已登记视频任务、下载结果或停止已有监控时使用。
user-invocable: true
argument-hint: "自然语言监控目标与间隔"
---

# Codex 适配器

这是生成的 Codex 适配层。源 skill 仍是唯一事实来源，位置为 `${CLAUDE_PLUGIN_ROOT}/skills/auto-video/SKILL.md`。

不要手动编辑这个适配层。只有在确实需要改变 Claude 行为时才修改源 skill，然后运行 `python3 .codex/build-codex-skills.py` 重新生成适配层。

## 运行时映射

# Codex 运行时映射

`skills/` 是跨平台知识的源。Codex 加载 `.codex/skills/` 下生成的适配层；适配层应用本映射，再按当前委托读取源 skill。

## 文件和 Shell 工具

- Claude `Read` 表示读取当前工作区中的本地文件。
- Claude `Write` 表示在当前工作区创建或覆盖本地文件。
- Claude `Edit` 表示对本地文件进行定向修改。
- Claude `Glob` 表示按模式查找文件。
- Claude `Grep` 表示搜索文件内容，优先使用 `rg`。
- Claude `Bash` 表示在 skill 必要时执行本地 shell 命令。
- 每次 Write/Edit 内容保持 2000 字符以内，包括 JSON/YAML；按语义单元增量写入，过长单元继续拆分，不限制最终文件长度。

## Skill 调用

- `使用 Skill tool 调用 <skill-name> skill` 表示在当前上下文加载对应 Codex 适配层。浏览 description 后选择所需知识，不因加载 skill 创建子代理。
- 如果不能直接调用 skill，则读取 `${CLAUDE_PLUGIN_ROOT}/skills/<skill-name>/SKILL.md`，按当前委托加载知识。
- 入口原始请求仅由宿主原生 `$ARGUMENTS` 传输，整体保留，不拆位置或构造索引。内部 skill 消费当前成果、材料、范围和约束，不编造调用参数串。
- `agent` 是知识的角色关联，不转移所有权。真正的角色委托由 Task 建立上下文；不得把 Skill 加载当作角色切换或审核隔离。

决策尽量前置：可预见关键选择已满足或明确委托后，在原授权内连续执行，不要求未知艺术细节、额外“开始吗”或逐轮 review/fix 批准。新问题先查配置、材料、grants 并由 Director/专家在权限内判断；仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才需完整决策包。进度不是确认请求，持续许可内动作不重复求同意，固定参数、初始集时长和操作授权边界不变。

生成意图以实际请求为准，不另问图片/视频生成许可。short/series 包含所需新增资产图与分镜板图，intake/审核后执行，但始终停在视频提交前。用户后续手动 generate-video 请求由入口按原文和解析范围登记 initial_authorization，不追加批准握手。check/auto 只延续已登记 initial/retry grants 或取回，不补新生成许可、无限重试或首次提交前的强制重试问题。

## Native User Decision

主 AI 完整展示原角色的当前一题正文及全部解释，再用当前模式可用的 `request_user_input` 键盘选择器。questions 恰好一项；id 稳定、header 不超过 12 字符，options 通常 2-3 项，以实际 schema 为准。示例只说明映射，不提供剧情：

```json
{"questions":[{"id":"plot_choice","header":"Plot","question":"Which candidate should we use?","options":[{"label":"A","description":"Candidate A, explained above"},{"label":"B","description":"Candidate B, explained above"},{"label":"C","description":"Candidate C, explained above"}]}]}
```

问题、标签和全部选项由原角色撰写；全文与控件标签一一对应且不重编号。长解释在控件前，不能为长度删内容。三候选加委托超出三按钮限制时，三候选全保留，明确说明可在原生 Other/自由输入中答“Director 决定”（若支持）。不得删候选换委托或偷偷分页。不能表达全部选择或工具/当前模式不可用时，说明限制并保留全部当前选项，单题文本回退；不切换模式，不改权限/框架。可用且适配的控件不能被 Markdown 代替。

原角色一次给齐全部可预见相关问题/表、明确题界及条件分支。主 AI 读全并内部保留计划，只沿作者题界逐题展示当前完整内容，不有损改写或提前倾倒全表；等答复再问下一适用题，不并行提问。相关原始答复及全部条件批量回原角色原上下文，不逐题往返；仅缺内容/映射、不相容或计划外新决定才提前回询。剧情未指定且基本意图充分时默认三个展开故事，明确数量、已有剧本/方向/委托优先。

技术计划按 scope 给齐未决 provider -> model -> 相容 ratio -> resolution 及明确兼容选择/分支。主 AI 只应用作者条件，不推断 provider 知识；若委托模型须专家解析且无后续分支，先回原角色解析再问依赖项。按实际 scope 跳过已答/固定/继承/已委托字段，不以跨模型列表暗示任意组合可用。

## Task 调用协议

```json
{
  "task": {
    "with_subagent": "dispatch_apply_role_outcome_wait",
    "role_source": "agents/<role>.md",
    "payload": ["role", "outcome", "references", "scope", "constraints"],
    "nesting_unavailable": "main_relay_resume_owner",
    "review_context": "fresh_without_producer_history",
    "relay_unavailable": "blocked_no_self_review"
  }
}
```

- 用户决策须读取并遵循 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。原角色一次给齐相关问题计划及每题背景、全部选项/解释和取舍；费用不自动设字段。主 AI 先读全，按 Native User Decision 沿作者题界完整呈现当前题，不只给链接或摘要；补充解释单独标明，缺失/截断请作者补齐。原始答复及全部条件按题对应批量送回原角色原上下文，Director 与各层 relay 不压缩；无人值守仅报告需决策并保留完整计划供后续逐题交互，不擅自提问或代选。

- Claude `Task` 或 `Agent` 在嵌套可用时直接派发 sub-agent，应用 `${CLAUDE_PLUGIN_ROOT}/agents/<role>.md`，传递成果、参考路径、范围、约束与决策余地并等待结果。角色自行发现和加载方法，不要求命名 skill 链。
- 工具可见不代表嵌套深度允许。在本会话记住已确认的能力；明确深度/嵌套拒绝或工具缺失才转 relay，普通任务失败不是嵌套失败。确认不可嵌套后不反复探测，不自动调整宿主配置/深度。
- 嵌套不可用时 Director 返回协议 payload，由主 AI 忠实转交专家，再用宿主任务/agent ID 恢复原 Director 上下文并返回结果（OpenCode 对应 task_id）。主 AI 保留会话能力结论，不另排创作顺序，不用新 Director 替代原负责人。
- 审核必须使用全新 Director 子代理上下文，不继承制作历史、不恢复制作任务；传当前材料、要求和必要参考，不只传有利总结。逐图通常各用隔离任务，汇总者只聚合结论。可运行只读 Bash 检查，只写指定审核记录，不改被审材料。
- 主 AI relay 也不能提供所需角色上下文或独立审核时报告阻塞，保留未决 gate；禁止同上下文角色扮演或自审兜底，不把已有文件或任务成功当作审核通过。

- checker 的新提交/重试同样委托真实 Creator；depth1 时返回请求给主 AI 派 sibling Creator，再用原任务 ID 恢复同一个 checker。仅取回由 checker 按 recorded provider 执行，不因当前配置改变而重选。Skill 加载不替代角色任务。

## 定时任务和自动化

- Claude `CronCreate`、`CronList` 和 `CronDelete` 不是 Codex 中的字面工具名。
- 对于 `/auto-video`，优先使用 Codex automation 能力。
- 仅用户要求监控或已同意默认才启动；无 automation 时说明限制，获准后可外部周期性委托 check-video，传明确 target 和 unattended 意图，不要求用户 flags。
- 首次与周期检查都保留 Creator relay；只按有效末行 JSON 且 target 与监控目标一致决定停止。缺失/无效/跨目标结果不从 prose 推断停止。
- 不得绕过 check-video 和 Creator/provider 的 grants、inflight、当前审核与恢复边界。

## 模型提示

- Claude `model: opus` 和 `model: sonnet` 在 Codex 中仅作为提示信息。
- 在 Codex 中，除非用户明确要求切换模型，否则使用当前活动模型。

## 工具白名单

- 源 skill 中的 Claude `allowed-tools` 元数据在 Codex 中仅作为提示信息。
- 如果某个 Claude 工具名在 Codex 中不可用，不要仅因为工具名不同而失败，应按本映射执行。
- `Task`/`Agent` 以“Task 调用协议”为准；明确要求隔离的任务不得使用当前会话 fallback。

## Plugin-rooted Path 解析

源 skill 使用 `${CLAUDE_PLUGIN_ROOT}/...` 引用 plugin 内文件（meta rules / 跨 skill rules / scripts）。Codex 已**原生**为 plugin 进程设置 `CLAUDE_PLUGIN_ROOT` 环境变量（与 Claude Code 兼容；详见 OpenAI Codex plugins 文档）。

**bash 工具调用**：`${CLAUDE_PLUGIN_ROOT}` 由 bash 直接展开。例：
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "总集数"
```

**Read 工具调用 plugin 内文件**：Codex 不在 skill content 做 inline 替换。LLM 需先取得 literal 路径再用 Read：
1. 跑 bash `echo $CLAUDE_PLUGIN_ROOT` 取得绝对路径
2. 拼接构造完整路径
3. 用 Read 工具读取该绝对路径

或更简：用 bash `cat ${CLAUDE_PLUGIN_ROOT}/path/to/file` 一次性读取并加入上下文。

## 执行源 Skill

1. 读取 `${CLAUDE_PLUGIN_ROOT}/skills/auto-video/SKILL.md`；入口保留用户原始自然语言请求，内部 skill 使用当前委托，不构造位置参数。
2. 将 `${CLAUDE_PLUGIN_ROOT}/skills/auto-video/` 视为源 skill 目录。当源 skill 引用 `rules.md`、`config-template.md` 或 provider 同级指南时，相对该目录解析。
3. plugin directory 是 `${CLAUDE_PLUGIN_ROOT}`；plugin 内 scripts/agents/skills 相对它解析。项目的 story/assets/config.md 仍相对当前工作区根目录。
4. 执行本适配层时，不要复制或修改源 skill 说明。
