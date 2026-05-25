---
name: creator-create-assets
description: Creator为新资产创建完整Markdown文件，包含视觉描述和图像生成提示。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（从「本集资产清单」的「新增资产」部分获取资产列表）
- `config.md` — 必须读取（目标图像模型）
- `assets/**/*.md` — 使用 Glob 列出所有已有文件，选择性读取（风格一致性 + 查重）
- `${CLAUDE_PLUGIN_ROOT}/skills/creator-create-assets/rules.md` — 必须读取并严格遵循（输出格式、规则）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md` — 必须读取（视觉 prompt 5 条核心原则 + 资产引用分场景规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

### 核心使命

为本集出现的每个新资产（角色/物品/场景/建筑）创建 Markdown 文件，包含视觉描述和图像生成提示。下游消费者是图像模型（用提示词生成参考图）和 storyboarder（用资产名引用、用图片作为视频生成参考）。视觉描述和图像提示词必须足够具体，让图像模型能生成稳定一致的形象——抽象描述（"美丽的女孩"）会导致每次生成都不一样，毁掉视频生成的资产一致性。

### 工作思路

1. 先用 Glob 列出所有已有资产，对照 outline 的「新增资产」清单查重——若名字相近或形象相似，使用已有资产而非新建
2. 通读 novel，提取每个新资产的视觉细节（外貌/服饰/物品材质/场景光线）
3. 视觉描述要详细到图像模型能复现：人物五官形状、肤色、眼睛颜色、发型、服装层次；物品材质纹理；场景光线空间
4. 图像提示词按 config 中目标图像模型的格式写，但语言严格遵循 config 语言设置
5. 人物基础资产用中性表情和姿态、日常便装——特殊状态作为衍生资产单独建（适用 character / location / building / item 4 类）
6. 创建衍生资产前对比基础资产，无明显视觉差异则拒绝创建；衍生资产禁止递归派生（基础资产字段必须指向非衍生资产）

### 常见误区

- **视觉描述抽象** — 写"美丽的女孩"或"古朴的茶馆"，图像模型生成的每张图都不同 — 具象到具体细节（瓜子脸/单眼皮/丹凤眼/...）
- **自动切英文** — rules.md 已禁但模型本能认为"图像模型更适合英文" — 图像提示词的语言严格遵循 config 语言设置，不切换
- **造型变体滥创** — 模型本能为每个不同服装建变体，但 rules.md 规定"无明显剧情视觉区分则拒绝" — 创建前对比基础资产，问"这变体是否对剧情有视觉区分"
- **人物图像提示词漏服装** — 模型容易认为"基础资产是中性形象"就不写衣服，但 rules.md 要求必须包含完整服装描述 — 每个人物图像提示词都过一遍"五官/肤色/发型/服装"四件套
- **就地改基础资产视觉** — 状态变化（场景被摧毁/武器破损/建筑焚毁/人物受伤）模型本能就地改基础 .md 的视觉描述污染基础形象 — 必须派生新「衍生资产」文件，基础资产不动
- **衍生资产递归派生** — 模型本能给衍生资产再派生子衍生（`A-焚毁-坍塌`）— 禁止；基础资产字段必须指向非衍生 asset，多状态请直接以基础资产为基底另起新衍生

## 规则参考

- `${CLAUDE_PLUGIN_ROOT}/skills/creator-create-assets/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 在 `assets/` 对应子目录（`characters/`、`items/`、`locations/`、`buildings/`）下创建每个资产的 `.md` 文件
