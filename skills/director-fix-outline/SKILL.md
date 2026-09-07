---
name: director-fix-outline
description: 当现有单集大纲的因果、场景节奏、信息传达或结局需要按授权请求或当前 findings 修改时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

从委托确定目标集数、单集/系列语境、授权范围与具体意见，或读取指定的当前 findings / `.review-outline.md`。补充要求按本次授权理解，不要求内部参数格式；目标或范围不清先询问。

## 必读文件
- `story/episodes/{ep}/outline.md` — 必读 (现有大纲)
- 委托指定的请求 / findings；仅以 review 文件为依据时读取该文件，不要求历史 review 存在
- 实际配置 SVD_CONFIG（未设时 config.md）— 必读；本文及配套指南中的 config.md 均指该实际配置
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md` — 必读并严格遵循 (公共规则)
- `${CLAUDE_PLUGIN_ROOT}/skills/director-fix-outline/series.md` (when mode=series) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/director-fix-outline/short.md` (when mode=short) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 修订方法（参考）

### 选择相关参考
按当前委托选读 series.md / short.md。局部措辞可直接定位，事件或预算修改可追踪相关场景，不必重走全部阶段。当前意见、输出契约和时长边界仍须核实。

### Phase 2: 读 outline 与 review 意见

- Read `story/episodes/{ep}/outline.md` 现状
- Read 实际配置（SVD_CONFIG 或 config.md）
- 直接请求只使用本次意见；review 文件则取最新相关轮并核对问题仍存在于当前大纲。过时或冲突意见先协调，不自动拼接。
- 补充要求仅在本次授权内采用
- 按 mode 文件指引选读相关剧本、规划或小说，不要求可选材料齐备
- 通读修订意见, 把每条映射到具体事件 / 字段

### Phase 3: 按 mode 修正
- 场景太薄时可先想象现场：人物在什么位置、正在争取什么、对方怎样回应，再补足动作中的变化。比如“二人和解”可具体到一方移开挡路的椅子、另一方坐下；选择已有材料支持的行为，不为丰富画面擅加道具或新情节。该方法是局部诊断，不强制先写画面再写对白。
- 参考相关 companion 定位需要修改的字段
- 只改当前意见及授权内必要一致性；若影响其他场景或超出范围，说明依赖并先协调

### Phase 3.5: 时长字段修复（适用时）

完整大纲交付或时长相关修订缺可解析的 `- 目标时长: Ns` 字段时，按以下方式补足；局部请求发现范围外缺口先报告，不默默升级全文：

1. 对授权内受影响场景按真实表演、对白与动作估时，写纯文本 `- 目标时长: Ns`，紧贴 `### 场景 N: <标题>` 之下；已有加粗字段保留秒数、去除该行标记以匹配解析器，不为格式修正重估剧情
2. 按下方 Phase 4 读取实际配置并选择已确认边界，实跑 scene-duration.sh；与 director-outline/SKILL.md Phase 4.5 及剧本使用同一预算
3. FAIL 可参考 rules.md `## 时长规划原则` 在授权内取舍并复查，不把方法优先级当固定步骤；无法满足则报告冲突，不为 PASS 自动扩大修改范围或集目标

缺少时长不能声明预算通过；需要扩大范围时交 Director 协调。

### Phase 4: 自检
- 每条意见是否落地？
- 公共骨架完整 (本集信息传达 / 场景列表, 含纯文本 `- 目标时长: Ns` 字段)？
- 场景节奏角色、asset 引用规则未破坏？
- 按 mode 文件中"专属失败模式"自查

先保存修订，再运行文件校验：

```bash
DURATION=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "${SVD_CONFIG:-config.md}")
```

结合用户已确认的容差/严格限制换算秒数。仅已确认 ±10% 的单值用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/scene-duration.sh" "story/episodes/{ep}/outline.md" --target <N>`；显式范围/更严格限制用 `--target-min <M> --target-max <X>` 替换 target 参数，精确目标 M=X，不额外扩大。单值格式不代表同意容差；系列沿用初始共同目标，不以前集实际时长重设。

缺失、空白、读取失败、边界不清或冲突先交主 AI 澄清，不套旧模板或其他配置；已有明确决定不重复问。实跑记录 sum、边界、退出状态。失败仅在授权内修正后复查；无法解决则返回缺口或预算冲突，不自动拉长目标、不宣称整份验收通过，也不要求补建未采用的大纲。

### Phase 5: 输出
- 保存 `story/episodes/{ep}/outline.md` 的授权修订，保留无关内容
- 系列摘要按 series.md 的存在与授权条件同步，否则只报告影响

## 通用规则
- 场景边界按时空、戏剧任务与表演连续性判断，不以动作数强制拆合
- asset 引用: 所有 character/location 必须在 assets/ 已注册或在 `## 本集新增资产` 段（director-outline 阶段产物）列出. 修订时 asset id 严格遵循 director-outline/rules.md 「asset id 规则」（= 资产名, 禁止英文 prefix / kebab, 语言遵循 config.md「语言」设置）.
- 节奏角色互斥: 一场景只能挂一个节奏角色
- outline 仅维护规划期 `## 本集新增资产`，不得写回最终制作清单。Scriptwriter 在 script 中按真实场景更新库存。
- 报告主要事件、角色、信息传达及钩子变化对现有 novel / script / storyboard 的具体影响；由 Director 协调对应 owner 判断兼容性和复审范围，不自动宣布全部下游失效或重跑。
