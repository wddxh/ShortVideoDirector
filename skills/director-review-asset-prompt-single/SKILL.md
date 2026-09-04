---
name: director-review-asset-prompt-single
description: Director审核单个 asset 的图像提示词表达质量（无 negative phrasing / 无文学比喻 / 显式分解 / 资产引用分场景 / 语言合 config）。不读图，仅看 .md 卡。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

## 输入

### 文件读取
- `$ARGUMENTS[0]` (asset_path) — 必须读取（asset .md 卡，仅文本）
- 仅当 asset_path 位于 `assets/keyframes/` 下：按 .md 卡 `## 引用资产` 区块中引用的 character / location / item / building 资产，逐个 Glob 定位 `assets/**/{资产名}.md` 并读取（**仅文本，不读图**）
- 仅当 asset_path 在 `assets/keyframes/` 下：除上一条「引用 character/location/item/building 资产逐个 Glob 定位」外，还须 Glob `assets/{characters,locations,items,buildings}/*.md` 全集获取**全部已注册 asset 名列表**（仅读各卡 `## 基本信息` 段的名字行，跳过其他内容以控制成本），用于 Step A 漏引检查的语义匹配候选池
- 仅当 asset_path 含 dash（疑似衍生）或 `## 基本信息` 中 `类型: 衍生资产`：读取 `基础资产` 链接指向的 .md 卡（用于 Step B 递归检测）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md` — 必须读取（5 条核心原则 + 反例）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

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
5.5 **Step A: keyframe 引用关系完整性**（仅 asset_path 在 `assets/keyframes/` 下）：
   - 漏引：扫 prompt 正文，用 LLM 语义识别裸名字 OR 等效描述命中已注册 asset 名（候选池来自输入段 Glob 全集）→ 检查是否在 `## 引用资产` 区块声明 → 未声明 → 报错
   - 超引：`## 引用资产` 区块声明的 asset 在 prompt 正文未出现裸名字 → 提示性意见（非硬错），模板："`## 引用资产` 声明 [X] 但 prompt 正文未出现裸名字 → 请确认：(a) prompt 是否用了等效描述代替裸名字（建议改裸名字消除歧义）；(b) 还是确实想保留参考图意图（无需修改，但建议在 prompt 后追加 `[参考: X]` 注释明示）"
   - 死链：`## 引用资产` 区块声明的路径 Glob 不存在 → 报错
5.6 **Step B: 衍生资产 schema 完整性**（`类型: 衍生资产` 主路径触发；或路径含 dash 但 `类型` 字段非 {衍生资产, 造型变体, 关键帧} fallback 警告）：
   - 缺 `基础资产` / 缺 `基础类型` / `基础类型` 值越界（非 {character, location, building, item}）/ `基础资产` 链接 Glob 不存在 / `基础资产` .md 的 `类型` 字段 = 「衍生资产」（违反主题 10 禁止递归派生）→ 均报错（fallback 模式输出提示性意见）
6. **决策输出**：通过 → 空字符串；需修改 → 单条 JSON 对象

### 常见误区（失败模式）

- **读图** — 本 skill 不读 PNG，只读 .md 文本 — 严禁 Read PNG
- **评描述合理性** — "描述合理性" 是 narrative review 的职责，本 skill 只评 prompt 表达是否污染下游
- **挑刺到不可能通过** — 每张 prompt 都能想出"更优写法"，本 skill 是质量门槛不是优化器 — 只拦"会让图像生成失败 / 显著降质 / 反向触发模型" 的关键问题
- **替 fix 写最终 prompt 文本** — 本 skill 只给"prompt_direction"（方向），不给完整改写 — 完整改写由 creator-fix-asset 决定
- **意见用 negative phrasing** — 违反 review-meta-rules.md 规则 2 — 意见必须用 positive 表达（"应改为 X / 替换为 Y"，禁用 "不要 / 严禁"）
- **漏引仅查裸名字字符串** — 模型只 grep 裸名字命中 → 漏掉等效描述的隐式漏引 — 必须用 LLM 语义识别
- **超引判硬错** — 把超引作 issue 硬错 → 让作者无法保留参考图意图 — 仅提示性意见
- **衍生资产 schema 不检查递归** — 「基础资产」指向另一衍生 → 违反主题 10 但不报错 → 后续图生图链路断 — Step B 必须 Read 基础 .md 确认 `类型` 字段非「衍生资产」

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

补充示例（覆盖 Step A 漏引 / Step B 衍生 schema）：

```json
// keyframe 漏引示例
{
  "asset_path": "assets/keyframes/ep01/KF-EP01-005.md",
  "issue": "prompt 正文出现等效描述 [玄铁剑]（『黑色长剑，剑身古老纹路』），但 `## 引用资产` 区块未声明该 asset，下游 keyframe-to-prompt.sh 拿不到参考图",
  "prompt_direction": "在 `## 引用资产` 区块添加 `- [玄铁剑](../../items/玄铁剑.md)`；prompt 正文改用裸名字「玄铁剑」消除歧义"
}
```

```json
// 衍生资产 schema 示例
{
  "asset_path": "assets/locations/古宅-焚毁.md",
  "issue": "`## 基本信息` 缺 `基础类型` 字段，下游 creator-image-dreamina 档 2 step 3 无法推导基础 png 路径",
  "prompt_direction": "按 creator-create-assets/rules.md 衍生资产模板补 `基础类型: location` 字段"
}
```

## 规则

- 只读不写，无文件操作
- 单 asset 只输出一条（通过为空 / 需修改为单 JSON 对象）；多个问题合并为一条 issue + 一个 prompt_direction
- 不输出"通过"字样的文字——空字符串即代表通过（汇总层据此判断）
- 意见本身必须符合 review-meta-rules.md（无 negative phrasing / 用 config 语言 / 说方向不替写）

## 输出

### 返回内容
- 空字符串（通过）或单条 JSON 对象（需修改） → 返回给 `director-review-asset-prompts` 汇总层
