---
name: director-review-asset-prompts
description: 在本集或指定基础资产提示需要独立审核汇总时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 委托与范围

接收集数 ep 或明确的全局资产范围、可选完整 card paths、审核 outcome 与保留要求。basic-only，仅 characters/locations/items/buildings，不审核 storyboard sheets。不设位置参数或类型开关协议。

读取共享 review-meta-rules.md、output-language.md 与实际配置 SVD_CONFIG（未设时 config.md）。本上下文是与生产者分离的新 Director 汇总者，只处理范围所需文本、真实单项结果和证据，不读 PNG，不代单项 reviewer 作提示质量判断。

显式路径按 canonical path 去重，只审指定目标，可包含复用资产；历史 dirty/unknown 不自动加入。范围外未解决记录原样保留，另报生产 Director。缺卡保留目标并记 unknown，不静默删除或 Glob 扩大范围。

未指定目标时，用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all` 获得本集新增与复用全集，验证最新证据，仅审缺失、过时、未通过项。明确委托全局资产审核且未给路径时，才列举四类基础卡；`assets/.review-asset-prompts.md` 不替代集内验收。历史纯 pass 不跳过身份核对，显式目标仍审核。

## 独立单项审核

每个目标交全新 Director context，委托审核该卡提示的身份表达、可生成性、语言与引用一致性，附目标路径、实际配置、相关参考、只读边界和所需 result JSON。Reviewer 自行发现方法，不要求加载指定 skill。无嵌套时请主 AI 忠实 relay；无法提供隔离则 unknown，不在汇总上下文自审。

按资源选择并行或串行，例如每批最多五项；这不是审核门禁。收齐原始结果，空响应、技术失败、缺项或非法 JSON 均为 unknown，协议修正交原 reviewer。结果保留 target/status/inputs/blockers 及 asset_path/issue/prompt_direction；不自动接受、不调度修复。

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
