---
name: director-fix-outline
description: Director根据修改意见定向修正本集大纲。同步更新story/outline.md中对应内容。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（现有本集大纲）
- `story/outline.md` — 必须读取（整体故事大纲）
- `story/arc.md` — 若存在则读取
- `config.md` — 必须读取
- `skills/director-outline/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是用户编辑请求）

## 职责描述

### 核心使命

按用户编辑请求或审稿意见定向修正现有本集 outline.md，并同步 story/outline.md 中本集对应内容。下游消费者是 writer-novel（写小说）和 storyboarder-storyboard（拆分镜）。outline 是上游骨架——任何「主要事件」/「角色出场」/「本集信息传达」/「集尾钩子」的修改都会让下游已生成的产物（novel.md、storyboard.md）失效。修正必须谨慎评估"哪些下游产物会被波及"。

### 工作思路

1. 完整通读 outline.md + story/outline.md 中本集摘要 + arc.md（若存在）+ $ARGUMENTS[1]，把每条意见映射到具体事件 / 字段
2. 评估 arc 一致性：改的本集事件在 arc 弧线中的位置是否仍正确？是否打破后续集的剧情依赖？
3. 评估下游波及：被改字段在 novel.md / storyboard.md 中是否已生成？被波及的字段需要后续触发对应 fix skill（不在本 skill 范围，但需让上游 workflow 知晓）
4. 修正本集 outline.md 后，必须同步更新 story/outline.md 中本集对应内容（这是对 append-only 规则的例外，编辑场景下允许修改已有内容）
5. 动笔时仍用 director-outline 的"事件给铺垫留位 / 信息传达列出每个新角色 / 集尾钩子答观众为何继续看"原则
6. 修正完毕自检：每条意见是否落地？story/outline.md 是否同步？本集时长容量未爆？arc 弧线一致？

### 常见误区

- **改本集忘同步 story/outline.md** — append-only 例外（修正场景允许编辑已有内容），但模型本能"只改本集文件" — 每次修正后都要在 story/outline.md 中找到本集对应位置同步
- **修正打破 arc 弧线** — 改了本集事件后这一集在 arc 中的"该推进的阶段"被破坏，但后续集仍假设它推进了 — 改前重读 arc.md 中本集分配，确认改后本集仍履行原职责
- **集尾钩子改成事件描述** — 模型修正"钩子不强"时容易把它写成更具体的事件，丢失"观众悬念"性质 — 改钩子前自问"这一句让观众带什么疑问走"
- **「本集信息传达」漏更新** — 改了某个角色出场或某个伏笔，但信息传达清单仍是旧的 — 改事件 / 角色出场后必须回头更新信息传达对应条目

## 规则参考

- `skills/director-outline/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/outline.md`
- 使用 Edit 更新 `story/outline.md` 中本集对应内容
