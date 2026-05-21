# director-input-confirm — series mode (new-series / continue-series)

## 上下文加载

- `config.md` — 必读
- `story/arc.md` — 若存在则读取
- `story/outline.md` — 若存在则读取 (决定 new-series vs continue-series)
- 最近 M 集 novel.md — 若 `story/outline.md` 存在，按 config.md `上下文集数` M，用 Glob 匹配 `story/episodes/ep*/novel.md` 取最近 M 集

## 模式判断

- `story/outline.md` 不存在 → **new-series**
- `story/outline.md` 已存在 → **continue-series**

## 字段清单

### new-series 输出格式

```markdown
## {主题名称}
- **剧名：** {剧名}
- **核心设定：** {一句话概括世界观和主角定位}
- **开篇钩子：** {第一集的核心冲突/悬念}
- **卖点分析：** {为什么适合短视频}
- **总集数：** {restate 自 plot-options 阶段确认的整数}
```

### continue-series 输出格式

```markdown
## {走向名称}
- **关键转折：** {本集核心冲突或反转}
- **涉及角色：** {主要出场角色}
- **集尾钩子：** {收束方式 — 描述}
- **对整体剧情的影响：** {如何推动后续剧情}
- **总集数进度：** {当前集 / 总集数，restate}
```

## 强制确认项 / 强制问用户

- **总集数**：从 plot-options 返回结构中读取，在输出中 restate；**不再追问**
- **arc 相关设定追问** (new-series 必问；continue-series 仅当用户材料涉及 arc 调整时问)：
  - 整体节奏分段倾向（如 起-承-转-合 集数分配）
  - 关键阶段转折锚点 (有无指定要落在第 X 集)
  - 主角弧光走向 (成长 / 堕落 / 闭环)

将用户回答附在确认说明末尾"Arc 设定补充"小节，留待 director-arc 接收。

## 专属失败模式自查

- 缺总集数 restate → 失败
- continue-series 偏离 arc 当前阶段目标 → 失败
- 涉及现实 IP 未加版权规避提示 → 失败
