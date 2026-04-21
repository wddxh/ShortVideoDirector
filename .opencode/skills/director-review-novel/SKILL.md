---
name: director-review-novel
description: Director审核Writer小说原文，检查与大纲一致性、角色塑造和叙事质量。
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `assets/characters/*.md` — 若存在则读取（角色一致性审核）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

审核 Writer 生成的小说原文，检查与大纲的一致性、角色塑造和叙事质量。

## 输出格式

通过时：
```markdown
## 审核结果：通过
```

不通过时：
```markdown
## 审核结果：需修改

1. **{位置}：** {问题描述} → {修改建议}
2. **{位置}：** {问题描述} → {修改建议}
```

## 规则参考

- `skills/writer-novel/rules.md` — 必须读取，按照其中的规则逐条审核

## 规则

最多 2 轮反馈。审核时需检查是否存在现实中的明星或公众人物名字、真实地名、商标名，发现则要求替换为虚构名称。

## 输出

### 返回内容
- 审核结果（通过 / 需修改 + 修改意见列表） → 返回给 workflow
