---
name: director-review-storyboard
description: Director审核Storyboarder分镜，检查叙事完整性、节奏、台词密度和技术合规性。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/storyboard.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `assets/characters/*.md` — 若存在则读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

审核 Storyboarder 生成的分镜，检查叙事完整性、节奏、台词密度和技术合规性。

## 输出格式

通过时：
```markdown
## 审核结果：通过
```

不通过时：
```markdown
## 审核结果：需修改

1. **镜头 {N}：** {问题描述} → {修改建议}
2. **镜头 {N}：** {问题描述} → {修改建议}
```

## 规则参考

- `skills/storyboarder-storyboard/rules.md` — 必须读取，按照其中的输出格式、字段约束和规则逐条审核

## 导演专属审核重点

除 rules.md 中的规则外，重点审核以下叙事层面的问题：

- **叙事完整性** — 分镜是否完整覆盖了小说原文的关键情节，有无遗漏重要场景
- **剧情节奏** — 整体节奏是否张弛有度，是否存在拖沓或过于仓促的段落
- **人物言行与性格一致性** — 角色的对白、动作、反应是否符合其已建立的性格特征
- **剧情铺垫是否充分** — 剧情发展是否有足够的铺垫，观众能否获得足够信息来理解剧情
- **观众视角终极标准** — 从普通观众视角整体审视分镜：剧情是否精彩、发展是否自然流畅、有无突兀或莫名其妙的部分、是否足够吸引人继续观看。这是凌驾于其他规则之上的最终检验——即使所有机械规则都通过，若整体观感平淡、突兀或令人困惑，仍判需修改。

## 输出

### 返回内容
- 审核结果（通过 / 需修改 + 修改意见列表） → 返回给 workflow
