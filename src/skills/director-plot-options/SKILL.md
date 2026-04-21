---
name: director-plot-options
description: Director生成3个差异化剧情走向选项。自动读取config.md、arc.md、outline.md、最近M集novel。
---

## 输入

### 文件读取
- `config.md` — 必须读取
- `story/arc.md` — 若存在则读取
- `story/outline.md` — 若存在则读取
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取

### 模式判断
- 若 `story/outline.md` 不存在 → new-story 模式
- 若 `story/outline.md` 已存在 → continue-story 模式

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 用户偏好描述（可选，重新生成时传入）

## 职责描述

根据故事配置和已有剧情上下文，生成 3 个差异化的剧情走向选项供选择。

## 输出格式

**new-story 时（story/outline.md 不存在）：**

```markdown
## 选项 A: {主题名称}
- **剧名：** {剧名}
- **核心设定：** {一句话概括世界观和主角定位}
- **开篇钩子：** {第一集的核心冲突/悬念}
- **卖点分析：** {为什么适合短视频}

## 选项 B: {主题名称}
...

## 选项 C: {主题名称}
...
```

**continue-story 时（story/outline.md 已存在）：**

```markdown
## 选项 A（稳健）: {走向名称}
- **关键转折：** {本集核心冲突或反转}
- **涉及角色：** {主要出场角色}
- **集尾钩子：** {收束方式 — 描述}
- **对整体剧情的影响：** {如何推动后续剧情}

## 选项 B（激进）: {走向名称}
...

## 选项 C（拓展）: {走向名称}
...
```

## full-auto mode

自动选择标准（按优先级）：
1. 观众吸引力
2. 短视频适配性
3. 剧情张力

## 规则

- 3 个选项必须有明显差异
- continue-story 时：稳健（顺延当前剧情线）、激进（大反转/新冲突）、拓展（引入新角色/新势力/新世界观元素）
- continue-story 时若 `story/arc.md` 存在：3 个选项必须围绕 arc 中为下一集分配的剧情规划展开，不得偏离 arc 的整体方向和阶段目标。选项的差异体现在具体的演绎方式和细节处理上，而非剧情走向本身

## 输出

### 返回内容
- 3 个差异化剧情选项（Markdown 格式） → 返回给 workflow 展示
