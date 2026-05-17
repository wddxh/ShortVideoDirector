---
name: creator-fix-keyframe-image
description: Creator 根据 visual review 的意见与 dirty list，修订关键帧描述/prompt 并重抽对应图片。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/keyframes.json` — 必须读取（描述源头，按需 Edit）
- `assets/keyframes/$ARGUMENTS[0]/{KF-id}.md` — 对 dirty list 中每个 KF-id 读取（按需 Edit）
- `skills/creator-keyframe-prompts/rules.md` — 必须读取（确保改 .md 时仍符合 prompt 翻译规则）

### Skill 调用
- `creator-keyframe-prompts` — 当改了 keyframes.json 时，以 incremental 模式重写受影响 .md
- `creator-generate-images` — 删旧图后调用，自然补回新图

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）
- `$ARGUMENTS[1]` — dirty list（空格分隔的 KF-id，如 `KF-EP01-003 KF-EP01-007`）
- `$ARGUMENTS[2]` — 意见列表（自由文本，每条形如 `KF-EP01-003: {issue} → {prompt_direction}`，由汇总层 visual review 输出）

## 职责描述

### 核心使命

把 visual review 的"prompt 改进方向"落实为**最小必要的修订** + **重抽对应图片**。下游消费者是下一轮 visual review 或 workflow 收尾。**只改 dirty list 中的帧，其他帧不动**。视觉问题的根因永远是 prompt 不到位（描述不够准/缺信息/资产引用断），fix 的核心动作是把 prompt 改到位，然后让生图管道自然重跑。

### 工作思路

1. **逐条解析意见**：对 dirty list 中每个 KF-id，定位该帧在意见列表中的 `issue` 与 `prompt_direction`
2. **归因判断**——这条意见应该改哪里？
   - **改 keyframes.json 的某字段**：意见指向结构化要素（构图主体位置、光线色温、动作姿态、缺失道具、景别/机位错误）→ 改 keyframes.json 对应字段（composition / lighting_tone / action / shot_size / camera_position 等），再重写 .md
   - **只改 .md 不动 keyframes.json**：意见指向纯 prompt 表达层面（如"风格 suffix 漏写"、"资产引用语法格式问题"、"prompt 段落顺序导致权重不对"）→ 直接 Edit .md，keyframes.json 不动
   - 拿不准时倾向**改 keyframes.json**——source of truth 一致性优先于"少改一个文件"
3. **执行改动**：
   - 改 keyframes.json：用 Edit 修改对应帧的字段（id 不变，其他帧不动）；若改动影响下一帧的 variation_from_prev，同步更新下一帧的 variation_from_prev 字段
   - 改 .md：直接 Edit，遵守 `creator-keyframe-prompts/rules.md` 的 prompt 翻译规则
4. **同步 .md（仅当改了 keyframes.json）**：使用 Skill tool 调用 `creator-keyframe-prompts` skill，传递参数：`incremental "{改了 keyframes.json 的那部分 KF-id 空格分隔}"`，重写 .md
5. **删旧图**：用 Bash 删除 dirty list 中**所有** KF-id 对应的 `assets/images/keyframes/{集数}/{KF-id}.png`（包括只改了 .md 没改 keyframes.json 的——只要 prompt 变了就要重抽）
6. **重抽**：使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`$ARGUMENTS[0]`，它会扫到缺图自然补回（新增的 keyframes 扫描已在 creator-generate-images 中实现）
7. **输出 fix 摘要**：每个 KF-id 改了什么（字段层面 / .md 层面）+ 重抽结果

### 常见误区

- **越权改非 dirty 帧** — 看到顺手就把别的 KF 一并优化 — 严格只动 dirty list 中的 KF-id
- **改 .md 不改 keyframes.json 导致漂移** — 意见明显指向结构化要素却只改 .md → 下次全量重跑 .md 时改动丢失 — 归因判断时 source of truth 一致性优先
- **改 keyframes.json 不重写 .md** — 改了 source 但 .md 还是旧 prompt → 重抽时图还是旧效果 — 改 keyframes.json 后必须调 incremental .md 重写
- **忘删旧图** — `creator-generate-images` 见图存在就跳过 → 重抽不发生 — 必须先删旧图
- **照抄 prompt_direction 写到 prompt** — review 给的是"方向"（如"补充服装描述"），fix 要把方向具体化（"补充：黑色风衣"）— 不照搬方向文字
- **忽略 variation_from_prev 同步** — 改了第 N 帧的画面，第 N+1 帧的 variation_from_prev 描述变得不准确 — 改完 keyframes.json 顺手检查并同步下一帧 variation_from_prev

## 规则

- **最多 2 轮 fix**——本 skill 不自我控制轮次，由上游 workflow 调度（fix → visual review → 若仍需修改则再 fix 一次 → 第二轮后即使仍有问题也接受）
- **dirty list 严格边界** — 只动 dirty list 中的 KF-id，其他帧的 keyframes.json 字段、.md、图都不动
- **id 不回收** — 不删除 keyframes.json 中的帧（fix 不删帧，只改字段；删帧是 director-keyframes incremental 的职责）
- **明星/真名替换兜底** — 改字段时若发现现实明星名/真实地名/商标名，替换为虚构名（与 director 各 review skill 一致）

## 输出格式

```
## creator-fix-keyframe-image 摘要

- 处理 dirty list：N 张
- 改 keyframes.json + .md：N 张
  - {KF-id}：改了 {字段名}，原因：{意见简述}
- 仅改 .md：N 张
  - {KF-id}：改了 {段落}，原因：{意见简述}
- 删旧图：N 张
- 重抽结果：{creator-generate-images 摘要}
```

## 输出

### 文件操作
- 使用 Edit 修改 `story/episodes/{集数}/keyframes.json` 中受影响帧的字段
- 使用 Edit 修改 `assets/keyframes/{集数}/{KF-id}.md`（仅"只改 .md"分支）
- 使用 Bash 删除 dirty list 对应的 `assets/images/keyframes/{集数}/{KF-id}.png`

### 返回内容
- fix 摘要 → 返回给 workflow
