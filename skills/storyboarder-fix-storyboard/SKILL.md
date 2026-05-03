---
name: storyboarder-fix-storyboard
description: Storyboarder根据Director修改意见定向修正分镜。读取现有分镜，只修改指出的问题。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
model: sonnet
---

## 输入

### 文件读取
- `story/episodes/$ARGUMENTS[0]/storyboard.md` — 必须读取（现有分镜）
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取（对照原文）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称，使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）
- `$ARGUMENTS[1]` — 修改意见（由 workflow 传入，来源可能是 Director 审核或用户编辑请求）

## 职责描述

### 核心使命

按 Director 审稿意见或用户编辑请求，定向修正现有 storyboard.md。下游消费者是即梦视频模型（按镜头独立生成视频片段）和 director-review-storyboard（审稿）。修正分镜的连锁面在所有 fix skill 中最广——改一个镜头可能影响相邻镜头的状态衔接，改一个资产引用可能波及所有引用此资产的镜头，改一个事件可能让铺垫覆盖断链。已生成视频的镜头被改会导致相应 mp4 失效需要重生成（成本高），所以修正必须只动指出的问题，未涉及镜头逐字保留。

### 工作思路

**评估阶段：**

1. 完整通读 storyboard.md 现状 + novel.md 对照原文 + $ARGUMENTS[1]，把每条意见映射到具体镜头编号
2. **状态连锁评估**：改镜头 N 的视觉位置 / 姿势 / 手持物 / "已告知信息" → 镜头 N+1 的开头状态是否需要同步调整？
3. **铺垫连锁评估**：改的镜头是否包含某条铺垫的种子或回收点？改后铺垫覆盖是否仍完整、时序是否仍正确（铺垫镜头编号 < 回收镜头编号）？
4. **资产连锁评估**（若意见涉及资产引用）：被改的资产被哪些镜头引用？这些镜头都要同步检查
5. 必要时把"修正镜头 N"扩展为"修正镜头 N + 上下镜头 + 同资产镜头"——但不擅自改与意见无关的镜头

**编辑阶段：**

6. 动笔时仍用 storyboarder-storyboard 的"自包容、画面与声音连贯叙事、不跨镜头引用、画面文字改读出"原则
7. 修正完毕自检：每条意见是否落地？被改镜头与上下镜头状态衔接连贯？铺垫覆盖完整？时长合理？rules.md 格式合规？

### 常见误区

- **改一个镜头忘了相邻镜头的状态衔接** — 模型本能在镜头 N 做隔离修改，但 N+1 的开头是基于 N 结束状态写的；改 N 的姿势 / 手持物 / 已知信息后 N+1 出现状态突变 — 改镜头 N 后必读 N+1 开头，确认仍连贯，必要时同步改 N+1
- **改资产引用忘改其他引用此资产的镜头** — 改了 A 资产名为 B 但其他镜头仍引 A，渲染时找不到 — 改资产引用前 grep 此资产被引用的全部镜头，统一改
- **超改一个镜头丢失原画面密度** — 模型趁修正"重写一遍更顺"，丢失原镜头的环境细节 / 光影 / 视觉修饰 — 改之前先记原镜头有哪些视觉元素，改后必须仍在
- **时长精简误删视觉修饰词** — 时长超出时模型本能删形容词（"光线柔和地照亮房间" → "光线照亮房间"），但形容词不占时间，台词和动作才占；删修饰词不省时间反而丢画面质感 — 精简优先缩台词 / 合并动作 / 减事件数量，视觉修饰词不动
- **跨镜头引用复活** — 改了镜头开头描述后，模型本能写"延续上镜头""主角继续之前的动作"，rules.md 已禁但修正时本能违反 — 改完每段开头独立检查"这一句脱离上镜头还能看懂吗"

## 规则参考

- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循

## 输出

### 文件操作
- 使用 Write 覆写 `story/episodes/$ARGUMENTS[0]/storyboard.md`
