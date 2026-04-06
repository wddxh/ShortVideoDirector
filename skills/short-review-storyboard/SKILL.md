---
name: short-review-storyboard
description: Director审核单集短视频分镜，检查叙事完整性、节奏、人物一致性和剧情铺垫。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取
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

- `skills/short-storyboard/rules.md` — 必须读取，按照其中的输出格式、字段约束和规则逐条审核

## 导演专属审核重点

除 rules.md 中的规则外，重点审核以下叙事层面的问题：

- **叙事完整性** — 分镜是否完整覆盖了剧本的关键情节，有无遗漏重要场景
- **剧情节奏** — 整体节奏是否张弛有度，是否存在拖沓或过于仓促的段落
- **人物言行与性格一致性** — 角色的对白、动作、反应是否符合其已建立的性格特征
- **剧情铺垫是否充分** — 剧情发展是否有足够的铺垫，观众能否获得足够信息来理解剧情

## 输出

### 返回内容
- 审核结果（通过 / 需修改 + 修改意见列表） → 返回给 workflow
