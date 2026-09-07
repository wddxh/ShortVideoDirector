---
name: creator-storyboard-sheet-prompts
description: Use when current shots need storyboard-sheet panel planning, continuity diagnosis, or scoped card synchronization.
user-invocable: false
agent: creator
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
model: sonnet
---

# Storyboard Sheet Prompts

## 输入

必须读取：
- 委托本集的 `story/episodes/{ep}/storyboard.md` 与 `script.md`；资产清单以 script 为准。读取同目录相关 review 的当前范围证据，而非仅检查最后标题“通过”。
- 实际配置（`SVD_CONFIG` 或 `config.md`），取得语言、视频比例/风格、共享及 sheet 专属图像设置与参数选择授权。
- Glob `assets/**/*.md`，建立资产名和真实路径映射；按 storyboard 当前 shot 实际引用读取所需资产卡。
- `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`，包含 card schema、引用契约和分板建议；格数与构图由 Creator 根据当前 shot 判断。
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md`，用于具体目标状态、层次表达与资产引用。
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md`，按其 scope、最新目标轮次、完整 footer、results 与 inputs 身份判断验收。

### 委托上下文

从委托取得 ep、目标 shots、规划/同步/诊断目的、可写范围和保留要求。`full` 与 `incremental` 是返回的同步范围分类，不是内部命令语法；没有范围不默认全量。比如“只同步 ep01 的 shot03 与 shot08，其他卡保留”属于定向范围；非法或不存在的 shot 返回具体问题，重复目标去重。

## 边界

唯一可写产物是 `assets/storyboard-sheets/{ep}/shotNN.md`。不修改 storyboard、config、基础资产或 review，不生图或删除图片；为诊断连续性可读取必要图片。加载方法不转移角色；Director 另行委派独立 reviewer，不把本地自检当作验收。

skill frontmatter 的 `allowed-tools` 只会收窄 skill 权限，不能恢复 `agents/creator.md` 未授予的 agent tools；因此 Creator agent 必须同时具备 Grep 和 Bash。

编号有两种严格用途：文件名保持 canonical `shotNN.md`；card H1 写 `# shotNN Storyboard Sheet`，基本信息的对应分镜展示为 `shot N`（N 是无前导零整数），Panel heading 从 `### PANEL 01` 起连续编号，数量字段写 `- Panel 数量：M`。不得把对应分镜写成 `shotNN`，也不得省略 `Panel` 后的空格。

每张生产 card 只规划一个当前已验收 storyboard shot。资产缺失或不在 script 清单时，将对应 shot 记入 failed 并提出定位清楚的修正建议，不臆造路径或替代物。

Card 不复制源 shot。转换器读取实际源完整 shot，加上 card 的完整 Panel 规划与整板绘制要求组成一次请求；源叙事权威不由摘要替代。`图像生成提示` 只写格式、阅读顺序、比例、风格与 labels，不再压缩转述剧情。对白/旁白/声音完整进入上下文以帮助姿态和表情，静态 beats 按视觉信息选择，不逐句配格、不为文字密度加格。

## 规划与同步边界

以下提供检查视角，可先处理最难的动作分解或连续性；实际写入仍须满足依赖与授权。定向修正优先保留可用 Panel，全新复杂动作宜先比较关键姿态，再决定格数，避免机械均分。
调用方提供预期成果、参考材料、目标与权限，不选择 Creator 的内部技能或强制设计步骤。`full`/`incremental` 仅报告本次覆盖范围，不是工序名称。

先确认委托和制作前用户审批（若有）。生产写入前核对 script/storyboard 的当前 pass，相关卡片须符合剧本事实；若采用已有图片作视觉依据，再核对该范围的视觉证据，不要求纯文字 Panel 规划先有图片。运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...`，将实际输入身份与对应证据逐项比对。最新声明目标的轮次不完整、缺 result 或哈希过时均保持未验收，不能回退旧 pass 或自行刷新哈希。

`node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check {ep} [SHOT...]` 是整集/选镜交付检查，SHOT 为十进制编号；它会检查尚未生产的 sheets，不能把其总 exit 1 当成禁止开始制作的循环前提。此处只核对当前制作依赖；缺失或过时依赖交由 Director 协调审核/兼容性评估。诊断可继续，但未验收探索不写为 canonical 生产卡。card 写完也不自动委派审核或生图。

- 源镜头：按 storyboard 全集顺序 `### shot N` 确认身份；文件名为 `shotNN`，card 的对应分镜为 `shot N`。时长、景别、机位/运动、人物、资产和带时间码的 beat 提供规划事实。
- 引用依赖：源 header 与 sheet 补充的 character、location、item、building 并集须在 script 清单且解析到现有 `.md`；无需重抄源声明。Sheet 只引用这些资产与可选相邻前镜 sheet；复用时核对继承事实和当前视觉依据，不因文件存在就沿用旧结论。缺声明/图片交责任方，不靠重写摘要消除依赖。
- 文件准备：写入前确认目标父目录，缺失时用 Bash 执行 `mkdir -p "assets/storyboard-sheets/{ep}"`，不假设首次制作已有目录。
- `full` 范围：仅在整集同步获授权时检查所有 shot，创建缺卡、修改不兼容部分、保留适用内容；不是整篇覆写。确认 orphan 且删除在授权内才用 `rm -- "{orphan_path}"` 删除其 `.md`，不删 PNG。
- `incremental` 范围：仅处理委托目标，其他卡保持不动，不删除 orphan。若发现增删、重排或编号变化，报告受影响映射并请求扩大同步范围，不自动升级为 full 或覆盖邻卡。
- 规划成果：四项图像设置须来自当前能力及授权；完整 Panel 与整板要求分别写足，画布及内部视频比例一致。失败 shot 不写半成品；独立且已授权的其他 shot 可继续。
- 落盘核对：重新读取目标 card，确认 section 顺序、时间覆盖、链接与 Markdown 子集；JSON 转换检查完整 prompt、images、settings 与 sourcePath，不独立猜测上传集合。只报告磁盘实际变化；兼容旧卡不自动清理冗余提示，不扫描改写未授权项目。

禁止用 Bash 写 card；Bash 仅可用于 `mkdir -p` 创建目标目录、只读校验，以及在 `full` 中用 `rm --` 删除已确认的 orphan `.md`。

## 返回

返回机器可辨且人类可读的摘要，七项均须出现：

```text
mode: full | incremental
created: shotNN ...
updated: shotNN ...
preserved: shotNN ...
deleted: shotNN ...
failed: shotNN: reason ...
actual changed shots: shotNN ...
```

`actual changed shots` 是 `created + updated + deleted` 的去重集合；无项目写 `none`。调用方必须分别解析三项，不能把 deleted 映射为 card path。incremental 返回中必须能证明未请求 shots 被 preserved。
