---
name: scriptwriter-fix-script
description: Scriptwriter根据Director修改意见定向修正剧本。读取现有剧本，只修改指出的问题。
user-invocable: false
context: fork
agent: scriptwriter
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/script.md` — 必须读取（现有剧本）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取
- `config.md` — 必须读取
- `assets/characters/*.md` — 若存在则全部读取（角色一致性参考）
- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是 Director 审核或用户编辑请求）

## 职责描述

### 核心使命

按 Director 审稿意见或用户编辑请求，定向修正现有 script.md。下游消费者是 short-storyboard（拆分镜）和 director-review-script（审稿），它们已经基于"修改前"的版本运作过一轮——你的修正必须只动指出的问题，未涉及部分逐字保留。短视频时长极紧（通常 1-3 分钟），任何台词或场景结构改动都会重新分配节奏；超改 = 节奏失衡 + 已分镜场景失效。

### 工作思路

1. 完整通读 script.md 现状，再读 $ARGUMENTS[1]，把每条意见映射到具体场景 / 台词 / 动作描写
2. 评估每条修正的连锁影响：改一句台词是否影响场景内时长分配？改场景描写是否需要同步调整动作 / 对白？
3. 必要时把"修正一处"扩展为"修正这一处 + 同场景内被影响的台词与动作描写"——但不擅自改与意见无关的场景
4. 动笔时仍用 scriptwriter-script 的"画面在前，对白在后"和"每句台词服务剧情或塑造人物"原则
5. 修正完毕自检：每条意见是否落地？场景结构与节奏未破坏？角色声音是否仍与资产一致？rules.md 格式是否仍合规？

### 常见误区

- **改台词忘对应动作描写** — 模型容易只改对白文字，但原台词配套的动作描写仍引用"刚才说话"的内容，前后矛盾 — 改台词时同步检查同段动作描写
- **改场景忘改场景元数据** — 改地点 / 时间 / 氛围时只改正文，rules.md 要求的场景标题字段（地点 / 时间 / 氛围块）忘同步 — 改场景元素时把"标题字段"过一遍
- **趁修正塞入"自然客套"** — 用户给的意见可能是"这里不够自然"，模型本能加寒暄填充，看似真实但占用宝贵秒数 — 加台词时仍走 scriptwriter-script 的"剧情推进 / 人物塑造"二选一过滤
- **角色声音漂移** — 修正时容易用通用对话腔调，丢失原角色特征 — 改某角色台词前重读其资产文件「声音特征」字段

## 规则参考

- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/script.md`
