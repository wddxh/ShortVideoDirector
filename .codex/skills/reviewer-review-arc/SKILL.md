---
name: reviewer-review-arc
description: 在已选用 arc 规划且需要独立框架评估时，审查节点分配、人物弧和关键转折。
agent: reviewer
user-invocable: false
---

# Codex 适配器

这是生成的 Codex 适配层。源 skill 仍是唯一事实来源，位置为 `${CLAUDE_PLUGIN_ROOT}/skills/reviewer-review-arc/SKILL.md`。

不要手动编辑这个适配层。只有在确实需要改变 Claude 行为时才修改源 skill，然后运行 `python3 .codex/build-codex-skills.py` 重新生成适配层。

## 运行时映射

# Codex 运行时映射

`skills/` 是跨平台知识的源。Codex 加载 `.codex/skills/` 下生成的适配层；适配层应用本映射，再按当前委托读取源 skill。

## 文件和 Shell 工具

- Claude `Read` 表示读取当前工作区中的本地文件。
- Claude `Write` 表示在受托路径创建或覆盖本地文件；审核允许指定临时目录内的 helper STATE、payload 和必要预览。
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

创作委托由顶层主 AI 担任 Director，负责用户交互、范围、授权、创作协调和最终制作材料；在当前上下文本地加载内部 `director-orchestrate`，不派发 director agent 或 fork。此规则只描述顶层主 AI，不把专家或 checker 变成 Director。生产规划、主入口与 orchestrate 不设 agent/fork；插件子代理为 reviewer、writer、scriptwriter、storyboarder、creator，`reviewer-review-*` 关联 reviewer。工程委托由主 AI 作为工程负责人，使用与生产角色独立的工程 agents，不借用生产专家。

决策尽量前置：可预见关键选择已满足或明确委托后，在原授权内连续执行，不要求未知艺术细节、额外“开始吗”或逐轮 review/fix 批准。新问题先查配置、材料、grants 并由 Director/专家在权限内判断；仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才需完整决策包。进度不是确认请求，持续许可内动作不重复求同意，固定参数、初始集时长和操作授权边界不变。

生成意图以实际请求为准，不另问许可。short/series 包含所需资产图与本地参考，intake/审核后执行，始终停在付费视频提交前。后续手动 generate-video 请求由入口按原文与范围登记 initial_authorization，不追加握手。check/auto 仅在当前契约内延续登记 grants 或取回，不补新许可或无限重试。

摄影 shot 保留七字段及正整数秒，不受 provider 最短/70% 目标限制。Creator 在设计后将连续 shots 装组，按核实模型最大 M 以 ceil(0.7*M)..M 为语义目标，不是机械下限；保留时长、对白、切点，不改写或延长场景/整集。`task-inputs/taskNN.json` 恰为 `{shots,references}`，文件名给稳定 task_id，成员按源顺序连续，每任务至少一个全组 MP4，条目仅 local PNG/MP4。Converter 返回 `{task_id,shots,timeline,prompt,duration,references,assetCards,sources,inputPath}`，时间派生，不另存可编辑 offset/duration 或装组索引。

相同单行 `视频风格` 原字段在任务级输出一次，仅从成员移除此字段；不同基线交 owner。保留其他字段、对白、空格、续行和 prose，仅行首结构 bracket cue 重基到任务时钟，内联经过时间明确仍是具名 shot 本地时间。Creator 统一媒体参考时钟、内部切点及声音桥；身份图按成员首次使用求并集在前，本地媒体在后，每镜链接须自身 header 声明，sources 不上传。BOX 控制相机/布局/位置/整体轨迹，动作表情在 prompt。

tasks.json 保持数组，task_id 唯一并保存 shots/prompt/duration/typed references，输出 `videos/taskNN.mp4`；submission 保留四元组与有序媒体指纹。Grants 为 `{decision,episode,task_id,shots,constraints}` 加真实可选次数；reserve 前当前 manifest 成员等于 record/grant，错误身份、成员/输入漂移或部分选组零调用、不改次数。取回按 recorded ID/provider，保留 grants/inflight/submitted/done/真实状态。统计按生成任务，human_needed 为 `{ep,task_id,shots,reason}`，每 ep/task_id 一条完整成员；monitor 仍 epNN/all。

就绪用 check-shot-inputs.mjs 及 script/storyboard/asset-visual/shot-input；新生图另审 asset-prompt。整集源 1..N 且每镜分配一次，任务按首成员排序；局部允许源缺号、目标存在且选完整组。全局查组重叠/缺失源成员，局部不要求未选媒体或完整全片计划。未分配请求/部分组报告完整成员与额外镜头，不静默扩授权。

shot-input target 为 `task-inputs/taskNN.json`，保留五种 kind；审核最终集成/delta、任务时钟、内部切点/声音桥及必要外部边界，无具体冲突复用 storyboard 判断。按故事选相邻/非相邻/跨集配对，比较位置、轨迹、状态、轴线和身份，实际依赖入 inputs，不附全计划哈希。源码/记账变而媒体未变可独立 scoped 兼容性评估，有依据续签，不盲刷哈希或自动全量重审。每次视觉操作仍新 task、缩略图与最小配对；缺必要证据 unknown。主 AI/general 负责工程与测试。

Converter 的 `.sh` 与 `.mjs` 入口均显式传 `--json STORYBOARD TASK_ID EP`，EP 与 canonical storyboard 路径一致；task_id 来自 task manifest 文件名，不从首镜编号推导，也不与宿主代理任务 ID 混用。

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
    "nesting_unavailable": "main_director_relay_resume_requester",
    "review_context": "fresh_without_producer_history",
    "relay_unavailable": "blocked_no_self_review"
  }
}
```

- 用户决策须读取并遵循 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md`。原角色一次给齐相关问题计划及每题背景、全部选项/解释和取舍；费用不自动设字段。主 AI 先读全，按 Native User Decision 沿作者题界完整呈现当前题，不只给链接或摘要；补充解释单独标明，缺失/截断请作者补齐。原始答复及全部条件按题对应批量送回原角色原上下文，Director 与各层 relay 不压缩；无人值守仅报告需决策并保留完整计划供后续逐题交互，不擅自提问或代选。

- Claude `Task` 或 `Agent` 在嵌套可用时直接派发 sub-agent，应用 `${CLAUDE_PLUGIN_ROOT}/agents/<role>.md`，传递成果、参考路径、范围、约束与决策余地并等待结果。角色自行发现和加载方法，不要求命名 skill 链。
- 工具可见不代表嵌套深度允许。在本会话记住已确认的能力；明确深度/嵌套拒绝或工具缺失才转 relay，普通任务失败不是嵌套失败。确认不可嵌套后不反复探测，不自动调整宿主配置/深度。
- 嵌套不可用时实际请求角色返回协议 payload，由顶层主 AI/Director 忠实派 sibling 目标角色，等待后用宿主任务/agent ID 恢复原请求上下文并返回实际结果（OpenCode 对应 task_id），不寻找或新建不存在的 Director 任务。保留会话能力结论，跨所有者建议由主 Director 协调。每次视觉操作仍新任务，不恢复 image-heavy task；后续视觉工作另建 fresh task，实际结果仍返回原请求方。
- 审核使用全新独立 reviewer task，加载 reviewer-review-*，传当前材料、要求和必要参考，不带生产者历史。每个 ep/kind/target 的 Reviewer 用 helper 写自己的 canonical 文件；相干小批纯文本可单任务逐 target 判断、分别落盘，独立就绪视觉目标默认并行直写各文件。仅同一 ep/kind/target 重审串行；每轮 scope=[target]、一个完成 result、真实 inputs 和唯一 footer。Plural 协调范围、覆盖与计数，不设共享账本或必需 LLM 汇总者。局部检查 delegate 回实际观察与限制给指定独立目标 owner；每次视觉操作仍新任务、helper 缩略图及最小图集。缺失/不可解析/未完成仅影响所属目标；只写受托记录及下述指定临时文件，主 Director/生产者不自签 pass，保留 grants/state 和真实哈希。
- 用 `review-evidence.mjs path KIND EP TARGET` 返回 canonical 路径：`reviews/epNN/script.md`、`storyboard.md`；`reviews/epNN/assets/<category>/<name>.asset-prompt.md` / `.asset-visual.md`（target 仍为资产卡）；`reviews/epNN/task-inputs/taskNN.md`（target 为 task manifest）。保留五种 runtime kind；可选规划仅 prose：`reviews/epNN/outline.md`、`novel.md`、`reviews/story/arc.md`。
- 五种 runtime 审核默认用 `review-round.mjs`：指定 `/tmp/opencode/<task>` 目录先存在，在读取制作材料前以显式 `SVD_CONFIG="{config_path}"` 执行 `start KIND EP TARGET STATE [EXTRA_INPUT...]`；新语义参考首次读取前 `add-input STATE PATH...`。STATE/payload 是指定临时目录内不同的绝对路径，STATE 绑定配置和首次哈希，不在工作区复制账本。Reviewer 只写受托 canonical 记录及该目录内 state/payload/必要预览，独立撰写 `{commentary,result:{status,blockers,...}}` 后 `finish STATE PAYLOAD.json`；helper 注入 target/inputs、复核并验证记录，不手写哈希 JSON。采集/发现错误保留，漂移保留首次哈希且 finish 记 unknown；缺显式 status 的 payload 无效。exit 0 仅表示记录写入，实际 path/round/status/input_count/evidence_issues 和必要意见足以回传，正常完成不要求立即再 fingerprint、check-target/checkTarget 或全文 Read。错误/诊断按需查，下游 gates 不变。可选规划 Markdown 不使用此 helper。
- 局部视觉 delegate 所需参考由独立目标 owner 在委托读取前 start/add-input 采集，delegate 返回实际观察、所读路径、预览依据和限制；新参考先回 owner 采集再交 fresh task 读取，不以后采快照追认，不需 import registry。逐 target 并行、独立语义判断、每次全新视觉上下文及 helper 缩略图保持不变。
- 主 AI relay 也不能提供所需角色上下文或独立审核时报告阻塞，保留未决 gate；禁止同上下文角色扮演或自审兜底，不把已有文件或任务成功当作审核通过。

- checker 的新提交/重试同样委托真实 Creator；depth1 时返回请求给主 AI 派 sibling Creator，再用原任务 ID 恢复同一个 checker。仅取回由 checker 按 recorded provider 执行，不因当前配置改变而重选。Skill 加载不替代角色任务。

## 定时任务和自动化

- Claude `CronCreate`、`CronList` 和 `CronDelete` 不是 Codex 中的字面工具名。
- 对于 `/auto-video`，优先使用 Codex automation 能力。
- 仅用户要求监控或已同意默认才启动；无 automation 时说明限制，获准后可外部周期性委托 check-video，传明确 target 和 unattended 意图，不要求用户 flags。
- 首次与周期 checker payload 均显式传 canonical config_path 或 UNRESOLVED，并沿 Creator relay 保留。UNRESOLVED 只允许取回并报告 human_needed，空值是传输错误，不选择默认；配置操作显式验证绑定路径并共用 SVD_CONFIG。只按有效末行 JSON 且 target 匹配决定停止，缺失/无效/跨目标结果不从 prose 推断。
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

1. 读取 `${CLAUDE_PLUGIN_ROOT}/skills/reviewer-review-arc/SKILL.md`；入口保留用户原始自然语言请求，内部 skill 使用当前委托，不构造位置参数。
2. 将 `${CLAUDE_PLUGIN_ROOT}/skills/reviewer-review-arc/` 视为源 skill 目录。当源 skill 引用 `rules.md`、`config-template.md` 或 provider 同级指南时，相对该目录解析。
3. plugin directory 是 `${CLAUDE_PLUGIN_ROOT}`；plugin 内 scripts/agents/skills 相对它解析。项目的 story/assets/config.md 仍相对当前工作区根目录。
4. 执行本适配层时，不要复制或修改源 skill 说明。
