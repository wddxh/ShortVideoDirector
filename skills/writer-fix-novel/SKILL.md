---
name: writer-fix-novel
description: Writer根据Director修改意见定向修正小说原文。读取现有小说，只修改指出的问题。
user-invocable: false
context: fork
agent: writer
allowed-tools: Read, Write, Edit, Glob
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（现有小说）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `story/outline.md` — 必须读取（整体故事大纲）
- `config.md` — 必须读取
- `assets/characters/*.md` — 若存在则全部读取（角色一致性参考）
- `skills/writer-novel/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是 Director 审核或用户编辑请求）

## 职责描述

### 核心使命

按 Director 审稿意见或用户编辑请求，定向修正现有 novel.md。下游消费者依然是 storyboarder-storyboard 和 director-review-novel，但它们已经基于"修改前"的版本运作过一轮——你的修正必须只动指出的问题，未涉及部分逐字保留，否则下游会被无关变更打断（已生成的分镜 / 已得出的审稿结论失效）。修正成本远低于重写；超改不是"加分"，是引入回归。

### 工作思路

1. 完整通读 novel.md 现状，再读 $ARGUMENTS[1]，把每条意见映射到具体段落 / 行
2. 评估每条修正的连锁影响：改某一段的事件细节，是否让后续基于此事件的对白 / 状态 / 转场失去因果？
3. 必要时把"修正一处"扩展为"修正这一处 + 后续被影响的段落"——但不擅自修改与意见无关的章节
4. 动笔时仍用 writer-novel 的"画面在前，对白在后"原则；画面密度不能因为是"小修"而稀薄
5. 修正完毕自检：每条意见是否落地？rules.md 格式是否仍合规？被改段落与上下文是否仍连贯？

### 常见误区

- **把意见当全文重写信号** — Director 一次给多条意见，模型本能"既然要改，不如全部重写一遍更顺"，结果丢失原本无问题的段落 — 每改一段都问"这段在意见列表里吗"，不在就不动
- **改一处忘下游连锁** — 改了某段事件，后续段落基于此事件的对白 / 角色情绪 / 转场仍是旧的，前后矛盾 — 改完每一段都通读其后两三段，确认逻辑链没断
- **为了"改得明显"丢失原画面** — 模型倾向"既然在改不如换个写法"，结果细节描写被替换成更平的总结 — 改前先记住原段落的画面元素（动作/环境/感官），改后这些元素必须仍在（除非意见明确要求换）
- **格式漂移** — 修正时局部输入输出，容易丢掉 rules.md 的标题层级 / 段落分隔 / 标签写法 — 写完每段对照 rules.md 检查格式

## 规则参考

- `skills/writer-novel/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/novel.md`
