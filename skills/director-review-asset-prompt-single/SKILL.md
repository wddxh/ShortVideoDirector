---
name: director-review-asset-prompt-single
description: Director审核单个 asset 的图像提示词表达质量（无 negative phrasing / 无文学比喻 / 显式分解 / 资产引用分场景 / 语言合 config）。不读图，仅看 .md 卡。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob
model: opus
---

## 输入

### 文件读取
- `$ARGUMENTS[0]` (asset_path) — 必须读取（asset .md 卡，仅文本）
- 仅当 asset_path 位于 `assets/keyframes/` 下：按 .md 卡 `## 引用资产` 区块中引用的 character / location / item / building 资产，逐个 Glob 定位 `assets/**/{资产名}.md` 并读取（**仅文本，不读图**）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/visual-prompt-craft-common.md` — 必须读取（5 条核心原则 + 反例）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — asset_path（如 `assets/characters/沈昭.md` / `assets/items/玄铁古剑灵核.md` / `assets/keyframes/ep01/KF-EP01-005.md`）

## 职责描述

### 核心使命

判断单个 asset 的 `## 图像生成提示` 段（asset .md 卡内的 prompt 字段）是否符合 visual-prompt-craft-common.md 全部 5 条原则 + output-language.md 语言一致性。**本 skill 不评描述本身的合理性**（描述合理性归 narrative review 职责）；本 skill 只判 prompt 表达是否会污染下游图像生成。**只读不写**。

### 工作思路

1. **建立审核基准**：读 visual-prompt-craft-common.md 全部 5 条原则 + output-language.md 语言规则
2. **读 asset .md 卡**：定位 `## 图像生成提示` 段
3. **逐项核查 5 条原则**：
   - 原则 1：是否电影摄影指令式（不是小说叙事）
   - 原则 2：是否含 negative phrasing（"严禁/不要/避免/无 X" 句式）
   - 原则 3：复杂效果是否显式分解（参数具体）
   - 原则 4：是否含文学比喻 / 隐喻 / 心理描写
   - 原则 5：资产引用是否按场景规则使用
4. **语言一致性核查**：prompt 字段语言是否 = config.md `语言` 设置
5. **keyframe 特殊处理**：若 asset_path 在 `assets/keyframes/` 下，读取引用的 character / location / item .md 文本（不读图），核查正文是否用裸名字（不重复描述外观）
6. **决策输出**：通过 → 空字符串；需修改 → 单条 JSON 对象

### 常见误区（失败模式）

- **读图** — 本 skill 不读 PNG，只读 .md 文本 — 严禁 Read PNG
- **评描述合理性** — "描述合理性" 是 narrative review 的职责，本 skill 只评 prompt 表达是否污染下游
- **挑刺到不可能通过** — 每张 prompt 都能想出"更优写法"，本 skill 是质量门槛不是优化器 — 只拦"会让图像生成失败 / 显著降质 / 反向触发模型" 的关键问题
- **替 fix 写最终 prompt 文本** — 本 skill 只给"prompt_direction"（方向），不给完整改写 — 完整改写由 creator-fix-asset 决定
- **意见用 negative phrasing** — 违反 review-meta-rules.md 规则 2 — 意见必须用 positive 表达（"应改为 X / 替换为 Y"，禁用 "不要 / 严禁"）

## 输出格式

通过时返回**空字符串**（无任何文字）。

需修改时返回单条 JSON 对象（无 markdown 包裹）：

```json
{
  "asset_path": "assets/items/玄铁古剑灵核.md",
  "issue": "## 图像生成提示 段含 negative phrasing（'严禁正面立体大宝剑浮雕'），将反向触发宝剑/汉字/符文 token",
  "prompt_direction": "删除所有'严禁/不要'句式，替换为纯正面具象描述（参考 visual-prompt-craft-common.md 原则 2）"
}
```

字段含义：
- `asset_path`：原样回传输入
- `issue`：发现的问题（一句话说清违反哪条原则 + 具体根因）
- `prompt_direction`：prompt 改进方向（说方向，不写最终 prompt 文本；必须用 positive 表达）

## 规则

- 只读不写，无文件操作
- 单 asset 只输出一条（通过为空 / 需修改为单 JSON 对象）；多个问题合并为一条 issue + 一个 prompt_direction
- 不输出"通过"字样的文字——空字符串即代表通过（汇总层据此判断）
- 意见本身必须符合 review-meta-rules.md（无 negative phrasing / 用 config 语言 / 说方向不替写）

## 输出

### 返回内容
- 空字符串（通过）或单条 JSON 对象（需修改） → 返回给 `director-review-asset-prompts` 汇总层
