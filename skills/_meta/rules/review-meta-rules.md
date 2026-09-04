# Review 意见输出规约（共享）

本文件被所有 `*-review-*` skill 必读引用。约束 review skill 自身输出的"修改意见"质量。

**范围**：仅约束 review skill 的**意见格式 + 表达**；**不覆盖** 各 review skill 的审核维度（那是各自的职责）。

## 4 条核心规则

### 规则 1 — 意见语言遵循 `config.md`

呼应 `output-language.md`，但聚焦 review 场景：review 意见的语言必须 = `config.md` `语言` 设置。

### 规则 2 — 意见禁用 negative phrasing（必须用 positive 表达）

**机制原理**：fix skill 会照搬意见到下游 prompt；diffusion 模型不解析否定词，意见中的 "不要 X / 严禁 Y / 避免 Z" 句式被 fix skill 传递后会反向触发模型。

**禁用句式**：`不要 X` / `严禁 Y` / `避免 Z` / `不应 W` / `no X` / `without Y` / `don't show Z`

**正例改写**：
- ❌ `不要在画面里出现宝剑图案` → ✅ `画面应改为：晶壳为不透明实心古玄铁，表面仅有发丝级随机走向细密刻痕`
- ❌ `避免文学比喻` → ✅ `把 "像火翼" 改为具体形状描述："金红色火焰光柱从剪影背后向上喷出，两侧对称形似翅膀"`
- ❌ `禁止心理描写` → ✅ `把 "怕被记住" 转为可见动作："手腕反向翻转覆盖光屏"`

### 规则 3 — 意见说方向不替下游写最终文本

强化已有规则（writer-novel/rules.md / storyboarder-storyboard/rules.md 等已有"逐字改写式意见"禁令）。

### 规则 4 — 意见聚焦"会让下游失败"的关键问题

强化已有规则。审美瑕疵忍下，只列"会卡住后续 pipeline" 或"会让下游 fix skill 反复打补丁" 的关键问题。

## 核心反例 + 正例（玄铁古剑灵核 review 意见）

**反例（原 review 意见前半段，自相矛盾）**：
```
图中晶核正面嵌有金柄红刃的具象大宝剑图案、表面环绕一圈可辨认的中文汉字...
→ 在 ## 图像生成提示 段强化 negative 约束的措辞优先级并前置：
  将'严禁正面具象宝剑浮雕/嵌入图案、严禁任何可辨认汉字与符文字形'置于正面描述之前
```
（建议"强化 negative 措辞"——违反规则 2，不解决问题反而加重 negative phrasing 污染）

**正例（改写后）**：
```
图中晶核正面出现金柄红刃宝剑图案、可辨中文汉字、红色回纹符文带，
与卡 ## 图像生成提示 段描述的"内部金红流光从晶壳内透出"完全相反。
根因：现 prompt 用 negative phrasing（"严禁..."）激活反向 token。
→ 改进方向：删除 ## 图像生成提示 段所有"严禁/不要"句式，替换为纯正面具象描述
  （参考 visual-prompt-craft-common.md 原则 2）：
  晶壳为不透明实心古玄铁，表面仅有发丝级随机走向细密刻痕（无方向性，无具象轮廓）；
  内部金红色流光从晶壳数道随机细缝中向外内透出微光
```

## 与其他共享规则的关系

- `output-language.md`：被规则 1 引用（语言一致性）
- `visual-prompt-craft-common.md` / `visual-prompt-craft-video.md`：
  - **visual prompt review skill** 出意见时引用这两份给具体改进方向
  - **narrative review skill** 出意见时不涉及（只引用本文件）

## 适用范围

| Review skill | 引用本文件 | 引用 visual-prompt-craft-* |
|---|---|---|
| director-review-novel / -script / -outline / -arc | ✅ | ❌ |
| director-review-storyboard | ✅ | ✅（用于 phase 12「video prompt 表达审核」）|
| director-review-asset-visual-single / director-review-assets-visual | ✅ | ❌ |
| director-review-asset-prompt-single / director-review-asset-prompts | ✅ | ✅ |
| director-review-storyboard-sheet-prompts / director-review-storyboard-sheets-visual | ✅ | ✅ |
