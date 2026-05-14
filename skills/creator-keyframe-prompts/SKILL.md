---
name: creator-keyframe-prompts
description: Creator 把 keyframes.json 翻译成关键帧 .md 文件（含视觉描述和图像生成提示词），落盘到 assets/keyframes/{ep}/。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/keyframes.json` — 必须读取（关键帧描述源）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（本集资产清单，验证 composition 中 `<>` 标签）
- `config.md` — 必须读取（语言、视频风格、目标图像模型）
- `assets/**/*.md` — Glob 列出现有资产文件路径（用于解析 composition 中 `<>` 标签到 .md 文件路径）
- `skills/creator-keyframe-prompts/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）
- `$ARGUMENTS[1]` — 模式（可选，`full` 或 `incremental`，缺省为 `full`）
- `$ARGUMENTS[2]` — 仅 `incremental` 模式：dirty 列表（空格分隔的 KF id，如 `KF-EP01-003 KF-EP01-005`）

## 职责描述

### 核心使命

把 keyframes.json 中每张关键帧的结构化描述（composition / scene / characters / props / shot_size / camera_position / lighting_tone / action / emotion）翻译成图像模型可消费的提示词，并落盘为独立 .md 文件到 `assets/keyframes/{集数}/{KF-id}.md`。下游消费者是 `creator-generate-images`（按集扫 .md 出图）和 `creator-image-dreamina`（吃 .md 直接出图）。**不修改 keyframes.json**——keyframes.json 是 director 的产物，本 skill 只读不写。

### 工作思路

1. **读 keyframes.json**，得到关键帧数组
2. **读 config**，确定目标图像模型、视频风格、语言
3. **Glob `assets/**/*.md`** 建立"资产名 → .md 路径"映射表（用于把 composition 中 `<张三>` 解析到 `assets/characters/张三.md`）
4. **增量模式**：仅处理 `$ARGUMENTS[2]` 列出的 KF id；全量模式：处理全部
5. **对每张关键帧**：
   a. 解析 composition 中所有 `<资产名>` 标签
   b. 校验每个资产名能在 Glob 出的资产清单中找到（找不到则报错——说明 director-keyframes 没正确登记资产清单）
   c. 写 .md 文件：拼接 composition + 镜头语言（shot_size + camera_position）+ lighting_tone + 视频风格 suffix → 形成 prompt
   d. 落盘到 `assets/keyframes/{集数}/{KF-id}.md`
6. **清理孤儿 .md**：full 模式扫描 `assets/keyframes/{集数}/` 中所有 .md，删除不在 keyframes.json 的；incremental 模式仅在 dirty 列表中的 id 不在 keyframes.json 时删对应 .md
7. **输出生成摘要**：成功 N 张、删除 N 张、失败 N 张

### 常见误区

- **改 keyframes.json** — 本 skill 只读 keyframes.json，不修改它；任何对描述的修订都是 director-keyframes 的职责 — 严格只读
- **prompt 写得过于自由** — 模型容易把 description 重写一遍；prompt 应该**忠实保留** description 中的所有视觉信息（角色位置/朝向/动作/光线/景别）— 翻译不是改写，结构化字段必须 1:1 反映到 prompt
- **资产引用断链** — composition 写了 `<某资产>` 但 assets/ 中找不到对应 .md — 报错并停止处理本帧（不影响其他帧），不要"自动创建"或"忽略"
- **自动切英文** — 模型本能切换 prompt 语言为英文 — 严格遵循 config.md 语言设置
- **风格漏注** — 写 prompt 时忘了加 config 的视频风格 suffix（"3D写实风"等）— 每条 prompt 末尾必须包含视频风格描述
- **增量模式越权** — 收到 dirty 列表后顺手处理列表外的 keyframe — 严格只处理 dirty 列表中的 id

## 规则参考

- `skills/creator-keyframe-prompts/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 创建/覆写 `assets/keyframes/{集数}/{KF-id}.md`（每张关键帧一个文件）
- 使用 Bash 删除孤儿 `assets/keyframes/{集数}/{KF-id}.md`（按上述清理规则）

### 返回内容
- 生成摘要 → 返回给调用方
