---
name: director-review-asset-prompts
description: 在授权新增或重生资产提示需要独立单项、小批量审核或汇总实际分项结果时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 委托与范围

接收集数 ep 或明确资产范围、可选完整 card paths、审核 outcome 与保留要求。仅 characters/locations/items/buildings，不设位置参数或类型开关协议。

读取共享 review-meta-rules.md、output-language.md 与实际配置 SVD_CONFIG（未设时 config.md）。本上下文与生产者隔离：singleton 或小批量相干纯文本提示可直接审核、逐 target 出结果并写受托轮次；只有实际分开的 reviewer 结果需合并时才担任只读结论的汇总者。

按 canonical path 去重，只审核授权新增/重生集合内的指定目标。复用库存与范围外 dirty/unknown 不自动加入；必要参考仅为 inputs。缺卡保留目标并记 unknown，不静默删除或 Glob 扩大范围。

从生产委托取得授权新增/重生清单；清单缺失时向负责人补齐，不以本集 all inventory 推定生成范围。集合内核对最新证据，按委托处理缺失、过时或未通过项；当前证据不因引用了复用库存而扩 scope。

## 独立单项审核

卡片有本地制作参考时，单项委托包含声明 images/sources 的全部实际路径及控制/占位比较要求；单项须看已制成本地 PNG、读取/检查源码/工程/输入并采前后指纹。普通未来生成 PNG 不要求存在。汇总者“不读 PNG”不适用于独立单项的本地参考审核，仍只收原始结论，不自行补 pass；按共享 local-reference.md 保留缺文件/无法必要读取的 unknown。

独立任务审核提示的身份表达、可生成性、语言与引用一致性。相干小批纯文本可同任务逐 target 判断；涉及本地 PNG 时每次图片操作另开全新任务、先缩略图、最小比较集，不用文本批量规则放宽视觉隔离。委托附路径、实际配置、参考、受托轮次或子结果边界；无嵌套请主 AI relay，无法隔离则 unknown。

协调者串行分配同一 review 文件的写入，singleton/文本批次直接完成自己的轮次，无需二次 LLM 汇总。确需并行分项时仅返回子结果，由独立汇总者写合并轮次。空响应、失败、缺项或非法 JSON 为 unknown，协议修正交 reviewer；结果保留 target/status/inputs/blockers 及 asset_path/issue/prompt_direction，不调度修复。

## 证据与落盘

集内路径为 `story/episodes/{ep}/.review-asset-prompts.md`。按最大标题轮号续轮，保留未完成历史；阅读目标前声明 kind=`asset-prompt`、scope 和 results=[] 的开工块，暂不写 footer。用于选范围的 script/config 也须阅读前 fingerprint，按共享规则合入依赖它们的 result.inputs。

完成时每个 scope target 恰好一个 result。单项 inputs 保留原快照，终检全部依赖；同路径不同摘要是漂移，不选最新值覆盖。按共享规则更新同一证据块，写 Markdown 意见与唯一 `<!-- /round-{N} -->`，Read 自检结果覆盖、证据和 footer；写入失败不能返回 pass。空 scope 只有清单成功解析为空才成立。

## 输出外形

每轮保留 `## 第 {N} 轮 ({timestamp}) - 通过` 或需修改/无法判定标题；heading-only 不通过。以下意见结构放在完整 evidence 与 footer 之前：

```markdown
### dirty list
- assets/items/玄铁古剑灵核.md

### 意见列表
- **assets/items/玄铁古剑灵核.md**：
  - issue: 提示中的材质与卡片身份描述不一致
  - prompt_direction: 明确实心金属表面、刻痕与透光位置

### 无法判定
- assets/characters/沈昭.md: 无法读取当前卡片
```

dirty list 只列需修改完整路径；unknown 单列原因，不混为艺术失败。M/K 是本轮去重的需修改/未知目标数。落盘成功后返回 `pass`、`needs_revision {M}`、`unknown {K}` 或 `needs_revision {M} {K}_unknown`，说明仅覆盖当前范围。

意见与 prompt_direction 是供负责人和修复者读取的数据，不要求调用某技能。遵循共享意见规约：可以指出缺失/不一致，推荐具体目标状态；有用专业建议与 blockers 分开。生产 Director 决定修正与独立重审，次数或资源耗尽不改变验收结论。
