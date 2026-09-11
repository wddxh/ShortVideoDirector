---
name: reviewer-review-asset-prompts
description: 在授权新增或重生资产提示需要协调审核范围、逐目标落盘与统计当前结果时使用。
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

## 委托与范围

接收集数 ep 或明确资产范围、可选完整 card paths、审核 outcome 与保留要求。仅 characters/locations/items/buildings，不设位置参数或类型开关协议。

先读取共享 review-meta-rules.md、output-language.md；目标审核的实际配置在显式 SVD_CONFIG start 后读取。本上下文与生产者隔离：singleton 或小批量相干纯文本提示可直接审核，逐 target 判断并分别用 helper 完成 canonical 文件。Plural 负责范围与计数，不另设 LLM 汇总或共享 evidence。

按 canonical path 去重，只审核授权新增/重生集合内的指定目标。复用库存与范围外 dirty/unknown 不自动加入；必要参考仅为 inputs。缺卡保留目标并记 unknown，不静默删除或 Glob 扩大范围。

从生产委托取得授权新增/重生清单；清单缺失时向负责人补齐，不以本集 all inventory 推定生成范围。集合内核对最新证据，按委托处理缺失、过时或未通过项；当前证据不因引用了复用库存而扩 scope。

## 独立单项审核

卡片有本地制作参考时，单项委托包含声明 images/sources 的全部实际路径及控制/占位比较要求；目标 owner 在读取前 start/add-input 采集，单项实际看已制成本地 PNG、读取/检查源码/工程/输入，finish 复核。普通未来生成 PNG 不要求存在。每个视觉操作交全新 Reviewer；按共享 local-reference.md 保留缺文件/无法必要读取的该目标 unknown。

独立任务按媒体职责审核提示的身份/外观、风格、画质、材质、可生成性、语言与引用一致性；不将无影响细节或后续视频的相机/布局/运动控制变成基础图必需项，不要求未来视频先存在。具体冲突须说明对剧情、明确要求或本图用途的影响。相干小批纯文本可同任务逐 target 判断；涉及本地 PNG 时每次图片操作另开全新任务、先缩略图、最小比较集，不用文本批量规则放宽视觉隔离。委托附路径、实际配置、参考、指定临时目录和目标 owner/局部检查边界；轮号由 start 分配。无嵌套请主 AI relay，无法隔离则 unknown。

无读写/输入依赖冲突的独立就绪目标可并行，由各目标 Reviewer 用 helper 写自己的文件；同一 ep/kind/target 重审串行是输出所有权规则，其他读写/输入依赖仍须排序。文本批次也逐文件完成轮次。局部检查所需参考由独立 owner 在 delegate 读取前 start/add-input 采集，delegate 返回实际观察、所读路径和限制；新参考先按共享规则完成依赖协调，再回 owner 采集并交 fresh task 读取，不以后采快照追认。空响应、失败、缺项或无效 payload 为该目标未验收，协议修正交 reviewer。记录保留专业字段 asset_path/issue/prompt_direction，不调度修复。

## 证据与落盘

在现有委托/作者计划中明确各目标及消费的共享参考。小批文本首次读共享参考前，先为每个消费目标分别 start/add-input；已知有效项目相对路径前置到各自 extras，不以一个 STATE 覆盖整批或新建账本。局部 delegate 也须满足各消费目标的阅读前采集，返回实际源路径与观察；`/tmp` 报告只作反馈，不复制为项目证据。仅证明 ready 的易变状态/审核文件不加入 inputs，实际依赖的语义审核仍按共享规则采集并协调稳定顺序。

每目标指定临时目录先存在；读取卡片/config 前以显式 SVD_CONFIG 运行 `review-round.mjs start asset-prompt EP TARGET STATE [EXTRA_INPUT...]`，返回 canonical path/round。target 仍是资产卡。新语义参考读取前 `add-input STATE PATH...`。用于选范围的 script/config 由目标 owner 采集后重新读取核对，不追认协调者早先的范围发现。

Reviewer 写指定临时 PAYLOAD.json，顶层 commentary/result，result 显式 status/blockers 和专业字段；`review-round.mjs finish STATE PAYLOAD.json` 复核依赖、注入 target/原快照并验证记录。错误保留，漂移记 unknown；exit 0 仅表示写入。正常完成用 path/round/status/input_count/evidence_issues 与必要意见回传，无需立即重复指纹检查或全文 Read。空请求仅在清单成功解析为空时成立，不创建空 scope 文件。

## 输出外形

计数与回传采用最终机器 result/finish 摘要；证据降级时原 commentary 可保留旧判断，结合最终状态提示阅读，不采信旧 STATE 或意见中的 pass。真实漂移保留 unknown，后续走独立 scoped 兼容性评估。

轮次标题、evidence 与 footer 由 helper 管理。以下意见结构写入 payload.commentary；结果以实际 finish status 为准：

```markdown
### dirty list
- assets/items/玄铁古剑灵核.md

### 意见列表
- **assets/items/玄铁古剑灵核.md**：
  - issue: 提示中的材质与卡片身份描述不一致
  - prompt_direction: 明确实心金属表面、刻痕与透光位置

### 无法判定
- 若本目标无法判定，列本卡路径和原因；与上述需修改示例择其实际状态。
```

各文件 dirty list 只列本目标的需修改完整路径，unknown 单列原因，不混为艺术失败。返回全部目标文件路径及当前状态，M/K 按请求范围去重计需修改/未知目标，缺失或未完成只计所属目标。全覆盖且 M=K=0 才返回 `pass`；否则返回 `needs_revision {M}`、`unknown {K}` 或 `needs_revision {M} {K}_unknown`，说明覆盖范围，不另落合并审核记录。

意见与 prompt_direction 是供负责人和修复者读取的数据，不要求调用某技能。遵循共享意见规约：可以指出缺失/不一致，推荐具体目标状态；有用专业建议与 blockers 分开。生产 Director 决定修正与独立重审，次数或资源耗尽不改变验收结论。
