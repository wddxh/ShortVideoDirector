---
name: "director-review-asset-visual-single"
description: "通用 single asset visual review。review 一个 asset (含 keyframe) 的 .md 卡描述 vs 对应 .png 是否匹配。"
metadata:
  svd-context: "fork"
  svd-agent: "director"
  svd-user-invocable: "false"
  svd-model: "opus"
---

> **执行上下文**：本 skill 被设计为由 `director` 子代理通过 `task` 工具派发执行。当你看到此 skill 内容时，你已在正确的子代理上下文中；按下方流程执行即可。

## 输入

### 文件读取
- `$ARGUMENTS[0]` (asset_path) — 必须读取（asset .md 卡，文本）
- `$ARGUMENTS[1]` (image_path) — 必须读取（**唯一允许读的 PNG**）
- 仅当 asset_path 位于 `assets/keyframes/` 下：按 .md 卡中引用的 character / location / item / building 资产，逐个 Glob 定位 `assets/**/{资产名}.md` 并读取（**仅文本，不读图**）
- `story/episodes/{ep}/script.md` — 必须读取（完整剧本，用于判定"剧情逻辑被打断"。若文件不存在则跳过 A 标准第 1 条的剧情依赖判断，仅按禁忌内容判定）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — asset_path（如 `assets/characters/张三.md` 或 `assets/keyframes/ep01/KF-EP01-005.md`）
- `$ARGUMENTS[1]` — image_path（对应 .png 路径，如 `assets/images/characters/张三.png`）
- `$ARGUMENTS[2]` — ep（如 `ep01`）。必填；用于定位 `story/episodes/{ep}/script.md`。非 ep 相关的全局 asset（如跨集 character/location）传入"当前正在审核的 ep"即可

## 职责描述

### 核心使命

判断**一张 asset 图**（character / location / item / building / keyframe 任一类型）是否忠实实现了其 .md 卡的描述。直接下游是汇总层 `director-review-assets-visual`：本 skill 输出空字符串（通过）或 JSON `{asset_path, image_path, issue, prompt_direction}`（需修改）。**本 skill 不评描述本身的合理性**——描述合理性是 narrative review 的职责；本 skill 只判"图是否实现了描述"。**只读不写**。

### 工作思路

1. **建立"应有画面"基准**：读 asset .md 卡，特别关注 `## 视觉描述` / `## 图像生成提示` 等段落，脑中重建"这张图应该长什么样"
2. **看图对比基准**：Read image_path，逐项核对外观元素（角色长相/服装 / 场景特征 / 道具样式 / 光线 / 构图 / 主体位置等）是否与卡描述一致
3. **keyframe 特殊处理**：若 asset_path 在 `assets/keyframes/` 下，从 .md 中识别引用的 character/location/item/building 资产，Glob 找到其 .md 卡并读取**文本**——比对图中对应元素外观与被引用资产卡描述是否一致（**不读被引用资产的 PNG**，跨 asset 一致性由 creator-create-assets 模板保证）
4. **prompt 改进方向归因**：若发现问题，定位到 .md 的具体段落（`## 视觉描述` 或 `## 图像生成提示`）给出改进方向
5. **A 标准（仅以下两条触发打回）**：
   1. 严重偏离卡描述以致下游分镜/剧情逻辑被打断（如卡说"红衣"图是"白衣"，且 script.md 中有"她那身红衣很扎眼"这类直接依赖颜色的台词/动作）
   2. 剧情禁忌内容（明星脸 / 商标 / 真实地名等替换兜底失败）

   **其他偏差一律通过**：颜色色调微差、服饰细节略简、背景元素增减、构图机位偏差、光线氛围差异、姿态略不同 — 全部通过，不打回。

   **判断"剧情逻辑被打断"的依据**：必须能在 script.md 中找到具体台词/动作直接依赖被偏离的视觉特征；找不到 = 不算打断 = 通过。

### 常见误区（失败模式）

- **读多张图** — 读 sibling asset PNG / 上一帧 PNG / 引用 asset 的 PNG，违反 1-image 约束 — 只允许读 image_path 这 1 张
- **卡描述误判** — 把"卡描述本身不到位"误判为"图的渲染问题"打回 — 本 skill 只评图实现度，描述合理性归 narrative review
- **keyframe 特殊性误用** — 把 keyframe 当成特殊类型加专属逻辑（如读上一帧 PNG 做时序衔接、跨 keyframe 一致性判断）— keyframe 与其他 asset 同等对待，唯一差异是引用了别的资产卡
- **引用 asset 卡未读** — review keyframe 时不读 character / location 卡 → 无法判断"图中角色外观是否对" — keyframe 必须读所有引用 asset 的 .md 文本
- **替 fix 写 prompt** — 把"prompt 改进方向"写成完整 prompt 文本 — 只说方向，prompt 字面操作由 fix 决定
- **挑刺到不可能通过** — 每张图都能想出"更好的画面"，本 skill 是质量门槛不是优化器 — 只拦"图与卡描述明显不符"
- **A 标准误用** — 把颜色色调微差 / 背景元素增减 / 构图偏差等审美瑕疵打回 — A 标准下只打回剧情逻辑断裂 + 禁忌内容两类，其余通过
- **剧情依据虚构** — 声称"画面偏差影响剧情"但 script.md 中找不到具体台词/动作支撑 — 必须找到具体支撑句才能以"剧情逻辑断裂"打回

## 输出格式

通过时返回**空字符串**（无任何文字）。

需修改时返回单条 JSON 对象（无 markdown 包裹）：

```json
{
  "asset_path": "assets/characters/张三.md",
  "image_path": "assets/images/characters/张三.png",
  "issue": "图中张三穿白衬衫，但卡 ## 视觉描述 明确为黑色风衣",
  "prompt_direction": "在 ## 图像生成提示 段强调服装描述：黑色长款风衣，与视觉描述一致"
}
```

字段含义：
- `asset_path` / `image_path`：原样回传输入
- `issue`：发现的问题（一句话说清"图与卡哪里不符"）
- `prompt_direction`：prompt 改进方向（说方向，不写最终 prompt 文本）

## 规则

- 只读不写，无文件操作
- **1-image 约束**：只 Read image_path 这 1 张 PNG；任何其他 PNG 一律不读
- 单 asset 只输出一条（通过为空 / 需修改为单 JSON 对象）；多个问题合并为一条 issue + 一个 prompt_direction
- 不输出"通过"字样的文字——空字符串即代表通过（汇总层据此判断）

## 输出

### 返回内容
- 空字符串（通过）或单条 JSON 对象（需修改） → 返回给 `director-review-assets-visual`

