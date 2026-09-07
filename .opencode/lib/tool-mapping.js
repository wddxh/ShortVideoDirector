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
生成意图以实际请求为准，不另问图片/视频生成许可：short/series 包含所需新增资产图和分镜板图，intake/审核后执行，但始终停在视频提交前。用户后续手动 generate-video 请求由入口按原文与解析范围登记 initial_authorization，无额外批准握手；check/auto 仅延续已登记 initial/retry grants 或取回，不补新生成许可或无限重试，不强制首次提交前询问重试。
决策尽量前置：可预见的关键选择已满足或明确委托后即在原授权内连续执行，不要求未知艺术细节、额外“开始吗”或逐轮 review/fix 批准。新问题先查配置、材料与 grants 并用 Director/专家判断处理；只为用户指定检查点、缺必要权限或无法内部解决的关键冲突准备下述决策包。进度仅陈述，持续许可内动作不重复求同意；固定参数、初始用户集时长、覆盖/首次/重试/inflight 和视频独立入口边界不变。
用户决策完整性涵盖原角色的整份计划和每道当前题：文件/章节先读全，当前题含相关背景、全部适用选项/解释及取舍，不摘要或只给链接。主 AI 补充单独标明；Director relay 对计划及批量原始答复/全部条件不压缩。无人值守仅报告需决策并保留完整计划供后续逐题交互。详见入口必读的 user-decision-relay.md。剧情未指定且基本意图充分时默认三个完整候选故事，不先问谁决定；明确数量、已有剧本/选定方向/委托优先。技术计划按每个 scope 的未决 provider -> model -> 相容 ratio -> resolution 给出明确兼容选择/分支，主 AI 依条件逐题呈现，跳过固定/继承/已委托项，不把无关技术设置当候选探索前置。

主 AI 负责用户沟通、范围和授权；Director 拥有创作协调与最终制作材料，专家拥有各自 craft。委托通过 task 的 subagent_type 选择目标角色，prompt 说明预期成果、参考路径、范围、约束、决策余地及升级条件，不规定 skill 链。专家浏览 description，按需调用 \`skill({ name: "<name>" })\`；Skill 仅在当前上下文加载知识，不派发任务、不改变角色、不建立审核隔离。

嵌套 task 可用时直接委托并等待结果。工具可见不代表深度允许；在会话中记住已确认的嵌套能力。只有明确的深度/嵌套拒绝或工具不可用才判为不能嵌套，普通任务失败应按原任务处理，不能混淆。确认不能嵌套后不要每次重试，也不自动更改宿主配置或深度。

不能嵌套时，Director 返回目标 role、outcome、references、scope、constraints；主 AI 忠实转交给目标角色，再用 task_id 恢复同一个 Director 任务并传回实际结果。后续请求沿用本会话能力结论；主 AI 不自行安排创作顺序。其他角色的跨所有者建议由 Director 决定。若主 AI 也无法提供所需角色上下文，报告阻塞，不在当前上下文冒充专家任务。

审核必须新建独立 Director task，不复用制作 task_id 或继承制作历史；传当前材料、要求和必要参考，不能只传有利总结。逐图审核通常各用新任务，汇总只读结论。审核者只写分配的 review 记录，可用 Bash 做只读检查，不改被审材料。relay 也无法提供独立上下文时报告阻塞，禁止同上下文自审或伪造 pass。`;

export const ENTRY_WORKFLOW_DISPATCH_DISCIPLINE = `## 派发约束（OC 专用）

${ROLE_HANDOFF_GUIDANCE}

### 分段策略

每次 Write/Edit 内容不得超过 2000 字符，所有格式同样适用。切勿单次 Write 提交完整长内容；按自然段、逐镜头、逐 JSON 条目或 YAML 顶层 key 增量写入，单元过长仍需拆分。

文本 Edit 的 oldString 使用上一段末尾唯一片段。JSON 数组先写有效骨架和首条，再以结束括号片段为 anchor 追加；对象嵌数组同理。保留结构完整性，不让主 AI 预先决定创作篇幅。

### 长度原则

限制仅针对单次写入，不限制最终文件总长度。不要为了避免分段而省略必要内容。
`;
