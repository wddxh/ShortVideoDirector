---
name: director-review-outline
description: 审查单集 outline.md 的场景级合理性 (节奏角色分布 / 场景数量 / 与 arc 节点契合 / 新增 asset / 跳跃式开场承接 / 结局落点)。director-outline 之后强制调用。按 mode 加载 series.md 或 short.md 专属指南。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- ep: 'epXX'

### 文件读取
- `story/{ep}/outline.md` — 必须读取（review 目标）
- `config.md` — 必须读取（每集时长 / 场景数量目标 / 世界观锚点）
- `story/arc.md` — mode∈{new-series, continue-series} 必读（核对本集对应 arc 节点）
- `assets/` 目录 — 必须扫描（核对 asset 引用是否 dangling）
- `skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

## 必读文件

- `skills/director-review-outline/series.md` (when mode∈{new-series, continue-series}) — 必须读取并严格遵循
- `skills/director-review-outline/short.md` (when mode=short) — 必须读取并严格遵循

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)

1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode in {'new-series', 'continue-series'}: Read('skills/director-review-outline/series.md')
   - mode='short': Read('skills/director-review-outline/short.md')
3. **不要**加载非当前 mode 的文件

### Phase 2: 读取 review 目标与上下文

- Read `story/{ep}/outline.md`
- Read `config.md`
- mode∈series: Read `story/arc.md`
- Glob `assets/characters/*.md`, `assets/locations/*.md` 建立已注册 asset 集合

### Phase 3: 按当前 mode 文件列出的 review 项逐项检查

只列**框架级**问题；微调措辞类不入清单。意见会被 director-fix-outline 直接消化重写 outline，所以每条意见 = 工作单。

### Phase 4: 输出 .review-outline.md

写入 `story/{ep}/.review-outline.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-outline.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段格式**：

通过时（仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{位置（场景 N / 字段名）}：** {问题描述} → {修改建议}
2. **{位置}：** {问题描述} → {修改建议}
```

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则

最多 2 轮反馈。审核时若发现现实中明星 / 公众人物 / 真实地名 / 商标名，要求替换为虚构名称。

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/{ep}/.review-outline.md`（append 模式，详见 Phase 4）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}`（{M} = 本轮意见条数）→ 返回给 workflow
- 详细意见已写入文件，下游 director-fix-outline 自行读取该文件最后一轮段

