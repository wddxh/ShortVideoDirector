---
name: director-review-asset-prompts
description: Director 汇总层——按集内序号分批并行调用 director-review-asset-prompt-single（每批 ≤5 个），聚合成完整 review 结果 + dirty list。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Task
model: opus
---

## 输入

### 文件读取
- `config.md` — 必须读取（确认语言设置）
- 本集所有 asset .md 卡列表（由 Glob 收集）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 集数（如 `ep01`）或全局范围（`assets`）
- `$ARGUMENTS[1]` — scope 过滤器（可选）：
  - 空 / 缺省 — 全部 asset（向后兼容）
  - `basic` — 仅 character / location / item / building（跳过 keyframes）
  - `keyframes` — 仅本集 keyframe（跳过 basic asset）

## 职责描述

### 核心使命

分批并行调用 `director-review-asset-prompt-single`，聚合结果写入 `.review-asset-prompts.md`。类比 `director-review-assets-visual` 的汇总+派发模式。

### 工作流

0. **Round 自检 + 入参收敛**：
   a. 推导 review md 路径（按 $ARGUMENTS[0]：epXX → `story/episodes/{ep}/.review-asset-prompts.md`；"assets" → `assets/.review-asset-prompts.md`）
   b. Read 该路径
      - 文件不存在 → 本次为第 1 轮 → 跳到 step 1（按现有方式收集全量入参）
      - 文件存在但 grep `<!-- /round-([0-9]+) -->` 无命中 → 报错退出，stderr「review md 文件存在但缺 round footer，可能是手工编辑破坏 / 旧版本 schema；请删除该文件后重跑」
      - 命中 → 取最大 N，本次为第 N+1 轮
   c. **最后一轮已通过检查**：grep round-N heading 是否含「- 通过」→ 是 → 直接返回 `pass`，**不写新轮段、不派发任何 single review**（防止重复触发累积通过段）
   d. 第 N+1 轮：在 round-N 段内 (grep 锁定 `## 第 N 轮` 到 `<!-- /round-N -->` 之间) 提取 `### dirty list` 段每行 asset_path → 作为本轮入参（替代 step 1 全量收集）
   e. 入参为空 → 执行 step 10 写一轮「通过」段 + footer → 跑 step 11 自检 → 返回 `pass`（自检失败则报错退出，不返回 pass）
1. **收集 asset 列表**（按 $ARGUMENTS[1] scope 过滤）：
   - $ARGUMENTS[0] = epXX:
     - scope = "" / 缺省 → 同时收 basic + keyframes（向后兼容）
     - scope = "basic" → 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/parse-new-assets.sh story/episodes/{ep}/outline.md` 得 asset_path 列表（仅本集**新增**资产，跳过『已有资产（本集出场）』段）；脚本 exit 非零 → 立即报错退出，stderr 复述脚本错误信息并指引『请先运行 scriptwriter-script 生成本集资产清单』；**跳过** `assets/keyframes/{ep}/*.md`
     - scope = "keyframes" → 仅 Glob `assets/keyframes/{ep}/*.md`；**跳过** outline 资产清单
   - $ARGUMENTS[0] = "assets" → Glob `assets/**/*.md`（scope 参数忽略；全集合）
2. **分批并行派发**：每批 ≤ 5 个 asset，用 `task` 工具并行调 `director-review-asset-prompt-single($ARGUMENTS[0]=asset_path)`
3. **聚合结果**：收集所有子任务返回值——空字符串（通过）和 JSON 对象（需修改）
4. **写入 review md**（实际执行入口见 step 10；本段仅定义模板规则）：
   - 第 1 轮 (文件不存在)：Write 完整文件 = 本轮段 + `\n\n---\n<!-- /round-1 -->\n`
   - 第 N+1 轮：Edit append
     - oldString: `<!-- /round-{N} -->` (严格唯一锚点)
      - newString: 同 oldString + `\n\n## 第 {N+1} 轮 ...` + body + `\n\n---\n<!-- /round-{N+1} -->`

10. **写入 review md**（强制步骤，必须执行）：按 step 4 模板规则执行：
    a. 推导路径（同 step 0.a）
    b. 构造完整 round 段（heading + body + footer `\n\n---\n<!-- /round-{N} -->\n`）
    c. 第 1 轮 → Write 创建
    d. 第 N+1 轮 → Edit append（oldString = `<!-- /round-{N} -->`；newString = 同 + `\n\n` + 本轮段）

11. **写入自检**（subagent 返回前硬约束）：
    a. Read review md 文件
    b. grep `<!-- /round-{当前轮号} -->` 必须命中且仅 1 次
       - 未命中 → 报错退出 + stderr「review 写入失败：本轮 round footer 未落盘，请检查 review md 路径权限或 Edit anchor 是否漂移」
       - 命中 ≥2 次 → 报错退出 + stderr「review 写入异常：本轮 round footer 出现多次，可能 anchor 不唯一」

12. **返回简报**（仅 step 11 通过后执行）：
    - 通过 → 返回 `pass`
    - 需修改 → 返回 `needs_revision {M}`（M = 本轮 dirty asset 数）

### 常见误区

- **串行派发** — 用 task 工具串行调每个 single skill 浪费时间 — 必须按批并行（每批 ≤ 5）
- **汇总丢失** — 子任务返回值未收集全就写文件 — 等所有子任务完成再聚合
- **意见格式不规整** — 直接拼 JSON 不转可读 markdown — 输出格式见下
- **不去重 asset** — outline 资产清单可能含重复名 — Glob 后去重再派发
- **scope 越界** — 调用本意只审某一类（如 keyframes）但漏传 $ARGUMENTS[1]，会落入"全集"默认行为而重审其他类（basic 资产），LLM review 非确定性导致不该改的 asset 被改 — 调用前先确认 $ARGUMENTS[1] 与目标范围匹配
- **改用旧 Glob outline 资产清单 superset** — 旧实现读「本集资产清单」整段含「已有资产（本集出场）」 → 重审已有资产浪费 token + 非确定性变更污染稳定资产 — 必须用 `parse-new-assets.sh` 仅取「新增资产」段
- **沿用旧 anchor (末尾 50 字符)** — 多轮后末尾不唯一会让 Edit 报错 — 必须用 `<!-- /round-{N} -->` 严格唯一锚点
- **漏写 round footer** — 不写 `---\n<!-- /round-{N} -->` → 下轮 append 找不到 anchor → 全链路断 — round footer 是硬约束
- **第 N+1 轮重审全量** — 模型本能再次 Glob 收全量 → 浪费 + 误判 — 必须按上轮 round-N dirty list 收敛
- **跳过 step 10 写入步骤** — subagent 跑完 step 9 聚合后直接 return 简报，没执行 step 10 → review md 无新轮次 → 上层卡死循环 — step 10 是强制步骤；step 11 自检兜底
- **跳过 step 11 自检** — subagent 执行了 step 10 但没验证 footer 是否真落盘 → Edit anchor 漂移 / 权限错时假象返回 pass — step 11 必须 grep 验证后才允许返回

## 输出格式

写入路径：
- $ARGUMENTS[0] = epXX → `story/episodes/{ep}/.review-asset-prompts.md`
- $ARGUMENTS[0] = "assets" → `assets/.review-asset-prompts.md`

**Round 自检**：见工作流 step 0。append anchor 改用 `<!-- /round-{N} -->`（严格唯一），不再用「文件末 50 字符」。每轮段末尾必须追加 `---\n<!-- /round-{N} -->` 作为本轮终止符（round footer）。

**本轮段格式**（前留空行）：

通过时仅 heading：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过

---
<!-- /round-{N} -->
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

### dirty list
- assets/items/玄铁古剑灵核.md
- assets/characters/沈昭.md

### 意见列表
- **assets/items/玄铁古剑灵核.md**：
  - issue: ## 图像生成提示 段含 negative phrasing...
  - prompt_direction: 删除所有'严禁/不要'句式...
- **assets/characters/沈昭.md**：
  - issue: ...
  - prompt_direction: ...
---
<!-- /round-{N} -->
```

## 规则

- 最多 2 轮反馈
- 第 2 轮聚焦仍影响图像生成质量的关键问题
- 意见必须符合 review-meta-rules.md（无 negative phrasing / 用 config 语言）

## 输出

### 文件操作
- 使用 Write / Edit 维护 `.review-asset-prompts.md`（append 模式）

### 返回内容
- 简报：`pass` 或 `needs_revision {M}` → 返回给 workflow
- 详细意见已写入文件，下游 creator-fix-asset 自行读取最后一轮段
