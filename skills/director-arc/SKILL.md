---
name: director-arc
description: Director生成阶段级剧情弧线规划。自动读取config.md、outline.md、最近M集novel，并写入arc.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---

## 输入文件读取

- `config.md` — 必须读取
- `story/outline.md` — 若存在则读取
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，根据 config.md 中 `上下文集数` M，使用 Glob 匹配 `story/episodes/ep*/novel.md` 找到最近 M 集并读取

## 动态参数

通过 $ARGUMENTS 接收：总集数、选定的剧情方向

## 输出文件操作

- 使用 Write 将剧情弧线写入 `story/arc.md`

## 职责描述

根据总集数和剧情方向，生成阶段级剧情弧线规划。

## 输出格式

```markdown
# 剧情弧线

总集数：{N}

## 第1-{X}集：{阶段名称}
- **阶段目标：** {描述}
- **关键转折点：** {描述}
- **角色发展：** {描述}
- **阶段结尾钩子：** {描述}

## 第{X+1}-{Y}集：{阶段名称}
- **阶段目标：** {描述}
- **关键转折点：** {描述}
- **角色发展：** {描述}
- **阶段结尾钩子：** {描述}

## 第{Z}-{N}集：{阶段名称}（大结局）
- **阶段目标：** {描述}
- **关键转折点：** {描述}
- **角色发展：** {描述}
- **大结局：** {精彩的结局设计}
```

## 规则

- 阶段划分合理，每阶段覆盖的集数根据总集数自行决定
- 最后一个阶段必须包含精彩的大结局设计，替换"阶段结尾钩子"为"大结局"
- 只规划阶段级别的方向，不生成具体每集大纲
- continue-story 时必须与已有 outline 保持逻辑连贯
