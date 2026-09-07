---
name: director-review-outline
description: 在已采用单集大纲且需要独立评估时，审查场景节奏、因果、资产和结局落点。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

委托说明当前集数 ep、短篇/新系列/续集语境、审核目标、保留要求与参考路径；mode 是语境描述，不是函数参数。

### 文件读取
- `story/episodes/{ep}/outline.md` — 必须读取（受托 review 目标）
- 实际配置 SVD_CONFIG（未设时 config.md）— 必须读取（用户每集时长及确认边界 / 场景数量目标 / 世界观锚点）；本文及配套指南中的 config.md 均指该实际配置
- `story/arc.md` — series 且存在、适用时读取；不因缺少 arc 要求补建
- `assets/` 目录 — 必须扫描（核对 asset 引用是否 dangling）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

## 专业参考

- `${CLAUDE_PLUGIN_ROOT}/skills/director-review-outline/series.md` — 系列的连续性、阶段推进与规划契约参考
- `${CLAUDE_PLUGIN_ROOT}/skills/director-review-outline/short.md` — 短篇的注意力、情绪落点与结构参考

## 审核边界

本 skill 是可选规划审核；遵守共享规则的独立新 Director context/主 AI relay 协议，只写本 `.review-outline.md`，不调度修复或替用户批准。不以规划缺失阻塞无此请求的制作，不运行全生产 readiness。读取失败/无法判定为 unknown。

### 适用指南

按当前委托选用 series.md 或 short.md 的专业维度；不把无关模式要求带入本集。下面按证据与判断分组，不规定固定思考顺序。

### 当前材料

- Read `story/episodes/{ep}/outline.md`
- Read 实际配置（SVD_CONFIG 或 config.md）
- mode∈series 且相关文件存在: Read `story/arc.md`
- Glob `assets/characters/*.md`, `assets/locations/*.md` 建立已注册 asset 集合

### 时长契约

```bash
DURATION=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "每集时长目标" "${SVD_CONFIG:-config.md}")
```

结合用户已确认边界换算秒数；仅已确认 ±10% 的单值用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/scene-duration.sh" "story/episodes/{ep}/outline.md" --target <N>`。显式范围/更严格限制用 `--target-min <M> --target-max <X>` 替换 target 参数，精确目标 M=X，不额外放宽，也不把单值格式当容差同意。系列核对初始共同目标，不用前集实际时长。

缺失、空白、读取失败或边界不清/冲突为 unknown，交原 Director 经主 AI 澄清，不回退模板或其他配置、不替用户确认。已有明确决定复用。实跑并保留 sum、边界、退出状态；超界写具体意见，脚本无法执行为 unknown。不以修订次数或审美判断放宽预算，不要求补建未采用的大纲。

### 叙事判断

阻塞意见聚焦框架与确认意图；有价值的措辞或节奏建议可另列理由，不作为审美门禁。意见供生产 Director 协调，不要求作者逐条照搬或调用指定修复方法。

**质性检查项（四维）**（与 director-review-novel 三维统一术语，本 review 额外多 1 维 arc 覆盖）:
1. 场景关系是否符合已确认叙事意图，在需要理解时提供足够的时空与因果线索；允许回溯、交叉叙事或高潮先行，不要求相邻场景互为因果
2. 场景过渡是否自然（时空切换有铺垫 / 交代）
3. 是否存在被砍掉的因果关键环节
4. **arc 必需事件覆盖**（仅 series 已采用 arc 时）：对照本集分配的必需事件，确认在 outline 可识别；跨多集节点不要求每集重复覆盖全部事件

### 审核记录

写入 `story/episodes/{ep}/.review-outline.md`（append 模式，每轮追加一段）。

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

重审聚焦关键问题，不以次数豁免验收。具体权利风险按共享规则升级，不因现实名称自动要求改名。

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/episodes/{ep}/.review-outline.md`（append 模式，详见审核记录）

### 返回内容
- 简报：`pass`、`needs_revision {M}` 或 `unknown`（{M} = 本轮意见条数）→ 返回原生产 Director
- 详细意见已写入文件，下游 director-fix-outline 自行读取该文件最后一轮段
