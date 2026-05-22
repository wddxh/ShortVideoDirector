---
name: creator-keyframe-prompts
description: Creator 把 storyboard.md 中的 [KF-id] 内联引用翻译成关键帧 .md 文件（含视觉描述和图像生成提示），落盘到 assets/keyframes/{ep}/。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/storyboard.md` — 必须读取（KF 引用源 + 视觉信息源）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（本集资产清单，验证「出场人物 / 引用资产」中的 asset）
- `config.md` — 必须读取（语言、视频风格、目标图像模型）
- `assets/**/*.md` — Glob 列出现有 asset 文件路径（用于解析 character / location / item asset 到 .md 路径）
- `skills/creator-keyframe-prompts/rules.md` — 必须读取并严格遵循
- `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/visual-prompt-craft-common.md` — 必须读取（视觉 prompt 5 条核心原则 + 资产引用分场景规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）
- `$ARGUMENTS[1]` — 模式（可选，`full` 或 `incremental`，缺省为 `full`）
- `$ARGUMENTS[2]` — 仅 `incremental` 模式：dirty 列表（空格分隔的 KF id，如 `KF-EP01-003 KF-EP01-005`）

## 职责描述

### 核心使命

storyboard.md 中每个 shot 的 prose 含 `画面首帧是 [KF-id]` / `画面尾帧是 [KF-id]` / `画面参考 [KF-id]` 三种位置语义标记。本 skill 解析这些标记 + 每个 KF 首次出现 shot 的视觉信息（景别/运动/出场人物/引用资产/画面描述），翻译成图像模型可消费的 prompt，落盘为独立 .md 文件到 `assets/keyframes/{集数}/{KF-id}.md`。下游消费者是 `creator-generate-images`（按集扫 .md 出图）。**不修改 storyboard.md**——storyboard 是 storyboarder 的产物，本 skill 只读不写。

跨集视觉一致性靠 asset 库自动保证（同一 character / location asset 跨集复用同一 .md 卡）。

### 工作思路（5 步）

1. **读 storyboard.md**，使用 `bash scripts/parse-storyboard-kf.sh story/episodes/{集数}/storyboard.md` 抽取所有 `(KF-id, position, shot_number)` 三元组
   - 退出码 2 → 解析失败（KF 缺位置语义）：明确报错 + 列出 stderr，终止处理；不静默跳过
   - 退出码 0 但输出为空 → 本集无 KF 引用：输出"无需生成"并结束
2. **读 config**，确定目标图像模型、视频风格、语言
3. **Glob `assets/**/*.md`** 建立"资产名 → .md 路径"映射表
4. **对每个唯一 KF-id**（按首次 shot_number 升序）：
   a. 从 storyboard.md 中提取该 shot 的字段（镜头类型、镜头运动、出场人物、引用资产、画面与声音描述 prose）
   b. 提取的视觉信息组装为 keyframe schema 字段：composition（prose 中 KF 标记附近的画面叙述）/ scene（引用资产中的 location）/ characters（出场人物）/ props（引用资产中的 item）/ shot_size（镜头类型）/ camera_position（从镜头运动派生）/ lighting_tone（从 prose 推断）/ action（prose 中的动作动词） — 字段缺失时基于 prose 文本智能填充，仍无法确定则保留为空但继续生成
   c. 校验出场人物 + 引用资产中的非 KF asset 在 `assets/**/*.md` 中能找到对应 .md（找不到 → 报错"asset '{名}' 未找到，请检查 outline 资产清单 / scriptwriter 是否漏标"，跳过该 keyframe 记录失败列表）
   d. 整理 `## 引用资产` 区块：按 prose / 引用资产字段中出现顺序枚举所有非 KF asset，去重，每条 `- [名](从 keyframe .md 到 asset .md 的相对路径)`
   e. 写 .md 文件：拼接 prose 摘录 + 镜头语言 + 视频风格 suffix → prompt（asset 名以裸名字出现）
   f. 落盘到 `assets/keyframes/{集数}/{KF-id}.md`
5. **清理孤儿 .md** + **输出摘要**：成功 N 张、删除 N 张、失败 N 张

### 常见误区

- **改 storyboard.md** — 只读，不写；任何视觉/位置语义修订是 storyboarder-fix-storyboard 的职责
- **prompt 写得过于自由** — 模型容易把 prose 重写一遍；prompt 应**忠实保留** prose 中的所有视觉信息（位置/朝向/动作/光线/景别）
- **asset 引用断链** — storyboard 出场人物 / 引用资产 写了某 asset 但 assets/ 中找不到 .md → 报错并停止处理本帧（不影响其他帧）
- **自动切英文** — 严格遵循 config.md 语言设置
- **风格漏注** — 每条 prompt 末尾必须包含 config 视频风格描述
- **增量模式越权** — 严格只处理 dirty 列表中的 id
- **prompt 正文写 markdown 链接** — 引用关系**只**在 `## 引用资产` 区块声明；正文写裸名字
- **静默跳过解析失败** — parse-storyboard-kf.sh 退出码 ≠ 0 时必须报错终止，不得"先生成能生成的"
- **跨集视觉一致性手工干预** — 同一 character / location 跨集复用同一 asset .md 卡自动保证；本 skill 不应"补充上一集风格"等越权行为

## 规则参考

- `skills/creator-keyframe-prompts/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 创建/覆写 `assets/keyframes/{集数}/{KF-id}.md`（每个唯一 KF-id 一个文件）
- 使用 Bash 删除孤儿 `assets/keyframes/{集数}/{KF-id}.md`（按 rules.md 清理规则）

### 返回内容
- 生成摘要 → 返回给调用方
