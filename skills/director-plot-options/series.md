# director-plot-options — series mode 专属指南

适用 mode: `new-series` | `continue-series`

## 必读上下文 (在公共 Phase 2 阶段读取)

- `story/arc.md` — 若存在则读 (continue-series 必有；new-series 必无)
- `story/outline.md` — 若存在则读 (continue-series 必有；new-series 必无)
- 最近 M 集 novel: 若 `story/outline.md` 存在，依据 `config.md` 的 `上下文集数` M，用 Glob 匹配 `story/episodes/ep*/novel.md` 取最近 M 集读取

## 模式细分

- **new-series** (无 outline.md): 设计整部剧的整体走向 (3 候选 = 3 个剧概念)
- **continue-series** (有 outline.md): 设计下一集走向 (3 候选 = 稳健 / 激进 / 拓展)；候选必须围绕 arc 当前阶段目标展开，差异在演绎方式而非剧情方向

## 每候选必含字段

```markdown
## 选项 X: {主题名称}
- **主题：** {一句话主题陈述}
- **A 线 (主线节点序列)：** {N1 → N2 → N3 → ... ; 每节点一句}
- **B 线 (可选)：** {副线节点序列；若无可省略并说明"无副线"}
- **主要角色弧：** {主角 / 关键配角的成长或转变曲线}
- **关键转折分布：** {第 X 集 / 第 Y 集 / 第 Z 集 三个关键反转的位置概述}
- **卖点分析：** {为什么适合短视频系列}
```

continue-series 候选可简化为:
- 关键转折 (本集核心冲突 / 反转)
- 涉及角色
- 集尾钩子
- 对后续剧情影响
但仍需呼应 arc 节点位置。

## 强制问用户 (Phase 4)

**new-series 模式必须问且仅问一次:**

> 请告知本剧总集数 (整数，例: 20)。该值将由后续 director-arc 接收用于规划节点分布。

- 接收用户回复的整数值
- 返回 workflow 时附带 `total_episodes: N` 字段
- continue-series 模式: 总集数已在 arc.md 中存在，无需再问

## 专属失败模式 (Phase 6 自查清单)

- [ ] **主线设计弱**: A 线节点 < 3 个或节点间缺乏因果递进 / 张力升级
- [ ] **副线脱节**: B 线与 A 线无交集 / 无相互推动 / 仅为填充
- [ ] **转折分布失衡**: 3 个关键转折全部挤在前半 / 后半，或两个相邻集
- [ ] (continue-series) 候选偏离 arc 当前阶段目标
- [ ] (new-series) 未问总集数 / 未在返回中携带 total_episodes
