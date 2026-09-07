---
name: director-outline
description: 当单集需要先梳理事件因果、场景节奏、信息传达或跨集承接，或用户要求大纲预审时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入
从委托确认目标集数、单集/系列语境、创作意图、材料路径与授权规划范围。已有选定方向可参考，不要求候选或内部参数表；定位或保留要求不清时先询问。

outline 是按需采用的规划方法，不是剧本制作的普遍前置。多集通常应考虑各集推进与伏笔回收；已有剧本或规划足够时不重复补建大纲。请求大纲预审时交回用户确认，不能自行进入正式制作。

## 必读文件
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md` — 必须读取并严格遵循 (公共规则)
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/series.md` — 系列规划适用字段与创作参考
- `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/short.md` — 单集规划适用字段与创作参考
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 规划方法（参考）

### 选择参考
按委托选读 series.md / short.md。以下方法适合需要场景规划时；可从事件因果、信息揭示或结尾回推，不必依 Phase 顺序创作。字段与实际时长校验仍须满足，不能把方法可选当作省略交付契约。

### Phase 2: 上下文准备
- 读实际配置 SVD_CONFIG（未设时 config.md）；本文及配套指南中的 config.md 均指该实际配置
- 按 series.md / short.md 指引选取有关的剧本、规划或文学素材；缺少 arc / novel 不妨碍有充分依据的单集规划

### Phase 3: 生成 outline 公共骨架
组织场景时可先写人物当场要做成的事和关键回应，再判断在哪里换场。若只是动作列表，补出哪个回应改变了策略或情绪；若只是抽象主题，找能承载它的具体行为。rules.md 的戏剧节拍与信息传达方法适合这种诊断，不要求每场都发生对抗。

所有 mode 都包含:
  ## 本集信息传达
  ## 场景列表
    ### 场景 N: ...

### Phase 4: 按 mode 加补充字段
按相关 companion 的适用条件补充，不为字段虚构 arc 或系列历史

### Phase 4.5: 时长 sum 硬校验（必跑）

场景草稿按 rules.md 使用纯文本 `- 目标时长: Ns`，不加粗时长字段；保存后由实际场景行求和，不用自报总数代替。

```bash
DURATION=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "${SVD_CONFIG:-config.md}")
```

与 scriptwriter-script/rules.md 使用同一用户预算：结合实际配置中已确认的容差/严格限制换算秒数，分钟乘 60。只有已确认 ±10% 的单值才用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/scene-duration.sh" "story/episodes/{ep}/outline.md" --target <N>`；显式范围或更严格限制用 `--target-min <M> --target-max <X>` 替换 target 参数，精确目标 M=X，不额外扩大。不能仅凭单值格式推定容差同意。

缺失、空白、读取失败、边界不清或冲突时先交主 AI 澄清，不回退模板默认或其他 config.md；已有明确决定直接复用。系列保持初始共同目标，不以前集实际时长重设。先保存场景草稿再实跑，记录 sum、边界及退出状态。FAIL 可参考 rules.md 时长取舍方法在授权内调整后复查；方法不是固定顺序，无法满足则报告冲突或询问用户，不自动拉长目标。此校验适用于已采用的大纲，不要求为剧本制作补建大纲。

### Phase 5: 写「本集新增资产」段（必产出）

outline.md **末尾必须含 `## 本集新增资产` 段**（写入位置：所有 mode 专属字段——如 series 的「集尾钩子」、short 的「结局设计」——之后，作为文件最末段），按 `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md` 「新增资产规则」段 写入：
- 4 类型行（characters / locations / items / buildings）齐全
- 无内容写 `(无)`
- asset id 按 `${CLAUDE_PLUGIN_ROOT}/skills/director-outline/rules.md`「asset id 规则」编写（=资产名，跟随 config.md 「语言」设置）
- 写入前 Glob `assets/{characters,locations,items,buildings}/*.md` 核对复用；相近名读卡确认身份，不凭名称合并，不明则询问

该段仅为规划期新增资产提案与引用检查依据。最终 `## 本集资产清单` 由 Scriptwriter 根据实际场景写在 `script.md`，不得将未采用的大纲想法无条件并入，也不回写 outline。

### Phase 6: 输出 + (按 mode) 同步全局
按 mode 指引

## 通用规则
- 场景颗粒度按时空、戏剧任务与表演连续性决定，不按动作数量拆合
- asset 引用: 所有 character/location 必须在 assets/ 已注册或在"本集新增资产"列出
- 节奏角色互斥: 一场景只能挂一个节奏角色
