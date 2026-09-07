---
name: director-arc
description: 当多集故事需要统筹人物转变、关键转折、伏笔回收和集数分配，或已有阶段规划不足时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

### 文件读取
- 实际配置 `SVD_CONFIG`（未设时 `config.md`）；本文与 rules.md 的 config.md 均指此路径
- 已有 `story/arc.md`、`story/outline.md` — 读取与委托有关的部分，避免重建足够的规划
- 相关已确认剧本及必要的 novel 片段 — 核对既成事件、角色状态与未回收伏笔；`上下文集数` 作为参考范围，不全读历史小说
- `${CLAUDE_PLUGIN_ROOT}/skills/director-arc/rules.md` — 必须读取并严格遵循（输出 schema、节点集数标注约定、常见误区）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

### 委托理解
从目标、用户材料及规划范围判断新作或续作；无需内部参数语法或先经过候选选择。已确认规划足够时只补实际缺口，范围不明先询问。

### 总集数
总集数从实际配置读取（用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "总集数" "${SVD_CONFIG:-config.md}"` 获取整数 N）：
- N 缺失、无效或 ≤1 → 返回需确认的集数/范围，不虚构预算或要求重跑入口
- 若 N > 1 → 作为节点分布的总集数

continue-series 同样从 config.md 读（不再从 arc.md 推断）。

## 职责描述

### 核心使命
多集创作通常应考虑阶段规划和单集推进，先判断系列类型与已有材料是否足够。需要跨集统筹或用户要求预审 arc 时编写 `story/arc.md`；它不是所有 series 的必备前置，也不是唯一叙事依据。

### 范围边界
- 只规划 arc 级骨架（剧情节点、人物弧、世界观要点），不展开单集场景
- **不在节点上挂"节奏角色"字段**（节奏是单集 outline / scriptwriter 的事）
- **不写独立的"关键转折点 (跨节点)" section**，关键转折并入各节点的"关键转折"字段
- 需要单集场景规划时可参考 director-outline；已有剧本足够时不另建大纲

### 规划要求
- 为阶段寻找具体问题与结束时的变化：人物赢得了什么、失去了什么、知道了什么，哪些办法已不可再用。把主题落在选择及其代价上，能避免节点只是事件目录；具体试排与铺垫回收方法见 rules.md。
- 节点总集数严格等于 config.md `总集数` 字段值 N（总和校验）
- 按故事的因果、情绪与单元结构分配节点，避免必要表达被挤压；不强求均匀或固定转折位置
- 人物变化有可辨依据；稳定型主角也可通过选择、关系或处境检验体现价值，不强造成长
- continue-series 时与相关已确认剧本、规划和文学素材保持连贯；冲突先提出调整方案，不改写已发生事实

## 规划方法（参考）

以下适合新建阶段规划；也可先梳理人物选择、从结局回推或直接整理已有事件。顺序不是验收条件，不因剩余预算自动补剧情；输出 schema、总集数、确认预算与授权边界仍是硬约束。

### 配置与预算
1. `bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "总集数" "${SVD_CONFIG:-config.md}"` 取 N
2. 规划剧情节点的集数分布（节点数 + 每节点集数）
3. 按 rules.md 的实际配置与工具边界计算各节点预算，不用默认配置覆盖 SVD_CONFIG
4. 在节点 header 写入 `(epXX-YY, 节点预算 ~Zs)`

### 核心事件取舍
对每节点：
1. 先列必需事件，每条 `- {事件} (~Ns, 必需)` 格式
2. 心算必需 sum 与节点预算的差
3. 有叙事价值且已授权的可选事件可标 `(~Ns, 可选)`；预算余额不是补写指标
4. 超预算时考虑合并重复事件、减少可选内容或调整节点分配；拆细须保留真实估时，改标可选不会减少总秒数，核心取舍超授权则询问

### 保存与校验
按 rules.md schema 用 Write 落盘（参考 §1 schema、§1.5 预算计算、§3.5 bullet 格式）。
保存后运行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/arc-event-sum.sh story/arc.md` 核对格式与预算；无法在授权集数内容纳必要事件时报告取舍问题。用户要求 arc 预审时交回确认，不把自检作为正式制作授权。

## 输出

### 文件操作
- 使用 Write 将剧情弧线写入 `story/arc.md`（输出 schema 详见 rules.md）
