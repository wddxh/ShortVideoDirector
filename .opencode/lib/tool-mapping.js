// Shared OpenCode role handoffs and write discipline. No scheduling engine.
export const USER_INVOCABLE_ENTRY_WORKFLOWS = new Set([
  'series-video',
  'short-video',
  'edit-story',
  'repair-story',
  'generate-video',
  'check-video',
  'auto-video',
]);

export const NATIVE_QUESTION_GUIDANCE = `
当前决策全文展示后，主 AI 必须使用可用的原生 question 键盘选择器；每次 questions 恰好一项，multiple:false。角色提供问题、全部选项/解释和稳定短标签；标签与全文一一对应，长解释放在控件前，不删选项。以下仅示范 schema，不是剧情或默认答案：
\`\`\`json
{"questions":[{"header":"剧情方向","question":"本次采用哪个候选？","options":[{"label":"A","description":"候选 A（完整正文见上文）"},{"label":"B","description":"候选 B（完整正文见上文）"},{"label":"C","description":"候选 C（完整正文见上文）"},{"label":"Director 决定","description":"委托 Director 在以上候选中选择"}],"multiple":false}]}
\`\`\`
原角色一次提供全部可预见相关问题/表、明确题界和条件分支。主 AI 读全并内部保留计划，只沿作者题界拆分展示，每题保留全部适用选项/解释，不有损改写或提前倾倒全表。等答复再问下一适用题，不并行提问；相关原始答复及全部条件批量完整回原角色原任务，不逐题往返。仅缺内容/映射、不相容或计划外新决定才提前回询。只应用作者所给条件，不推断 provider 知识；若委托模型须专家解析且无后续分支，先回原角色再问依赖项，按 scope 跳过已答/继承/已委托项。Markdown 全文是控件前解释，不替代可用控件。工具不可用或 schema 无法容纳全部选择时说明限制，用同标签单题文本回退；不改权限/框架。Claude 暴露 AskUserQuestion 时按 schema 用一题、multiSelect:false；Codex 按 request_user_input 映射及当前模式限制，不改模式或隐藏选项。
`;

export const ROLE_HANDOFF_GUIDANCE = `
${NATIVE_QUESTION_GUIDANCE}
生成意图以实际请求为准，不另问许可：short/series 包含所需资产图和本地参考，intake/审核后执行，始终停在付费视频提交前。后续手动 generate-video 请求由入口按原文和范围登记 initial_authorization；check/auto 仅在当前契约内延续登记 grants 或取回，不补新许可或无限重试，不强制首次提交前问重试。
当前 manifest 只有 references，条目仅 local PNG/MP4，每镜至少一个 MP4；converter/task 保存 prompt/duration/typed references，submission 保存四元组与有序媒体指纹。静态相机可用静态 clip。资产图提供身份，BOX 控制相机/布局/位置/整体轨迹；动作表情在 prompt，作品基线每请求一次。就绪用 check-shot-inputs.mjs 与 script/storyboard/asset-visual/shot-input 证据；asset-prompt 只审授权新增/重生集合。整集编号 1..N，选镜允许缺号且目标须存在。取回按 recorded ID/provider，保留 grants/inflight/真实状态。
shot-input 审核聚焦实际 prompt/media 集成、必要边界和变化细节；已有 storyboard 判断在无具体冲突时复用。按故事选相邻/非相邻/跨集配对，比较位置、轨迹、状态、轴线与身份，实际依赖存 inputs 指纹。源码/记账变化且渲染媒体未变可独立 scoped 兼容性评估，说明依据后续签，不能盲刷哈希或自动全量重审。每次视觉操作仍新 task、缩略图与最小配对；缺必要证据为 unknown。保留五种 review kind，主 AI/general 负责工程与测试。
首次及周期 checker payload 均显式传 canonical config_path 或 UNRESOLVED，并沿 Creator relay 保留。UNRESOLVED 只允许取回并报告 human_needed，空值是传输错误，不选默认；配置操作显式验证绑定路径并共用 SVD_CONFIG。
决策尽量前置：可预见的关键选择已满足或明确委托后即在原授权内连续执行，不要求未知艺术细节、额外“开始吗”或逐轮 review/fix 批准。新问题先查配置、材料与 grants 并用 Director/专家判断处理；只为用户指定检查点、缺必要权限或无法内部解决的关键冲突准备下述决策包。进度仅陈述，持续许可内动作不重复求同意；固定参数、初始用户集时长、覆盖/首次/重试/inflight 和视频独立入口边界不变。
用户决策完整性涵盖原角色的整份计划和每道当前题：文件/章节先读全，当前题含相关背景、全部适用选项/解释及取舍，不摘要或只给链接。主 AI 补充单独标明；Director relay 对计划及批量原始答复/全部条件不压缩。无人值守仅报告需决策并保留完整计划供后续逐题交互。详见入口必读的 user-decision-relay.md。剧情未指定且基本意图充分时默认三个完整候选故事，不先问谁决定；明确数量、已有剧本/选定方向/委托优先。技术计划按每个 scope 的未决 provider -> model -> 相容 ratio -> resolution 给出明确兼容选择/分支，主 AI 依条件逐题呈现，跳过固定/继承/已委托项，不把无关技术设置当候选探索前置。

主 AI 负责用户沟通、范围和授权；Director 拥有创作协调与最终制作材料，专家拥有各自 craft。委托通过 task 的 subagent_type 选择目标角色，prompt 说明预期成果、参考路径、范围、约束、决策余地及升级条件，不规定 skill 链。专家浏览 description，按需调用 \`skill({ name: "<name>" })\`；Skill 仅在当前上下文加载知识，不派发任务、不改变角色、不建立审核隔离。

嵌套 task 可用时直接委托并等待结果。工具可见不代表深度允许；在会话中记住已确认的嵌套能力。只有明确的深度/嵌套拒绝或工具不可用才判为不能嵌套，普通任务失败应按原任务处理，不能混淆。确认不能嵌套后不要每次重试，也不自动更改宿主配置或深度。

不能嵌套时，Director 返回目标 role、outcome、references、scope、constraints；主 AI 忠实转交给目标角色，再用 task_id 恢复同一个 Director 任务并传回实际结果。后续请求沿用本会话能力结论；主 AI 不自行安排创作顺序。其他角色的跨所有者建议由 Director 决定。若主 AI 也无法提供所需角色上下文，报告阻塞，不在当前上下文冒充专家任务。

审核必须新建独立 Director task，传当前材料、要求和必要参考。singleton 直接写受托轮次；相干小批纯文本可单任务逐 target 判断并落盘。协调者串行安排同 review 文件写入；仅实际分开的 reviewer 结果需合并时用独立汇总者。每次视觉操作仍新任务、helper 缩略图及最小图集。审核者只写受托记录及临时预览；生产者不能编造 pass，无隔离则阻塞。可选规划按需采用。`;

export const ENTRY_WORKFLOW_DISPATCH_DISCIPLINE = `## 派发约束（OC 专用）

${ROLE_HANDOFF_GUIDANCE}

### 分段策略

每次 Write/Edit 内容不得超过 2000 字符，所有格式同样适用。切勿单次 Write 提交完整长内容；按自然段、逐镜头、逐 JSON 条目或 YAML 顶层 key 增量写入，单元过长仍需拆分。

文本 Edit 的 oldString 使用上一段末尾唯一片段。JSON 数组先写有效骨架和首条，再以结束括号片段为 anchor 追加；对象嵌数组同理。保留结构完整性，不让主 AI 预先决定创作篇幅。

### 长度原则

限制仅针对单次写入，不限制最终文件总长度。不要为了避免分段而省略必要内容。
`;
