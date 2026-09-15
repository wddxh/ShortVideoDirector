---
name: scriptwriter-script
description: 当故事需要可拍摄剧本、文学改编，或现成剧本需要采用、场景整理与制作资产识别时使用。
agent: scriptwriter
user-invocable: false
---

# Codex 适配器

这是生成的 Codex 适配层。源 skill 仍是唯一事实来源，位置为 `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/SKILL.md`。

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
- 每次 Write/Edit 内容保持 2000 字符以内，包括 JSON/YAML，不限制最终文件长度。普通短编辑可原位进行；JSON 按完整值/条目增量编辑，每次操作后值和整个文档都须完整有效，不在已发布 manifest 的引号内分次拼接不可分割的长字符串。
- 长值或条目超限时，事先协调读写方、目标/临时路径及发布时机，在授权路径内离开目标分步组装；待发布临时文档须与目标同文件系统。可分步写临时纯文本块，由本地小脚本按序合并并用 JSON 序列化器编码，不猜转义。完整临时文档须通过 JSON 语法解析及所需结构校验，再原子替换目标；失败保留原目标。patch、命令和脚本内容同受工具字符串长度限制，脚本也分步写入，不用巨大 heredoc/脚本载荷绕过限制。

## 本地环境报告与方法

按 `skills/_meta/rules/user-decision-relay.md` 的 Local Environment And Method Choice：项目初始化由有界授权的单一 Creator 全面检查支持工具，写固定 `story/work/shared/environment/environment.md` Markdown 报告，逐项记录真实 `pass`/`unavailable`、命令及路径、版本、backend、实际输出和限制；工具清单见 `skills/creator-local-reference/tools.md`。

后续 Creator/需要预览工具的 Reviewer 自行查询，纯文字角色不强制读，Director 不逐次传结果/路径。固定报告是常规 read 依赖，Director 仍集中维护 init/update writer 占用与 stable/等待条件，不假永久稳定。更新需有界授权单 owner；Reviewer 只读不自修。实际失败、环境变化或确切新增需求所需能力未被初始化证据覆盖时，补验更新受影响项；新增能力只验证该需求的未覆盖部分，不每任务探测、常规扫描版本或无理由重复验证。报告仅工具指导时默认不进 manifest.sources 或所有 review 语义 inputs；确用于验收判断时，owner 在该语义读取前 start/add-input，包括交给 helper 读取。

环境可用不指定工具。Director 交目标、完整源、完整 clean+caption MP4 交付要求及依赖权限；Creator 按镜头复用素材、补必要控制并选最简充分手段。除用户明确要求或合理已选局部，不预设批量 `.blend`/CUDA。静态设计与时间合成分别选法，授权返工可换方法；SVG 可选，既有交付与审核契约不新增流程 gate。

## Skill 调用

- 用户公开入口仅 short-video、series-video，支持斜杠入口和自然语言。edit-story、repair-story、generate-video、check-video、auto-video 是 AI 可发现、加载的内部知识，修改、恢复、提交、查询下载和持续监控工具仍按其契约运行。用户可直接说“修改 ep01 镜头 3 的动作”“恢复 ep01 中断的制作”“提交本地 ep01 的 task03”“查询 ep01 的 task03 并下载”“持续监控 ep01 已登记任务”或“停止 ep01 监控”，由 AI 按实际目标与授权加载并执行。
- 查看配置可用 `/short-video config`、`/series-video config` 或自然语言；只读报告当前配置，缺失不初始化。内部技能保持模型可调用；`user-invocable: false` 控制公开入口可见性，不设置 `disable-model-invocation` 来阻止内部知识加载。
- `使用 Skill tool 调用 <skill-name> skill` 表示在当前上下文加载对应 Codex 适配层。浏览 description 后选择所需知识，不因加载 skill 创建子代理。
- 如果不能直接调用 skill，则读取 `${CLAUDE_PLUGIN_ROOT}/skills/<skill-name>/SKILL.md`，按当前委托加载知识。
- 入口原始请求仅由宿主原生 `$ARGUMENTS` 传输，整体保留，不拆位置或构造索引。内部 skill 消费当前成果、材料、范围和约束，不编造调用参数串。
- `agent` 是知识的角色关联，不转移所有权。真正的角色委托由 Task 建立上下文；不得把 Skill 加载当作角色切换或审核隔离。

创作委托由顶层主 AI 担任 Director，负责用户交互、范围、授权、创作协调和最终制作材料；在当前上下文本地加载内部 `director-orchestrate`，不派发 director agent 或 fork。此规则只描述顶层主 AI，不把专家或 checker 变成 Director。生产规划、主入口与 orchestrate 不设 agent/fork；插件子代理为 reviewer、scriptwriter、storyboarder、creator，`reviewer-review-*` 关联 reviewer。工程委托由主 AI 作为工程负责人，使用与生产角色独立的工程 agents，不借用生产专家。

决策尽量前置：可预见关键选择已满足或明确委托后，在原授权内连续执行，不要求未知艺术细节、额外“开始吗”或逐轮 review/fix 批准。新问题先查配置、材料、grants 并由 Director/专家在权限内判断；仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才需完整决策包。进度不是确认请求，持续许可内动作不重复求同意，固定参数、初始集时长和操作授权边界不变。

生成意图以实际请求为准，不另问许可。short/series 包含所需资产图与本地参考，intake/审核后执行，始终停在付费视频提交前。后续明确提交请求由内部 generate-video 知识按原文与范围登记 initial_authorization，不追加握手。check/auto 仅在当前契约内延续登记 grants 或取回，不补新许可或无限重试。

AI 内部执行遵循 `${CLAUDE_PLUGIN_ROOT}/skills/generate-video/SKILL.md` 的 prepare 流程与 `${CLAUDE_PLUGIN_ROOT}/skills/creator-provider-dreamina/video.md` 的 guarded wrapper 文档。用户通过自然语言说明目标与范围；AI 维护所需授权记录。Prepared 任务仍须校验当前引用、审核、grants 与输入一致性，保留 submission、inflight 及既有状态保护。

摄影 shot 保留七字段及正整数秒，不受 provider 最短/70% 目标限制。用户原始集目标已确认的 ±10% 是主动可用的创作预算；Director 协调 owner 更新 canonical script/storyboard 与受影响下游，范围内不逐次求许可，原始基准不随本轮/前集合计滚动，精确要求优先。Creator 在设计后装组连续 shots，按核实模型最大 M 以 ceil(0.7*M)..M 为语义目标，不是机械下限；装组保留当前源时长、对白、切点，重设计交 owner，不暗中延时。`task-inputs/taskNN.json` 草稿恰为 `{shots,references}`，最终恰为 `{shots,references,prompt}`，prompt 是 Creator 写入的非空白字符串。文件名给稳定 task_id，成员按源顺序连续，每任务至少一个全组 MP4，条目仅 local PNG/MP4。最终 `--json` 返回 `{task_id,shots,timeline,prompt,duration,references,assetCards,sources,inputPath}`，prompt 原样来自 manifest，不重写；时间派生，不另存可编辑 offset/duration 或装组索引。

创作材料使用所选 provider 自有 material tool，具体命令、pack、token 计数/绑定和重基规则见该 provider 文档；Dreamina 见 `skills/creator-provider-dreamina/video.md`。草稿可供材料解析但不表示就绪。共享 assembler 仅提供无 provider token 的内部数据，不是公开通用 adapter；未来 provider 自行实现工具，无需 registry/framework/manifest schema 变更。同组源视频风格精确相同、materials 提取一次；最终 prompt 表达统一基线，可结尾重申必要全局要求。不同基线交 owner，源事实及对白完整保留。身份图按成员首次使用求并集在前，本地媒体在后，每镜链接须自身 header 声明，sources 不上传。

Creator 在视频参考/装组映射确定后读 materials 和 provider 语法，对每 task 实际源 shots/refs、事件、对白与时钟独立亲写完整 manifest.prompt，保留叙事、动作、对白原词、切点、时长及声音，绑定实际 tokens 并解释 BOX/颜色/身体/肢体代理的最终身份、解剖与动作。源局部时间转成明确任务时间；仅清理非成片源标题、内部 task/shot IDs、路径和审核元数据，保留有意上屏原词与 wide shot 等摄影词。缺源事实交 owner，不编造 use。Creator 自查实际最终 `--json` 后交 fresh shot-input Reviewer 核对源忠实度、完整性、局部适用性和集成；提交不改写。

提示表达按 [任务提示组织](${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-video.md#任务提示组织) 与 [每任务独立语义写作](${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md#每任务独立语义写作)：官方建议 1–4/7 及建议 5 转场在其范围内优先，6/extend 排除。公式指导组织，不分发 COMMON 成稿或用脚本/模板代写语义。每 task Creator 亲写，use 同步；独立完整稿可批量序列化。Reviewer 核对源忠实度、完整性、局部适用性和实际 purpose，不按词数、标题、面部细节数量或相同词验收。

转场与文字按 `skills/_meta/rules/transition-craft.md`：区分场内 UI、观众 SUPER/时间地点/章节/全屏卡和内部调试预览。clean MP4 无内部污染，可含正式文字与转场图像；预演底栏字幕仍内部非上传。Scriptwriter 拥有原词和时间事实，已有隔日事实可设计卡片，新跳时交 owner；Storyboarder 管阅读窗口/切点，独立卡计镜头数与预算，叠字不重复计时，装组不加秒。Creator 可选本地文字引导，Reviewer 查来源/原词/阅读/对比/注意/揭示，观众文字不套演员阅读面，不因文字或黑底失败。源/输入验收不保证成片模型质量，不笼统禁字或承诺准确性。

tasks.json 保持数组，task_id 唯一并保存 shots/prompt/duration/typed references，输出 `videos/taskNN.mp4`；submission 保留四元组与有序媒体指纹。Grants 为 `{decision,episode,task_id,shots,constraints}` 加真实可选次数；reserve 前当前 manifest 成员等于 record/grant，错误身份、成员/输入漂移或部分选组零调用、不改次数。取回按 recorded ID/provider，保留 grants/inflight/submitted/done/真实状态。统计按生成任务，human_needed 为 `{ep,task_id,shots,reason}`，每 ep/task_id 一条完整成员；monitor 仍 epNN/all。

就绪用 check-shot-inputs.mjs 及 script/storyboard/asset-visual/shot-input；新生图另审 asset-prompt。整集源 1..N 且每镜分配一次，任务按首成员排序；局部允许源缺号、目标存在且选完整组。全局查组重叠/缺失源成员，局部不要求未选媒体或完整全片计划。未分配请求/部分组报告完整成员与额外镜头，不静默扩授权。

shot-input target 为 `task-inputs/taskNN.json`，纯文本 owner 验收最终参考与 prompt 集成、时钟和接点：整集覆盖所有相邻组（含场/幕），局部只取必要邻界及实际非相邻/跨集依赖，不附全计划哈希。fresh helper 比较实际选中 clean MP4 尾/头相干窗口和两端 prompt，披露音频实听/仅存在/计划；J/L-cut 源原句一次，独立生成音频不虚称无缝。每个消费 owner 预采 inputs 且观察仍适用时复用独立配对事实，不强制两端重复视觉 pass 或建账本。必要邻组缺失只使受影响 target unknown，不扩生成授权。源码/记账变化沿用 scoped 兼容性评估，不盲刷哈希；无具体冲突复用 storyboard 判断。保留五种 kind、fresh task、缩略图及既有 gates，不审生成视频或授权自动剪辑。主 AI/general 负责工程与测试。

通用 storyboard-to-prompt 的 `.sh` 与 `.mjs` 均显式传 `--json STORYBOARD TASK_ID EP`，仅原样返回最终 manifest.prompt，不生成或改写文本。EP 与 canonical storyboard 路径一致；task_id 来自 manifest 文件名，不从首镜推导或与宿主代理任务 ID 混用。最终 `--json` 要求非空白字符串 prompt；草稿不能通过最终审核/就绪，既有 shot-input target 指纹绑定 manifest.prompt。generate-video 把最终原文存入 tasks.json，保留 submission 快照；gate/reserve 比较最终 manifest 的 prompt/duration/references，不比较源拼接文字，不增加 kind/gate/最终提示文件/账本或迁移。

## Native User Decision

摄影按 camera-language 保留节拍、证据、先后/重叠与注意。参考遵循 [参考用途与精细度](${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md#参考用途与精细度)：按 actual purpose 选粗/细，细模可采用已有结构/材质或只借空间，不强模仿动作。粗白模普通移动优先无肢/翼 BODYBOX；必要代理保留相容支撑与阶段，带肢/翼须最终 prompt 写相关完整动作序列，不扩本地 rig。抽象本身不失败，具体源冲突须修；必要证据不足 unknown，独立证据、fresh task、缩略图和 gates 保持。

素材时窗与用途按 [参考区间与采用维度](${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md#参考区间与采用维度) 同步到 use/最终 prompt，保留完整源动作、情绪意图及代理归属，局部动作不扩成全片循环。上传清除内部轨迹线、坐标、camera cone 和调试标签，保留正式 film text；抽象分工可说明省略，不能反转矛盾媒体事实。转场过程见 [转场过程表达](${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/transition-craft.md#转场过程表达)，沿源切点与预算，不加示例秒数或 extend。

独立生成 TASK 边界默认强烈优先采用有剪辑动机、明显不同的机位／视点／景别，以降低近似构图独立生成差异的显眼程度。每个相邻接点按源意图判断：同一连续事件保持必要动作进度、持有/接触、空间与声音的相容延续；场/幕或时空跳转判断因果、情绪、信息、主题反差或平行关系与观众定位，不套同一事件标准，不强制同位置、续动作、连续声音或过桥场。源支持的悬念、突兀感与硬切不必顺滑或立即解释；同集底层身份与世界事实一致，有意变化须有源依据。沿已有动机切点装组，相似镜头可同组；实际需要的匹配／重复构图保留，关键接触或必须无缝续声可行时同组，在现有交接说明取舍，不新增许可。此偏好不是每镜变化、每切一任务或角度配额，不保证连续性或豁免违背源意图的错接。TASK 不等于场景或幕，约束内可含多镜/多场，不强制幕结构、停步、终姿、停顿、下组重启或叠化；运动中硬切有效，不要求相同帧。参考与最终 prompt 保留对应接点意图及必要局部事实。保留源时长、连续成员、模型最大值及 grants；源重设计由 Director/owner 在原始预算内同步。

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

- 派发（含嵌套/relay）沿现有自然语言 handoff：Director 集中核对 active 依赖，明确有界可读依赖及 stable/等待对象和就绪条件、精确允许写入路径/targets、child 委托许可与升级条件。子任务不继承 Director 全局上下文或账本；专家管理本地顺序，向 child 完整转交相关精确 scope、依赖及当前状态，不带全历史。调用方无法建立边界时，只读定位并报告缺口，不假定全局稳定或开始依赖它的制作。未知/新增依赖、共享写冲突、新写入或扩 scope、升级条件先沿 handoff 回 Director 再派发/执行；依赖变化由 Director 集中重排并转交新边界/状态，不自动取消任务。
- 同文件编辑（含不同章节）串行；写入改变 active reader 依赖的内容/语义或使证据失效时，等实际读取工作完成，无实际依赖冲突的读写可并行。整文件指纹证据仍需文件稳定，相关输入有 writer 时等稳定交回再审核。Director 保留整棵受托子树读写占用，直至父任务及真实后代工作全部完成，期间不自行写入或派冲突 writer；异步 running、父任务有限返回或错误不释放未完成工作。实际 child 句柄、精确 scope、依赖及运行/实际完成/阻塞状态沿 handoff 回传；已允许、稳定且独立的 child 无需额外逐 child 握手、重复用户许可或新 Director task。无需新增 registry/schema/调度器/锁文件或轮询；depth relay 保留相同边界/状态。
- Claude `Task` 或 `Agent` 在嵌套可用且满足上述范围/依赖时直接派发 sub-agent，应用 `${CLAUDE_PLUGIN_ROOT}/agents/<role>.md`，传递成果、参考路径、范围、约束与决策余地并等待结果。角色自行发现和加载方法，不要求命名 skill 链。
- Task/Agent 异步返回后台通知/等待指示时，先做无依赖工作，再按宿主原生等待/让出协议接收原任务结果并继续原授权委托；等待进度或子任务有限返回不是最终验收/父委托完成。不轮询代理状态、不用 sleep 等代理、不重复启动同一任务。Provider 按 recorded ID 查询/下载仍遵守原有有界轮询契约，区别于代理等待。宿主确实不能自动唤醒/续接时报告未完成范围与需外部再次触发的实际限制，不承诺自主循环、不重问继续许可，不新增 daemon/timer/账本。
- 工具可见不代表嵌套深度允许。在本会话记住已确认的能力；明确深度/嵌套拒绝或工具缺失才转 relay，普通任务失败不是嵌套失败。确认不可嵌套后不反复探测，不自动调整宿主配置/深度。
- 嵌套不可用时实际请求角色返回协议 payload，由顶层主 AI/Director 忠实派 sibling 目标角色，等待后用宿主任务/agent ID 恢复原请求上下文并返回实际结果（OpenCode 对应 task_id），不寻找或新建不存在的 Director 任务。保留会话能力结论，跨所有者建议由主 Director 协调。每次视觉操作仍新任务，不恢复 image-heavy task；后续视觉工作另建 fresh task，实际结果仍返回原请求方。
- 审核使用全新独立 reviewer task，加载 reviewer-review-*，传当前材料、要求和必要参考，不带生产者历史。每个 ep/kind/target 的 Reviewer 用 helper 写自己的 canonical 文件；相干小批纯文本可逐 target 判断、分别落盘，无读写/输入依赖冲突的就绪视觉目标默认并行。同一 ep/kind/target 重审串行是输出所有权规则，其他读写/输入依赖仍须排序，不同审核输出不证明输入安全。每轮 scope=[target]、一个完成 result、真实 inputs 和唯一 footer。Plural 协调范围、覆盖与计数，不设共享账本或必需 LLM 汇总者。局部检查 delegate 回实际观察与限制给指定独立目标 owner；每次视觉操作仍新任务、helper 缩略图及最小图集。缺失/不可解析/未完成仅影响所属目标；只写受托记录及下述指定临时文件，主 Director/生产者不自签 pass，保留 grants/state 和真实哈希。
- 用 `review-evidence.mjs path KIND EP TARGET` 返回 canonical 路径：`reviews/epNN/script.md`、`storyboard.md`；`reviews/epNN/assets/<category>/<name>.asset-prompt.md` / `.asset-visual.md`（target 仍为资产卡）；`reviews/epNN/task-inputs/taskNN.md`（target 为 task manifest）。保留五种 runtime kind；可选规划仅 prose：`reviews/epNN/outline.md`、`reviews/story/arc.md`。
- 五种 runtime 审核默认用 `review-round.mjs`：指定 `/tmp/opencode/<task>` 目录先存在，在读取制作材料前以显式 `SVD_CONFIG="{config_path}"` 执行 `start KIND EP TARGET STATE [EXTRA_INPUT...]`；新语义参考首次读取前 `add-input STATE PATH...`。STATE/payload 是指定临时目录内不同的绝对路径，STATE 绑定配置和首次哈希，不在工作区复制账本。Reviewer 只写受托 canonical 记录及该目录内 state/payload/必要预览，独立撰写 `{commentary,result:{status,blockers,...}}` 后 `finish STATE PAYLOAD.json`；helper 注入 target/inputs、复核并验证记录，不手写哈希 JSON。采集/发现错误保留，漂移保留首次哈希且 finish 记 unknown；缺显式 status 的 payload 无效。exit 0 仅表示记录写入，实际 path/round/status/input_count/evidence_issues 和必要意见足以回传，正常完成不要求立即再 fingerprint、check-target/checkTarget 或全文 Read。错误/诊断按需查，下游 gates 不变。可选规划 Markdown 不使用此 helper。
- 局部视觉 delegate 所需参考由独立目标 owner 在委托读取前 start/add-input 采集，delegate 返回实际观察、所读路径、预览依据和限制；新参考先回 owner 采集再交 fresh task 读取，不以后采快照追认，不需 import registry。逐 target 并行、独立语义判断、每次全新视觉上下文及 helper 缩略图保持不变。
- shot-input 任务视频集成由纯文本独立 owner 总审：先 start 再读最终 prompt/timeline/manifest/必要源文本，看图前规划相干视觉窗口、关键切点、接触/阅读阶段和必要外部配对。owner 从不加载图片、帧、contact sheet 或图像附件；实际查看全交 fresh Reviewer 小型最小必要 helper 缩略图集。单资产视觉叶子仍可直接完成有限查看及自身记录，不强制分层。唯一 ep/kind/target 轮次由 owner start/finish；视觉 helper 不写同目标记录、不另开竞争轮次、不改 owner STATE，只写指定临时预览/文本反馈。
- owner 在 helper 读取前采集实际 inputs，新依赖先回未读路径，经 Director 协调和 owner add-input 再交 fresh task。helper 只回文本事实、时间/帧、原路径/指纹、采样与预览映射及限制，区分所见与源码推断，不给 target pass、不附图。owner 独立核对全文集成、跨窗口关系和覆盖，必要缺口另派有界新任务，不机械合并局部通过；必要证据仍缺 unknown、明确冲突 needs_revision，采样不证明完整运动。嵌套可用直接委托，确认不可用则沿用限制，由 Director 派 sibling 并按真实句柄恢复原纯文本 owner 传回事实，绝不恢复视觉 helper。实际 scope/依赖/后代和子树占用保持至完成；有限委托返回不是审核或制作完成。不新增账本、schema、帧配额、gate 或完整 rig。
- 主 AI relay 也不能提供所需角色上下文或独立审核时报告阻塞，保留未决 gate；禁止同上下文角色扮演或自审兜底，不把已有文件或任务成功当作审核通过。

- checker 的新提交/重试同样委托真实 Creator；depth1 时返回请求给主 AI 派 sibling Creator，再用原任务 ID 恢复同一个 checker。仅取回由 checker 按 recorded provider 执行，不因当前配置改变而重选。Skill 加载不替代角色任务。

## 定时任务和自动化

- Claude `CronCreate`、`CronList` 和 `CronDelete` 不是 Codex 中的字面工具名。
- 用户明确请求持续监控时，AI 加载内部 auto-video 知识，优先使用实际可用的 Codex automation 能力。
- 日常使用以单次自然语言提交、查询和下载为主，持续监控由明确请求触发。无 automation 时说明限制，获准后可外部周期性委托内部 check-video 知识，传明确 target 和 unattended 意图，不要求用户 flags。
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

1. 读取 `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/SKILL.md`；入口保留用户原始自然语言请求，内部 skill 使用当前委托，不构造位置参数。
2. 将 `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/` 视为源 skill 目录。当源 skill 引用 `rules.md`、`config-template.md` 或 provider 同级指南时，相对该目录解析。
3. plugin directory 是 `${CLAUDE_PLUGIN_ROOT}`；plugin 内 scripts/agents/skills 相对它解析。项目的 story/assets/config.md 仍相对当前工作区根目录。
4. 执行本适配层时，不要复制或修改源 skill 说明。
