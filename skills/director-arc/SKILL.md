---
name: director-arc
description: Director生成阶段级剧情弧线规划（series 必生成）。读取 config.md、已有 outline.md、最近 M 集 novel，写入 arc.md。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

### 文件读取
- `config.md` — 必须读取
- `story/outline.md` — 若存在则读取（continue-series 时参考）
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，按 config.md 中 `上下文集数` M，用 Glob 匹配 `story/episodes/ep*/novel.md` 取最近 M 集读取
- `skills/director-arc/rules.md` — 必须读取并严格遵循（输出 schema、节点集数标注约定、常见误区）

### 通过 prompt 接收
- mode: 'new-series' | 'continue-series'
- 选定的剧情方向（引号包裹的完整文本，必填）

### 总集数
总集数从 `config.md` 的 `总集数` 字段读取（用 `bash scripts/read-config.sh "总集数"` 获取整数 N）：
- 若 N == 1 → 报错退出："series 必须 >1, 请先跑 series-video 入口设定总集数"
- 若 N > 1 → 作为节点分布的总集数

continue-series 同样从 config.md 读（不再从 arc.md 推断）。

## 职责描述

### 核心使命
series 模式下**必生成** `story/arc.md`，作为后续 director-outline / scriptwriter-script / director-review-script / continue-series 定位的唯一叙事骨架来源。

### 范围边界
- 只规划 arc 级骨架（主线 / 副线节点、人物弧、世界观要点），不展开单集场景
- **不在节点上挂"节奏角色"字段**（节奏是单集 outline / scriptwriter 的事）
- **不写独立的"关键转折点 (跨节点)" section**，关键转折并入各节点的"关键转折"字段
- 单集详细规划由 director-outline 在生成 epNN/outline.md 时按 arc 节点展开

### 规划要求
- 节点总集数严格等于 config.md `总集数` 字段值 N（总和校验）
- 节点划分均衡（避免铺垫过长 / 高潮收束被压缩）
- 人物弧起点与终点状态有可见差异
- 关键转折分布于全 arc，不集中前段
- 副线（如有）必须服务主线
- continue-series 时与已有 outline / novel 保持逻辑连贯

## 输出

### 文件操作
- 使用 Write 将剧情弧线写入 `story/arc.md`（输出 schema 详见 rules.md）
