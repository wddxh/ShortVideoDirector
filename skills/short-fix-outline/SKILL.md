---
name: short-fix-outline
description: Director根据修改意见定向修正单集短视频大纲。不同步story/outline.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（现有大纲）
- `config.md` — 必须读取
- `skills/short-outline/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入）

## 职责描述

### 核心使命

按用户编辑请求或审稿意见定向修正单集短视频 outline.md。下游消费者是 scriptwriter-script 和 short-storyboard。短视频只有这一集，结构（铺垫→冲突→高潮→收束）紧凑——任何事件改动都会重新分配节奏；下游已生成的 script.md / storyboard.md 会被波及。注意：和系列剧不同，本 skill 不需要同步 story/outline.md（短视频没有这个文件）。

### 工作思路

1. 完整通读 outline.md 现状 + $ARGUMENTS[1]，把每条意见映射到具体事件 / 字段
2. 评估结构平衡：改了某事件后，铺垫→冲突→高潮→收束的分布是否仍合理？config 时长目标内还能装下吗？
3. 评估下游波及：被改字段在 script.md / storyboard.md 中是否已生成？被波及的字段需要后续触发对应 fix skill
4. 必要时扩展修正范围到结构相邻字段——但不擅自改与意见无关的部分
5. 动笔时仍用 short-outline 的"故事类型决定开场和结局取向 / 结局必须落地具体 / 角色姓名传达规划"原则
6. 修正完毕自检：每条意见是否落地？结构平衡未破坏？时长容量未爆？角色姓名传达仍完整？

### 常见误区

- **改成"长剧第一集"** — 修正"剧情不够"时模型本能加事件，结果结局又被压缩潦草 — 加事件时立即检查结局描述是否仍有具体画面 / 动作
- **结局类型与描述脱节** — 改结局类型时只改类型字段忘改描述，或反之；rules 已规定但修正时局部输入更易漏 — 类型字段与描述同步改，描述里要能看出类型
- **开场策略空话化** — 修正"开场不够抓人"时模型容易写"用紧张刺激的场景吸引观众"，下游不知什么场景 — 改开场策略时确保仍是可拍的具体画面或对白
- **遗漏角色姓名传达** — 改了角色出场后忘更新姓名传达方式 — 改角色出场列表时同步检查"姓名怎么传达"

## 规则参考

- `skills/short-outline/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/outline.md`
